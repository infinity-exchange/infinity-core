import { expect, assert } from "chai";
import { ethers, network, upgrades, waffle } from "hardhat";
import { Wallet, BigNumber, BigNumberish, ContractTransaction, ContractReceipt, utils } from 'ethers';
import { InfinityPool } from '../typechain/InfinityPool';
import { LiquidationAaveV2 } from '../typechain/LiquidationAaveV2';
import { InfinityToken } from '../typechain/InfinityToken';
import { TestERC20 } from '../typechain/TestERC20'
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { constants } = ethers;
const createFixtureLoader = waffle.createFixtureLoader;
const decimal:number = 8;
const MINT_AMOUNT:BigNumberish = BigNumber.from(2).pow(255);
const TOKEN_START_AMOUNT:BigNumberish = BigNumber.from(2).pow(60);
const DAI_ADDRESS:string = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const WETH_ADDRESS:string = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDC_ADDRESS:string = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const USDT_ADDRESS:string = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const AUSDT_ADDRESS:string = '0x3ed3b47dd13ec9a98b44e6204a523e766b225811';
const DAI_WALLET_ADDRESS:string = '0x5d38b4e4783e34e2301a2a36c39a03c45798c4dd'; //mainnet fork wallet with DAI tokens
const AUSDT_WALLET_ADDRESS:string = '0x08b63092881beddc6a732a6c5b165c024edfd9ef';
const SWAP_PROTOCOL_ID_AAVE:number = 2;
const SWAP_ROUTER_ADDRESS_AAVEV2:string = '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9';

