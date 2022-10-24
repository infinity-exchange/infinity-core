import { expect, assert } from "chai";
import { ethers, network, waffle, upgrades } from "hardhat";
import { Wallet, BigNumber, BigNumberish, ContractTransaction, ContractReceipt, utils } from 'ethers';
import { InfinityPool } from '../typechain/InfinityPool';
import { InfinityToken } from '../typechain/InfinityToken';
import { TestERC20 } from '../typechain/TestERC20'
import { IWETH } from '../typechain/IWETH'

const { constants } = ethers;
const createFixtureLoader = waffle.createFixtureLoader;
const decimal:number = 8;
const MINT_AMOUNT = BigNumber.from(2).pow(255);
const TOKEN_START_AMOUNT = BigNumber.from(2).pow(60);
const TOKEN_PRICE_INDEX = BigNumber.from(10).pow(13).mul(121).div(100); // 1.21*1e13
const WETH_TOKEN_ADDRESS:string = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const WBTC_ADDRESS = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
const aWETH_ADDRESS = '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

describe("InfinityPool", () => {
  let wallet: Wallet, others: Wallet[];
  let poolBytecode: string;
  let tokenBytecode: string;
  let pool: InfinityPool;
  let poolToken: InfinityToken;
  let wethToken: IWETH;
  let tokenA: TestERC20;
  let tokenB: TestERC20;
  let tokenC: TestERC20;
  let tokens: TestERC20[] = [];
  const fixture = async ()=>{
    const InfinityPool = await ethers.getContractFactory("InfinityPool");
    const InfinityToken = await ethers.getContractFactory("InfinityToken");
    const poolToken: InfinityToken = await InfinityToken.deploy();
    const pool: InfinityPool = await upgrades.deployProxy(InfinityPool,[poolToken.address,WETH_TOKEN_ADDRESS]) as InfinityPool;
    await poolToken.setPool(pool.address);
    const wethToken: IWETH = await ethers.getContractAt("IWETH",WETH_TOKEN_ADDRESS) as IWETH;
    const tokenA: TestERC20 = await (await ethers.getContractFactory("TestERC20")).deploy(MINT_AMOUNT) as TestERC20;
    const tokenB: TestERC20 = await (await ethers.getContractFactory("TestERC20")).deploy(MINT_AMOUNT) as TestERC20;
    const tokenC: TestERC20 = await (await ethers.getContractFactory("TestERC20")).deploy(MINT_AMOUNT) as TestERC20;
    const tokens: TestERC20[] = [];
    for(let i=0;i<5;i++){
      tokens[i] = await (await ethers.getContractFactory("TestERC20")).deploy(MINT_AMOUNT) as TestERC20;
    }
    return {pool,poolToken,wethToken,tokenA,tokenB,tokenC,tokens};
  }
  let loadFixture: ReturnType<typeof createFixtureLoader>
  before('create fixture loader',async()=>{
    [wallet, ...others] = waffle.provider.getWallets();
    // [wallet,...others] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet,...others],waffle.provider);
  });
  beforeEach('load fixture', async()=>{
    ;({pool,poolToken,wethToken,tokenA,tokenB,tokenC,tokens} = await loadFixture(fixture));
    // await wethToken.mint(others[0].address,TOKEN_START_AMOUNT);
    await tokenA.mint(others[0].address,TOKEN_START_AMOUNT);
    await tokenB.mint(others[0].address,TOKEN_START_AMOUNT);
    await tokenC.mint(others[0].address,TOKEN_START_AMOUNT);
    // await wethToken.mint(others[1].address,TOKEN_START_AMOUNT);
    await tokenA.mint(others[1].address,TOKEN_START_AMOUNT);
    await tokenB.mint(others[1].address,TOKEN_START_AMOUNT);
    await tokenC.mint(others[1].address,TOKEN_START_AMOUNT);
  });

  before('load pool bytecode',async()=>{
    poolBytecode = (await ethers.getContractFactory('InfinityPool')).bytecode;
    tokenBytecode = (await ethers.getContractFactory('TestERC20')).bytecode;
  });

  describe("server triggered action", ()=>{
    beforeEach("starting account",async ()=>{
      await pool.serverUpdateBalances(
        [others[0].address,others[1].address],[
          [{tokenId:WETH_TOKEN_ADDRESS,amount:TOKEN_START_AMOUNT,priceIndex:0}, {tokenId:tokenA.address,amount:TOKEN_START_AMOUNT,priceIndex:0}, {tokenId:tokenB.address,amount:TOKEN_START_AMOUNT,priceIndex:0}, {tokenId:tokenC.address,amount:TOKEN_START_AMOUNT,priceIndex:0}],
          [{tokenId:WETH_TOKEN_ADDRESS,amount:TOKEN_START_AMOUNT,priceIndex:0}, {tokenId:tokenA.address,amount:TOKEN_START_AMOUNT,priceIndex:0}, {tokenId:tokenB.address,amount:TOKEN_START_AMOUNT,priceIndex:0}, {tokenId:tokenC.address,amount:TOKEN_START_AMOUNT,priceIndex:0}],
        ],[]
      );
      expect(await poolToken.balanceOf(others[0].address,wethToken.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await poolToken.balanceOf(others[0].address,tokenA.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await poolToken.balanceOf(others[0].address,tokenB.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await poolToken.balanceOf(others[0].address,tokenC.address)).to.equal(TOKEN_START_AMOUNT);
      // await wethToken.mint(pool.address,TOKEN_START_AMOUNT);
      await tokenA.mint(pool.address,TOKEN_START_AMOUNT);
      await tokenB.mint(pool.address,TOKEN_START_AMOUNT);
      await tokenC.mint(pool.address,TOKEN_START_AMOUNT);
      // expect(await wethToken.balanceOf(pool.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await tokenA.balanceOf(pool.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await tokenB.balanceOf(pool.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await tokenC.balanceOf(pool.address)).to.equal(TOKEN_START_AMOUNT);
    });
    it('calls serverUpdateBalances with rawCallData',async()=>{
      const WALLET_ADDRESS = "0x8a4bac48da0503a52a370e95734c41abbe5eeccb";
      const USDT_TOKEN_1 = '0x'+'01'+USDT_ADDRESS.slice(2);
      const USDT_TOKEN_2 = '0x'+'02'+USDT_ADDRESS.slice(2);
      const USDT_AMOUNT = BigNumber.from("101006737");
      const USDC_AMOUNT = BigNumber.from("101000001006737");
      const USDT_1_AMOUNT = BigNumber.from("404280");
      const USDT_1_USER_PI = BigNumber.from("11544688814801");
      const USDT_1_PI = BigNumber.from("11663077898211");
      const USDT_2_PI = BigNumber.from("11663970298374");
      const calldata = pool.interface.encodeFunctionData("serverUpdateBalances",[[
        WALLET_ADDRESS
      ],[[
        {tokenId:USDT_ADDRESS,amount:USDT_AMOUNT,priceIndex:0},
        {tokenId:USDC_ADDRESS,amount:USDC_AMOUNT,priceIndex:0},
        {tokenId:USDT_TOKEN_1,amount:USDT_1_AMOUNT,priceIndex:USDT_1_USER_PI},
      ]],[
        {key:USDT_TOKEN_1,value:USDT_1_PI},
        {key:USDT_TOKEN_2,value:USDT_2_PI},
      ]]);
      // console.log("generated calldata",calldata);
      const calldataObj = pool.interface.decodeFunctionData("serverUpdateBalances",calldata);
      // console.log("decode",calldataObj);
      const data = await wallet.signTransaction({"to":pool.address,"data":calldata});
      console.log("data",data);
      expect(data).to.not.eq("0x");
      const [response] = pool.interface.decodeErrorResult("serverUpdateBalances", data);
      console.log("response",response);
      expect(await pool.balanceOf(WALLET_ADDRESS,USDT_ADDRESS)).to.equal(USDT_AMOUNT);
      expect(await pool.balanceOf(WALLET_ADDRESS,USDC_ADDRESS)).to.equal(USDC_AMOUNT);
      expect(await pool.priceIndex(USDT_TOKEN_1)).to.equal(USDT_1_PI);
      expect(await pool.priceIndex(USDT_TOKEN_2)).to.equal(USDT_2_PI);
    });
    
    it('calls serverTransferFunds with rawCallData',async()=>{
      const WALLET_ADDRESS = "0x8a4bac48da0503a52a370e95734c41abbe5eeccb";
      const USDT_AMOUNT = BigNumber.from("1000000");
      const calldata = pool.interface.encodeFunctionData("serverTransferFunds",[
        WALLET_ADDRESS, [{token:USDT_ADDRESS,amount:USDT_AMOUNT}]
      ]);
      console.log("generated calldata",calldata);
      const calldataObj = pool.interface.decodeFunctionData("serverTransferFunds",calldata);
      console.log("decode",calldataObj);
      const data = await wallet.signTransaction({"to":pool.address,"data":calldata});
      console.log("data",data);
      expect(data).to.not.eq("0x");
      const [response] = pool.interface.decodeErrorResult("serverTransferFunds", data);
      console.log("response",response);
    });
  });

  // it("bridgeTransfer", async ()=>{
  //   assert.fail("not implemented");
  // });
});
