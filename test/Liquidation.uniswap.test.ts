import { expect, assert } from "chai";
import { ethers, network, upgrades, waffle } from "hardhat";
import { Wallet, BigNumber, BigNumberish, ContractTransaction, ContractReceipt, utils } from 'ethers';
import { InfinityPool } from '../typechain/InfinityPool';
import { LiquidationUniswapV3 } from '../typechain/LiquidationUniswapV3';
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
const DAI_WALLET_ADDRESS:string = '0x5d38b4e4783e34e2301a2a36c39a03c45798c4dd'; //mainnet fork wallet with DAI tokens
const SWAP_PROTOCOL_ID_UNISWAP:number = 1;
const SWAP_ROUTER_ADDRESS_UNISWAPV3:string = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

describe("Liquidation", () => {
  let wallet: Wallet, others: Wallet[];
  let DAIWalletSigner: SignerWithAddress;
  let cUSDTWalletSigner: SignerWithAddress;
  let cDAIWalletSigner: SignerWithAddress;
  let poolBytecode: string;
  let tokenBytecode: string;
  let pool: InfinityPool;
  let poolSigner: SignerWithAddress;
  let poolToken: InfinityToken;
  let liquidationUniswapV3: LiquidationUniswapV3;
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
    const tokens: TestERC20[] = [];
    for(let i=0;i<5;i++){
      tokens[i] = await (await ethers.getContractFactory("TestERC20")).deploy(MINT_AMOUNT) as TestERC20;
    }
    // seed pool eth
    await pool.connect(others[0]).deposit([],[],{value: BigNumber.from(Number.MAX_SAFE_INTEGER-1)});
    // protocol
    const liquidationUniswapV3 = await (await ethers.getContractFactory("LiquidationUniswapV3")).deploy(SWAP_ROUTER_ADDRESS_UNISWAPV3,pool.address);
    await pool.registerLiquidationProtocol(SWAP_PROTOCOL_ID_UNISWAP,liquidationUniswapV3.address);
    // impersonate
    await network.provider.request({method:"hardhat_impersonateAccount",params:[pool.address]});
    await network.provider.request({method:"hardhat_impersonateAccount",params:[DAI_WALLET_ADDRESS]});
    await network.provider.request({method:"hardhat_setBalance",params:[pool.address,ethers.utils.hexStripZeros(ethers.utils.parseEther("10000000").toHexString())]});
    poolSigner = await ethers.getSigner(pool.address);
    DAIWalletSigner = await ethers.getSigner(DAI_WALLET_ADDRESS);
    return {liquidationUniswapV3,pool,poolToken,realTokens,tokens};
  }
  let loadFixture: ReturnType<typeof createFixtureLoader>
  before('create fixture loader',async()=>{
    [wallet,...others] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet,...others],waffle.provider);
  });
  beforeEach('load fixture', async()=>{
    ;({liquidationUniswapV3,pool,poolToken,realTokens,tokens} = await loadFixture(fixture));
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
      await expect((await liquidationUniswapV3.connect(others[0])).transferOwnership(others[1].address)).to.be.reverted
    })

    it('emits event', async () => {
      await expect(liquidationUniswapV3.connect(poolSigner).transferOwnership(others[0].address))
        .to.emit(liquidationUniswapV3, 'OwnershipTransferred')
        .withArgs(poolSigner.address, others[0].address)
    })

    it('cannot be called by original owner', async () => {
      await liquidationUniswapV3.connect(poolSigner).transferOwnership(others[0].address)
      await expect(liquidationUniswapV3.connect(poolSigner).transferOwnership(wallet.address)).to.be.reverted
    })
  });
  
  describe("Swap: uniswap v3", ()=>{
    beforeEach("sets up pool DAI",async()=>{
      const uint64_max = BigNumber.from(Number.MAX_SAFE_INTEGER-1);
      const daiWalletBalance = await realTokens.get('DAI')!.balanceOf(await DAIWalletSigner.getAddress());
      const DAI_AMOUNT = uint64_max.lt(daiWalletBalance)?uint64_max:daiWalletBalance;
      const ETH_AMOUNT = (await DAIWalletSigner.getBalance()).div(2);
      // const ETH_AMOUNT = uint64_max; const DAI_AMOUNT = uint64_max;
      // console.log(`ETH_AMOUNT: ${ETH_AMOUNT}, DAI_AMOUNT: ${DAI_AMOUNT}`);
      await realTokens.get('DAI')!.connect(DAIWalletSigner).approve(pool.address,DAI_AMOUNT);
      await pool.connect(DAIWalletSigner).deposit([{token:DAI_ADDRESS,amount:DAI_AMOUNT}],[],{value: ETH_AMOUNT});
      // console.log(`pool ETH: ${await poolSigner.getBalance()}, DAI: ${(await realTokens.get('DAI')!.balanceOf(pool.address)).toNumber()}`);
    });
    it("swaps directly: should fail (only owner)",async()=>{
      const lparams = {
        clientAddress: others[0].address, //address
        tokenFrom: DAI_ADDRESS, //address
        tokenTo: USDC_ADDRESS, //address
        amountIn: 1*1e9, //uint256
        poolFee: 3000, //uint24
      };
      expect(liquidationUniswapV3.connect(others[0]).swap(lparams)).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it("swaps via pool",async()=>{
      const DAI_STARTING_AMOUNT = await realTokens.get('DAI')!.balanceOf(pool.address);
      const WETH_STARTING_AMOUNT = await realTokens.get('WETH')!.balanceOf(pool.address);
      console.log(`pool DAI: ${DAI_STARTING_AMOUNT.toString()}, WETH: ${WETH_STARTING_AMOUNT.toString()}`);
      const amountIn = 100*1e9; // 100DAI
      const tokenFrom = DAI_ADDRESS;
      const tokenTo = WETH_ADDRESS;
      const clientAddress = DAIWalletSigner.address;
      const lparams = {
        clientAddress, //address
        tokenFrom, //address
        tokenTo, //address
        amountIn, //uint256
        poolFee: 3000, //uint24
      };
      // console.log('lparams',lparams);
      const receipt:ContractReceipt = await (await pool.serverLiquidate(SWAP_PROTOCOL_ID_UNISWAP,lparams)).wait();
      // console.log('receipt',receipt);
      const event = receipt.events?.filter((x) => {return x.event == "ServerLiquidateSuccess"})[0];
      // console.log('event args',event?.args);
      const {amount:amountOut,token:tokenOut} = event?.args?.amounts[0];
      expect(amountOut).to.gt(0);
      expect(tokenOut).to.eq(tokenTo);
      expect(event?.args?.tokenFrom).to.eq(tokenFrom);
      expect(event?.args?.clientAddress).to.eq(clientAddress);
      
      console.log(`swapped ${amountIn} DAI to ${amountOut} WETH`);
      console.log(`pool DAI: ${(await realTokens.get('DAI')!.balanceOf(pool.address)).toString()}, WETH: ${(await realTokens.get('WETH')!.balanceOf(pool.address)).toString()}`);
      expect(await realTokens.get('DAI')!.balanceOf(pool.address)).to.eq(DAI_STARTING_AMOUNT.sub(amountIn));
      expect(await realTokens.get('WETH')!.balanceOf(pool.address)).to.eq(WETH_STARTING_AMOUNT.add(amountOut));
      // check swapped amount
    });
    it("swaps via pool: fails with not enough dai",async()=>{
      const DAI_STARTING_AMOUNT = await realTokens.get('DAI')!.balanceOf(pool.address);
      const WETH_STARTING_AMOUNT = await realTokens.get('WETH')!.balanceOf(pool.address);
      console.log(`pool DAI: ${DAI_STARTING_AMOUNT.toString()}, WETH: ${WETH_STARTING_AMOUNT.toString()}`);
      const amountIn = 100*1e9; // 100DAI
      const tokenFrom = DAI_ADDRESS;
      const tokenTo = WETH_ADDRESS;
      const clientAddress = others[0].address;
      const lparams = {
        clientAddress, //address
        tokenFrom, //address
        tokenTo, //address
        amountIn, //uint256
        poolFee: 3000, //uint24
      };
      // console.log('lparams',lparams);
      const receipt:ContractReceipt = await (await pool.serverLiquidate(SWAP_PROTOCOL_ID_UNISWAP,lparams)).wait();
      // console.log('receipt',receipt);
      const event = receipt.events?.filter((x) => {return x.event == "ServerLiquidateSuccess"})[0];
      // console.log('event args',event?.args);
      const {amount:amountOut,token:tokenOut} = event?.args?.amounts[0];
      expect(amountOut).to.gt(0);
      expect(tokenOut).to.eq(tokenTo);
      expect(event?.args?.tokenFrom).to.eq(tokenFrom);
      expect(event?.args?.clientAddress).to.eq(clientAddress);
      
      console.log(`swapped ${amountIn} DAI to ${amountOut} WETH`);
      console.log(`pool DAI: ${(await realTokens.get('DAI')!.balanceOf(pool.address)).toString()}, WETH: ${(await realTokens.get('WETH')!.balanceOf(pool.address)).toString()}`);
      expect(await realTokens.get('DAI')!.balanceOf(pool.address)).to.eq(DAI_STARTING_AMOUNT.sub(amountIn));
      expect(await realTokens.get('WETH')!.balanceOf(pool.address)).to.eq(WETH_STARTING_AMOUNT.add(amountOut));
      // check swapped amount
    });
    
    it('liquidate without approval: should fail',async()=>{
      const DAI_STARING_AMOUNT = await realTokens.get('DAI')!.balanceOf(pool.address);
      expect(DAI_STARING_AMOUNT).to.be.gt(0);
      const DAI_ALLOWANCE = await realTokens.get('DAI')?.allowance(pool.address, liquidationUniswapV3.address);
      expect(DAI_ALLOWANCE).to.equal(0);
      
      expect(liquidationUniswapV3.connect(poolSigner).swap({
        clientAddress: DAI_WALLET_ADDRESS,
        amountIn: DAI_STARING_AMOUNT,
        poolFee: 3000, 
        tokenFrom: DAI_ADDRESS,
        tokenTo: USDT_ADDRESS
      })).to.be.revertedWith("transferFrom failed");
    });

    it('liquidate without sufficient approval: should fail',async()=>{
      const DAI_TOKEN = await realTokens.get('DAI')!;
      const DAI_STARING_AMOUNT = await DAI_TOKEN.balanceOf(pool.address);
      expect(DAI_STARING_AMOUNT).to.be.gt(0);
      
      const APPROVAL_AMOUNT = DAI_STARING_AMOUNT.sub(10)
      
      await (await DAI_TOKEN.connect(poolSigner).approve(liquidationUniswapV3.address, APPROVAL_AMOUNT)).wait();
      
      const DAI_ALLOWANCE = await DAI_TOKEN.allowance(pool.address, liquidationUniswapV3.address);
      expect(DAI_ALLOWANCE).to.equal(APPROVAL_AMOUNT);
      
      expect(liquidationUniswapV3.connect(poolSigner).swap({
        clientAddress: DAI_WALLET_ADDRESS,
        amountIn: DAI_STARING_AMOUNT, // we only approved DAI_START_AMOUNT - 10
        poolFee: 3000, 
        tokenFrom: DAI_ADDRESS,
        tokenTo: USDT_ADDRESS
      })).to.be.revertedWith("transferFrom failed");
    });
    
    it('liquidate to non-existent token: should fail',async()=>{
      const DAI_TOKEN = await realTokens.get('DAI')!;
      const DAI_STARING_AMOUNT = await DAI_TOKEN.balanceOf(pool.address);
      expect(DAI_STARING_AMOUNT).to.be.gt(0);
      
      await (await DAI_TOKEN.connect(poolSigner).approve(liquidationUniswapV3.address, DAI_STARING_AMOUNT)).wait();
      
      const DAI_ALLOWANCE = await DAI_TOKEN.allowance(pool.address, liquidationUniswapV3.address);
      expect(DAI_ALLOWANCE).to.equal(DAI_STARING_AMOUNT);
      
      expect(liquidationUniswapV3.connect(poolSigner).swap({
        clientAddress: DAI_WALLET_ADDRESS,
        amountIn: DAI_STARING_AMOUNT,
        poolFee: 3000, 
        tokenFrom: DAI_ADDRESS,
        tokenTo: SWAP_ROUTER_ADDRESS_UNISWAPV3 // not a valid ERC20 token address
      })).to.be.reverted;
    });

    it('liquidate to invalid fee tiers: should fail',async()=>{
      const DAI_TOKEN = await realTokens.get('DAI')!;
      const DAI_STARING_AMOUNT = await DAI_TOKEN.balanceOf(pool.address);
      expect(DAI_STARING_AMOUNT).to.be.gt(0);
      
      await (await DAI_TOKEN.connect(poolSigner).approve(liquidationUniswapV3.address, DAI_STARING_AMOUNT)).wait();
      
      const DAI_ALLOWANCE = await DAI_TOKEN.allowance(pool.address, liquidationUniswapV3.address);
      expect(DAI_ALLOWANCE).to.equal(DAI_STARING_AMOUNT);
      
      expect(liquidationUniswapV3.connect(poolSigner).swap({
        clientAddress: DAI_WALLET_ADDRESS,
        amountIn: DAI_STARING_AMOUNT,
        poolFee: 0,  // not a valid fee tier
        tokenFrom: DAI_ADDRESS,
        tokenTo: USDT_ADDRESS
      })).to.be.reverted;
    });
  });
  // assert.fail("todo");
  // it("bridgeTransfer", async ()=>{
  //   assert.fail("not implemented");
  // });
});
