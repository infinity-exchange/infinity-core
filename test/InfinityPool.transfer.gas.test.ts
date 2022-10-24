import { expect, assert } from "chai";
import { ethers, network, waffle, getNamedAccounts, deployments } from "hardhat";
import { Wallet, BigNumber, BigNumberish, ContractTransaction, ContractReceipt, utils } from 'ethers';
import { InfinityPool } from '../typechain/InfinityPool';
import { InfinityToken } from '../typechain/InfinityToken';
import { TestERC20 } from '../typechain/TestERC20'
import { isCommunityResourcable } from "@ethersproject/providers";

const { constants } = ethers;
const createFixtureLoader = waffle.createFixtureLoader;
const decimal:number = 8;
const MINT_AMOUNT:BigNumberish = BigNumber.from(2).pow(255);
const TOKEN_START_AMOUNT:BigNumberish = BigNumber.from(2).pow(60);
const WETH_ADDRESS:string = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USER_COUNT = 10;
const TOKEN_COUNT = 2;
const PRICE_INDEX_UPDATE_COUNT = 5;

describe("InfinityPool gas test", () => {
  let wallet: Wallet;
  let others: Wallet[] = [];
  let poolBytecode: string;
  let tokenBytecode: string;
  let pool: InfinityPool;
  let poolToken: InfinityToken;
  let tokens: TestERC20[] = [];
  const fixture = async ()=>{
    const {deployer} = await getNamedAccounts();
    const deployerSigner = await ethers.getSigner(deployer);
    await deployments.fixture(['InfinityPool','InfinityToken']);
    const poolDeploy = await deployments.get('InfinityPool');
    const poolTokenDeploy = await deployments.get('InfinityToken');
    const pool = await ethers.getContractAt(poolDeploy.abi,poolDeploy.address,deployerSigner) as InfinityPool;
    const poolToken = await ethers.getContractAt(poolTokenDeploy.abi,poolTokenDeploy.address,deployerSigner) as InfinityToken;
    return {pool,poolToken};
  }
  let loadFixture: ReturnType<typeof createFixtureLoader>
  before('create fixture loader',async()=>{
    [wallet] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet],waffle.provider);
  });
  beforeEach('load fixture', async()=>{
    ;({pool,poolToken} = await loadFixture(fixture));
      await network.provider.request({method:"hardhat_setBalance",params:[pool.address,ethers.utils.hexStripZeros(ethers.utils.parseEther("10000000").toHexString())]});
      await network.provider.request({method:"hardhat_setBalance",params:[wallet.address,ethers.utils.hexStripZeros(ethers.utils.parseEther("10000000").toHexString())]});
  });
  before('load pool bytecode',async()=>{
    poolBytecode = (await ethers.getContractFactory('InfinityPool')).bytecode;
    tokenBytecode = (await ethers.getContractFactory('TestERC20')).bytecode;
  });
  for(let i=0;i<TOKEN_COUNT;i++){
    beforeEach(`setup token ${i}`, async()=>{
      tokens[i] = await (await ethers.getContractFactory("TestERC20")).deploy(MINT_AMOUNT) as TestERC20;
      // console.log(`setup token ${i} done`);
    });
  }
  for(let i=0;i<USER_COUNT;i++){
    beforeEach(`setup wallet ${i}`, async()=>{
      const wallet = ethers.Wallet.createRandom().connect(waffle.provider);
      others[i] = wallet;
      await network.provider.request({method:"hardhat_setBalance",params:[wallet.address,ethers.utils.hexStripZeros(ethers.utils.parseEther("1").toHexString())]});
      for(let i=0;i<TOKEN_COUNT;i++){
        await tokens[i].mint(wallet.address,TOKEN_START_AMOUNT);
      }
      // console.log(`setup wallet ${i} done`);
    });
  }
  beforeEach(`check balance`,async()=>{
    console.log('wallet eth: ',ethers.utils.formatEther(await wallet.getBalance()));
    console.log('pool eth: ',ethers.utils.formatEther(await waffle.provider.getBalance(pool.address)));
  });

  describe("Deposits", ()=>{
    const TRANSFER_AMOUNT_ETHER = BigNumber.from(0); //BigNumber.from(4*1e4);
    const TRANSFER_AMOUNT_TOKEN = BigNumber.from(2).pow(8);
    for(let i=0;i<TOKEN_COUNT;i++){
      for(let j=0;j<USER_COUNT;j++){
        beforeEach(`approve tokens: user ${i}, token ${j}`,async()=>{
          // console.log(`approve tokens: user ${i}, token ${j}`);
          const token = tokens[i];
          const client = others[j];
          // console.log('token', token);
          // console.log('client', client);
          expect(await token.connect(client).approve(pool.address,TRANSFER_AMOUNT_TOKEN)).to.emit(token,'Approval');
        });
      }
    }
    it(`deposits tokens: ${USER_COUNT} users, ${TOKEN_COUNT} tokens`,async()=>{
      console.log(`deposits tokens: ${USER_COUNT} users, ${TOKEN_COUNT} tokens`);
      const tokenTransfers = [];
      for(let i=0;i<TOKEN_COUNT;i++){
        const token = tokens[i];
        tokenTransfers.push({token:token.address,amount:TRANSFER_AMOUNT_TOKEN});
      }
      for(let j=0;j<USER_COUNT;j++){
        const client = others[j];
        const receipt:ContractReceipt = await (
          await pool.connect(client).deposit(
            tokenTransfers,[],{value: TRANSFER_AMOUNT_ETHER}
          )
        ).wait();
        const event = receipt.events?.filter((x) => {return x.event == "DepositsOrActionsTriggered"})[0];
        // console.log("event", event);
      }
    });
  });

  describe("server triggered action", ()=>{
    // it(`mints iTokens: ${USER_COUNT} users, ${TOKEN_COUNT} tokens`,async ()=>{
    //   const TRANSFER_AMOUNT_TOKEN = BigNumber.from(2).pow(8);
    //   const addresses = others.map(w=>w.address);
    //   const tokenTransfers = others.map(w=>{
    //     return tokens.map(token=>{
    //       return {
    //         token:token.address, amount: TRANSFER_AMOUNT_TOKEN,
    //       };
    //     });
    //   });
    //   expect(await pool.serverUpdateBalances(
    //     addresses,tokenTransfers,[]
    //   )).to.emit(poolToken,'TransferBatch');
    // });
    it(`mints and burns iTokens: ${USER_COUNT} users, ${TOKEN_COUNT} tokens`,async ()=>{
      const amount = BigNumber.from(2).pow(8);
      const priceIndex = BigNumber.from(1).pow(8);
      let priceIndexCount = 0;
      const isERC721 = false;
      const addresses = others.map(w=>w.address);
      const tokenUpdates = others.map(w=>{
        return tokens.map(token=>{
          const tokenId = token.address;
          return {
            tokenId, amount, priceIndex:(priceIndexCount++<PRICE_INDEX_UPDATE_COUNT)?priceIndex:BigNumber.from(0), isERC721
          };
        });
      });
      expect(await pool.serverUpdateBalances(
        addresses,tokenUpdates,[]
      )).to.emit(poolToken,'UpdateBatch');
    });
  });

});