describe("Liquidation", () => {
  let wallet: Wallet, others: Wallet[];
  let DAIWalletSigner: SignerWithAddress;
  let aUSDTWalletSigner: SignerWithAddress;
  let poolBytecode: string;
  let tokenBytecode: string;
  let pool: InfinityPool;
  let poolSigner: SignerWithAddress;
  let poolToken: InfinityToken;
  let liquidationAaveV2: LiquidationAaveV2;
  let tokens: TestERC20[] = [];
  let realTokens: Map<string,TestERC20> = new Map();
  const fixture = async ()=>{
    const InfinityToken = await ethers.getContractFactory("InfinityToken");
    const InfinityPool = await ethers.getContractFactory("InfinityPool");
    const poolToken: InfinityToken = (await InfinityToken.deploy()) as InfinityToken;
    const pool: InfinityPool = await upgrades.deployProxy(InfinityPool,[poolToken.address,WETH_ADDRESS]) as InfinityPool;
    await poolToken.setPool(pool.address);
    const realTokens: Map<string,TestERC20> = new Map();
    realTokens.set('DAI',await ethers.getContractAt("TestERC20", DAI_ADDRESS));
    realTokens.set('WETH',await ethers.getContractAt("TestERC20", WETH_ADDRESS));
    realTokens.set('USDC',await ethers.getContractAt("TestERC20", USDC_ADDRESS));
    realTokens.set('USDT',await ethers.getContractAt("TestERC20", USDT_ADDRESS));
    realTokens.set('aUSDT',await ethers.getContractAt("TestERC20", AUSDT_ADDRESS));
    const tokens: TestERC20[] = [];
    for(let i=0;i<5;i++){
      tokens[i] = await (await ethers.getContractFactory("TestERC20")).deploy(MINT_AMOUNT) as TestERC20;
    }
    // seed pool eth
    await pool.connect(others[0]).deposit([],[],{value: BigNumber.from(Number.MAX_SAFE_INTEGER-1)});
    // protocol
    const liquidationAaveV2 = await (await ethers.getContractFactory("LiquidationAaveV2")).deploy(SWAP_ROUTER_ADDRESS_AAVEV2,pool.address);
    await pool.registerLiquidationProtocol(SWAP_PROTOCOL_ID_AAVE,liquidationAaveV2.address);
    // impersonate
    await network.provider.request({method:"hardhat_impersonateAccount",params:[pool.address]});
    await network.provider.request({method:"hardhat_impersonateAccount",params:[DAI_WALLET_ADDRESS]});
    await network.provider.request({method:"hardhat_impersonateAccount",params:[AUSDT_WALLET_ADDRESS]});
    await network.provider.request({method:"hardhat_setBalance",params:[pool.address,ethers.utils.hexStripZeros(ethers.utils.parseEther("10000000").toHexString())]});
    poolSigner = await ethers.getSigner(pool.address);
    DAIWalletSigner = await ethers.getSigner(DAI_WALLET_ADDRESS);
    aUSDTWalletSigner = await ethers.getSigner(AUSDT_WALLET_ADDRESS);
    return {liquidationAaveV2,pool,poolToken,realTokens,tokens};
  }
  let loadFixture: ReturnType<typeof createFixtureLoader>
  before('create fixture loader',async()=>{
    [wallet,...others] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet,...others],waffle.provider);
  });
  beforeEach('load fixture', async()=>{
    ;({liquidationAaveV2,pool,poolToken,realTokens,tokens} = await loadFixture(fixture));
    // mint 
    await tokens[0].mint(await DAIWalletSigner.getAddress(),TOKEN_START_AMOUNT);
    await tokens[0].mint(others[0].address,TOKEN_START_AMOUNT);
    await tokens[0].mint(others[1].address,TOKEN_START_AMOUNT);
  });

  before('load pool bytecode',async()=>{
    poolBytecode = (await ethers.getContractFactory('InfinityPool')).bytecode;
    tokenBytecode = (await ethers.getContractFactory('TestERC20')).bytecode;
  });

  describe('Ownership', () => {
    it('fails if caller is not owner', async () => {
      await expect((await liquidationAaveV2.connect(others[0])).transferOwnership(others[1].address)).to.be.reverted
    })

    it('emits event', async () => {
        await expect(liquidationAaveV2.connect(poolSigner).transferOwnership(others[0].address))
          .to.emit(liquidationAaveV2, 'OwnershipTransferred')
          .withArgs(poolSigner.address, others[0].address)
    })

    it('cannot be called by original owner', async () => {
      await liquidationAaveV2.connect(poolSigner).transferOwnership(others[0].address)
      await expect(liquidationAaveV2.connect(poolSigner).transferOwnership(wallet.address)).to.be.reverted
    })
  });

  // describe("aave v2", ()=>{
  //   it("swaps directly with aave from wallet",async()=>{
  //     console.log(`wallet aUSDT: ${(await realTokens.get('aUSDT')!.balanceOf(AUSDT_WALLET_ADDRESS)).toString()}, USDT: ${(await realTokens.get('USDT')!.balanceOf(AUSDT_WALLET_ADDRESS)).toString()}`);
  //     const amountIn = 100*1e9; // 1 aUSDT
  //     // const retUserAcct = await aaveLendingPool.connect(poolSigner).getUserAccountData(AUSDT_WALLET_ADDRESS);
  //     // console.log(retUserAcct);
  //     // const retReserve = await aaveLendingPool.connect(poolSigner).getReserveData(tokenTo);
  //     // console.log('retReserve',retReserve);
  //     const aaveLendingPool:any = new ethers.Contract(SWAP_ROUTER_ADDRESS_AAVEV2,aaveAbi,waffle.provider);
  //     const retWithdrawn = await aaveLendingPool.connect(ausdtWalletSigner).withdraw(USDT_ADDRESS,amountIn,ausdtWalletSigner.address);
  //     // console.log('retWithdrawn',retWithdrawn);
  //     console.log(`wallet aUSDT: ${(await realTokens.get('aUSDT')!.balanceOf(AUSDT_WALLET_ADDRESS)).toString()}, USDT: ${(await realTokens.get('USDT')!.balanceOf(AUSDT_WALLET_ADDRESS)).toString()}`);
  //   });
  //   it("transfers then swaps directly with aave from pool",async()=>{
  //     console.log(`wallet aUSDT: ${(await realTokens.get('aUSDT')!.balanceOf(AUSDT_WALLET_ADDRESS)).toString()}, USDT: ${(await realTokens.get('USDT')!.balanceOf(AUSDT_WALLET_ADDRESS)).toString()}`);
  //     const AUSDT_AMOUNT = await realTokens.get('aUSDT')!.balanceOf(AUSDT_WALLET_ADDRESS);
  //     await realTokens.get('aUSDT')!.connect(ausdtWalletSigner).approve(pool.address,AUSDT_AMOUNT);
  //     await pool.connect(ausdtWalletSigner).deposit([{token:AUSDT_ADDRESS,amount:AUSDT_AMOUNT}],[],{value: 0});
  //     console.log(`pool aUSDT: ${(await realTokens.get('aUSDT')!.balanceOf(pool.address)).toString()}, USDT: ${(await realTokens.get('USDT')!.balanceOf(pool.address)).toString()}`);
  //     const amountIn = 100*1e9; // 1 aUSDT
  //     const aaveLendingPool:any = new ethers.Contract(SWAP_ROUTER_ADDRESS_AAVEV2,aaveAbi,waffle.provider);
  //     // const retUserAcct = await aaveLendingPool.connect(poolSigner).getUserAccountData(AUSDT_WALLET_ADDRESS);
  //     // console.log(retUserAcct);
  //     const { currentLiquidityRate } = await aaveLendingPool.connect(poolSigner).getReserveData(USDT_ADDRESS);
  //     // console.log('retReserve',retReserve);
  //     const retWithdrawn = await aaveLendingPool.connect(poolSigner).withdraw(USDT_ADDRESS,amountIn,poolSigner.address);
  //     // console.log('retWithdrawn',retWithdrawn);
  //     console.log(`pool aUSDT: ${(await realTokens.get('aUSDT')!.balanceOf(pool.address)).toString()}, USDT: ${(await realTokens.get('USDT')!.balanceOf(pool.address)).toString()}`);
  //   });
  // });
  describe("Swap: aave v2", ()=>{
    beforeEach("sets up pool aUSDT",async()=>{
      const AUSDT_AMOUNT = await realTokens.get('aUSDT')!.balanceOf(AUSDT_WALLET_ADDRESS);
      const USDT_AMOUNT = await realTokens.get('USDT')!.balanceOf(AUSDT_WALLET_ADDRESS);
      await realTokens.get('aUSDT')!.connect(aUSDTWalletSigner).approve(pool.address,AUSDT_AMOUNT);
      expect(AUSDT_AMOUNT).to.be.gt(0);
      await pool.connect(aUSDTWalletSigner).deposit([{token:AUSDT_ADDRESS,amount:AUSDT_AMOUNT}],[],{value: 0});
    });
    it("swaps directly: should fail (only owner)",async()=>{
      const lparams = {
        clientAddress: others[0].address, //address
        tokenFrom: AUSDT_ADDRESS, //address
        tokenTo: USDT_ADDRESS, //address
        amountIn: 1*1e9, //uint256
        poolFee: 0, //uint24
      };
      expect((await liquidationAaveV2.connect(others[0])).swap(lparams)).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it("swaps via pool",async()=>{
      // console.log(`wallet aUSDT: ${(await realTokens.get('aUSDT')!.balanceOf(AUSDT_WALLET_ADDRESS)).toString()}, USDT: ${(await realTokens.get('USDT')!.balanceOf(AUSDT_WALLET_ADDRESS)).toString()}`);

      // const aToken = new ethers.Contract(AUSDT_ADDRESS,IATokenAbi,waffle.provider);
      // const AUSDT_SCALED_AMOUNT = await aToken.scaledBalanceOf(AUSDT_WALLET_ADDRESS);
      // const AUSDT_NORMAL_AMOUNT = await aToken.balanceOf(AUSDT_WALLET_ADDRESS);
      // console.log(`AUSDT_SCALED_AMOUNT: ${AUSDT_SCALED_AMOUNT}, AUSDT_NORMAL_AMOUNT: ${AUSDT_NORMAL_AMOUNT}`);
      const amountIn = 100*1e9; // 100 aUSDT  //AUSDT_NORMAL_AMOUNT

      console.log(`before time passed 1 aUSDT ${await realTokens.get('aUSDT')!.balanceOf(pool.address)}`);
      // time passes for more aTokens
      await network.provider.send("evm_increaseTime", [864000]);
      await network.provider.send("evm_mine") ;
      console.log(`time passed 1 aUSDT ${await realTokens.get('aUSDT')!.balanceOf(pool.address)}`);

      const AUSDT_STARTING_AMOUNT = await realTokens.get('aUSDT')!.balanceOf(pool.address);
      const USDT_STARTING_AMOUNT = await realTokens.get('USDT')!.balanceOf(pool.address);
      console.log(`pool aUSDT: ${AUSDT_STARTING_AMOUNT.toString()}, USDT: ${USDT_STARTING_AMOUNT.toString()}`);
      const tokenFrom = AUSDT_ADDRESS;
      const tokenTo = USDT_ADDRESS; // TODO should it be ignored or further swapped to a target token?
      const clientAddress = aUSDTWalletSigner.address;
      const lparams = {
        clientAddress, //address
        tokenFrom, //address
        tokenTo, //address
        amountIn, //uint256
        poolFee: 0, //uint24
      };
      // console.log('lparams',lparams);
      const receipt:ContractReceipt = await (await pool.serverLiquidate(SWAP_PROTOCOL_ID_AAVE,lparams)).wait();
      // console.log('receipt',receipt);
      const event = receipt.events?.filter((x) => {return x.event == "ServerLiquidateSuccess"})[0];
      // console.log('event args',event?.args);
      const {amount:amountOut,token:tokenOut} = event?.args?.amounts[0];
      expect(amountOut).to.gt(0);
      expect(tokenOut.toLowerCase()).to.eq(tokenTo.toLowerCase());
      expect(event?.args?.tokenFrom?.toLowerCase()).to.eq(tokenFrom.toLowerCase());
      expect(event?.args?.clientAddress?.toLowerCase()).to.eq(clientAddress.toLowerCase());
      
      const AUSDT_FINISHED_AMOUNT = await realTokens.get('aUSDT')!.balanceOf(pool.address);
      const USDT_FINISHED_AMOUNT = await realTokens.get('USDT')!.balanceOf(pool.address);
      console.log(`swapped ${amountIn} aUSDT to ${amountOut} USDT`);
      console.log(`pool aUSDT: ${(AUSDT_FINISHED_AMOUNT).toString()}, USDT: ${(USDT_FINISHED_AMOUNT).toString()}`);
      expect(USDT_FINISHED_AMOUNT).to.eq(amountOut);
      expect(AUSDT_FINISHED_AMOUNT).to.gt(AUSDT_STARTING_AMOUNT.sub(amountOut)); // should receive interest hence gt but just slightly
      
    });
    it('liquidate without approval: should fail',async()=>{
      const AUSDT_STARING_AMOUNT = await realTokens.get('aUSDT')!.balanceOf(pool.address);
      expect(AUSDT_STARING_AMOUNT).to.be.gt(0);
      const AUSDT_ALLOWANCE = await realTokens.get('aUSDT')?.allowance(pool.address, liquidationAaveV2.address);
      expect(AUSDT_ALLOWANCE).to.equal(0);
      
      expect(liquidationAaveV2.connect(poolSigner).swap({
        clientAddress: AUSDT_WALLET_ADDRESS,
        amountIn: AUSDT_STARING_AMOUNT,
        poolFee: 3000, 
        tokenFrom: AUSDT_ADDRESS,
        tokenTo: USDT_ADDRESS
      })).to.be.revertedWith("transferFrom failed");
    });

    it('liquidate without sufficient approval: should fail',async()=>{
      const AUSDT_TOKEN = await realTokens.get('aUSDT')!;
      const AUSDT_STARING_AMOUNT = await AUSDT_TOKEN.balanceOf(pool.address);
      expect(AUSDT_STARING_AMOUNT).to.be.gt(0);
      
      const APPROVAL_AMOUNT = AUSDT_STARING_AMOUNT.sub(10)
      
      await (await AUSDT_TOKEN.connect(poolSigner).approve(liquidationAaveV2.address, APPROVAL_AMOUNT)).wait();
      
      const AUSDT_ALLOWANCE = await AUSDT_TOKEN.allowance(pool.address, liquidationAaveV2.address);
      expect(AUSDT_ALLOWANCE).to.equal(APPROVAL_AMOUNT);
      
      expect(liquidationAaveV2.connect(poolSigner).swap({
        clientAddress: AUSDT_WALLET_ADDRESS,
        amountIn: AUSDT_STARING_AMOUNT, // we only approved AUSDT_START_AMOUNT - 10
        poolFee: 3000, 
        tokenFrom: AUSDT_ADDRESS,
        tokenTo: USDT_ADDRESS
      })).to.be.revertedWith("transferFrom failed");
    });

    it('liquidate from non-existent token: should fail',async()=>{
      expect(liquidationAaveV2.connect(poolSigner).swap({
        clientAddress: AUSDT_WALLET_ADDRESS,
        amountIn: 1000,
        poolFee: 0, 
        tokenFrom: USDT_ADDRESS, // intentionally wrong address
        tokenTo: USDT_ADDRESS
      })).to.be.revertedWith("tokenTo is not underlying asset");
    });
  
  });
  it("swaps via pool: fails with mismatched tokens",async()=>{
    const amountIn = 1000*1e8; // 1000 aUSDT 
    await realTokens.get('aUSDT')!.connect(aUSDTWalletSigner).approve(pool.address,amountIn);
    await pool.connect(aUSDTWalletSigner).deposit([{token:AUSDT_ADDRESS,amount:amountIn}],[],{value: 0});
    const AUSDT_START_AMOUNT = await realTokens.get('aUSDT')!.balanceOf(pool.address);

    const CUSDT_STARTING_AMOUNT = await realTokens.get('aUSDT')!.balanceOf(pool.address);
    console.log(`pool aUSDT: ${CUSDT_STARTING_AMOUNT.toString()}`);
    const tokenFrom = AUSDT_ADDRESS;
    const tokenTo = DAI_ADDRESS; // mismatched token
    const clientAddress = aUSDTWalletSigner.address;
    const lparams = {
      clientAddress, //address
      tokenFrom, //address
      tokenTo, //address
      amountIn, //uint256
      poolFee: 0, //uint24
    };
    // console.log('lparams',lparams);
    await expect(pool.serverLiquidate(SWAP_PROTOCOL_ID_AAVE,lparams)).to.be.revertedWith("tokenTo is not underlying asset");
    // const AUSDT_FINISHED_AMOUNT = await realTokens.get('aUSDT')!.balanceOf(pool.address);
    // expect(AUSDT_FINISHED_AMOUNT).to.eq(AUSDT_START_AMOUNT);
    // assert.fail("not implemented");
  });
  
  // assert.fail("todo");
  // it("bridgeTransfer", async ()=>{
  //   assert.fail("not implemented");
  // });
});
