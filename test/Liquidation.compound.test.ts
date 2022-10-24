import { expect, assert } from "chai";
import { ethers, network, upgrades, waffle } from "hardhat";
import { Wallet, BigNumber, BigNumberish, ContractTransaction, ContractReceipt, utils } from 'ethers';
import { InfinityPool } from '../typechain/InfinityPool';
import { LiquidationCompound } from '../typechain/LiquidationCompound';
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
const CUSDT_ADDRESS:string = '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9';
const CUSDC_ADDRESS:string = '0x39aa39c021dfbae8fac545936693ac917d5e7563';
const CDAI_ADDRESS:string = '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643';
const DAI_WALLET_ADDRESS:string = '0x5d38b4e4783e34e2301a2a36c39a03c45798c4dd'; //mainnet fork wallet with DAI tokens
const CUSDT_WALLET_ADDRESS:string = '0xb99cc7e10fe0acc68c50c7829f473d81e23249cc';
const CDAI_WALLET_ADDRESS:string = '0x30030383d959675ec884e7ec88f05ee0f186cc06';
const SWAP_PROTOCOL_ID_COMPOUND:number = 3;

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
  let liquidationCompound: LiquidationCompound;
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
    realTokens.set('cUSDT',await ethers.getContractAt("TestERC20", CUSDT_ADDRESS));
    realTokens.set('cDAI',await ethers.getContractAt("TestERC20", CDAI_ADDRESS));
    const tokens: TestERC20[] = [];
    for(let i=0;i<5;i++){
      tokens[i] = await (await ethers.getContractFactory("TestERC20")).deploy(MINT_AMOUNT) as TestERC20;
    }
    // seed pool eth
    await pool.connect(others[0]).deposit([],[],{value: BigNumber.from(Number.MAX_SAFE_INTEGER-1)});
    // protocol
    const liquidationCompound = await (await ethers.getContractFactory("LiquidationCompound")).deploy(pool.address);
    await pool.registerLiquidationProtocol(SWAP_PROTOCOL_ID_COMPOUND,liquidationCompound.address);
    // impersonate
    await network.provider.request({method:"hardhat_impersonateAccount",params:[pool.address]});
    await network.provider.request({method:"hardhat_impersonateAccount",params:[DAI_WALLET_ADDRESS]});
    await network.provider.request({method:"hardhat_impersonateAccount",params:[CUSDT_WALLET_ADDRESS]});
    await network.provider.request({method:"hardhat_impersonateAccount",params:[CDAI_WALLET_ADDRESS]});
    await network.provider.request({method:"hardhat_setBalance",params:[pool.address,ethers.utils.hexStripZeros(ethers.utils.parseEther("10000000").toHexString())]});
    poolSigner = await ethers.getSigner(pool.address);
    DAIWalletSigner = await ethers.getSigner(DAI_WALLET_ADDRESS);
    cUSDTWalletSigner = await ethers.getSigner(CUSDT_WALLET_ADDRESS);
    cDAIWalletSigner = await ethers.getSigner(CDAI_WALLET_ADDRESS);
    return {liquidationCompound,pool,poolToken,realTokens,tokens};
  }
  let loadFixture: ReturnType<typeof createFixtureLoader>
  before('create fixture loader',async()=>{
    [wallet,...others] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet,...others],waffle.provider);
  });
  beforeEach('load fixture', async()=>{
    ;({liquidationCompound,pool,poolToken,realTokens,tokens} = await loadFixture(fixture));
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
      await expect((await liquidationCompound.connect(others[0])).transferOwnership(others[1].address)).to.be.reverted
    })

    it('emits event', async () => {
      await expect(liquidationCompound.connect(poolSigner).transferOwnership(others[0].address))
        .to.emit(liquidationCompound, 'OwnershipTransferred')
        .withArgs(poolSigner.address, others[0].address)
    })

    it('cannot be called by original owner', async () => {
      await liquidationCompound.connect(poolSigner).transferOwnership(others[0].address)
      await expect(liquidationCompound.connect(poolSigner).transferOwnership(wallet.address)).to.be.reverted
    })
  });

  describe("Liquidation Protocol Setup",()=>{
    it("registers compound protocol",async()=>{
      expect(await pool.registerLiquidationProtocol(SWAP_PROTOCOL_ID_COMPOUND+1000,liquidationCompound.address)).to.emit(pool,'LiquidationProtocolRegistered');
      // await expect(pool.registerLiquidationProtocol(SWAP_PROTOCOL_ID_COMPOUND+1000,liquidationCompound.address)).to.be.revertedWith("protocol ID dupl.");
    });

    it("transfer DAI to pool",async ()=>{
      expect(await realTokens.get('DAI')!.balanceOf(pool.address)).to.eq(0);
      const amount = await realTokens.get('DAI')!.balanceOf(pool.address);
      expect(await realTokens.get('DAI')!.connect(DAIWalletSigner).approve(pool.address,amount)).to.emit(realTokens.get('DAI')!,'Approval');
      const receipt:ContractReceipt = await (await pool.connect(DAIWalletSigner).deposit([{token:DAI_ADDRESS,amount}],[],{value: BigNumber.from(0)})).wait();
      const event = receipt.events?.filter((x) => {return x.event == "DepositsOrActionsTriggered"})[0];
      expect(event?.args?.sender).to.equal(await DAIWalletSigner.getAddress());
      expect(event?.args?.transfers).to.deep.equal([[DAI_ADDRESS,amount]]);
      expect(await realTokens.get('DAI')!.balanceOf(pool.address)).to.equal(amount);
    })
  });

  describe("Swap: compound", ()=>{
    it("swaps directly: should fail (only owner)",async()=>{
      const lparams = {
        clientAddress: others[0].address, //address
        tokenFrom: CUSDT_ADDRESS, //address
        tokenTo: USDT_ADDRESS, //address
        amountIn: 1*1e8, //uint256
        poolFee: 0, //uint24
      };
      expect((await liquidationCompound.connect(others[0])).swap(lparams)).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it("swaps via pool: cDAI",async()=>{
      const amountIn = 1000*1e8; // 1000 cDAI 
      const CDAI_AMOUNT = await realTokens.get('cDAI')!.balanceOf(CDAI_WALLET_ADDRESS);
      const DAI_AMOUNT = await realTokens.get('DAI')!.balanceOf(CDAI_WALLET_ADDRESS);
      console.log(`wallet cDAI: ${CDAI_AMOUNT.toString()}, DAI: ${DAI_AMOUNT.toString()}`);
      await realTokens.get('cDAI')!.connect(cDAIWalletSigner).approve(pool.address,amountIn);
      await pool.connect(cDAIWalletSigner).deposit([{token:CDAI_ADDRESS,amount:amountIn}],[],{value: 0});

      const CDAI_STARTING_AMOUNT = await realTokens.get('cDAI')!.balanceOf(pool.address);
      const DAI_STARTING_AMOUNT = await realTokens.get('DAI')!.balanceOf(pool.address);
      console.log(`pool cDAI: ${CDAI_STARTING_AMOUNT.toString()}, DAI: ${DAI_STARTING_AMOUNT.toString()}`);
      const tokenFrom = CDAI_ADDRESS;
      const tokenTo = DAI_ADDRESS; // TODO should it be ignored or further swapped to a target token?
      const clientAddress = cDAIWalletSigner.address;
      const lparams = {
        clientAddress, //address
        tokenFrom, //address
        tokenTo, //address
        amountIn, //uint256
        poolFee: 0, //uint24
      };
      // console.log('lparams',lparams);
      const receipt:ContractReceipt = await (await pool.serverLiquidate(SWAP_PROTOCOL_ID_COMPOUND,lparams)).wait();
      // console.log('receipt',receipt);
      const event = receipt.events?.filter((x) => {return x.event == "ServerLiquidateSuccess"})[0];
      // console.log('event args',event?.args);
      const {amount:amountOut,token:tokenOut} = event?.args?.amounts[0];
      expect(amountOut).to.gt(0);
      expect(tokenOut.toLowerCase()).to.eq(tokenTo.toLowerCase());
      expect(event?.args?.tokenFrom?.toLowerCase()).to.eq(tokenFrom.toLowerCase());
      expect(event?.args?.clientAddress?.toLowerCase()).to.eq(clientAddress.toLowerCase());
      
      const CDAI_FINISHED_AMOUNT = await realTokens.get('cDAI')!.balanceOf(pool.address);
      const DAI_FINISHED_AMOUNT = await realTokens.get('DAI')!.balanceOf(pool.address);
      console.log(`swapped ${amountIn} cDAI to ${amountOut} DAI`);
      console.log(`pool cDAI: ${(CDAI_FINISHED_AMOUNT).toString()}, DAI: ${(DAI_FINISHED_AMOUNT).toString()}`);
      expect(DAI_FINISHED_AMOUNT).to.eq(amountOut);
      expect(CDAI_FINISHED_AMOUNT).to.eq(CDAI_STARTING_AMOUNT.sub(amountIn));
      
    });
    it("swaps via pool: cUSDT",async()=>{
      const amountIn = 1000*1e8; // 1000 cUSDT 
      const CUSDT_AMOUNT = await realTokens.get('cUSDT')!.balanceOf(CUSDT_WALLET_ADDRESS);
      const USDT_AMOUNT = await realTokens.get('USDT')!.balanceOf(CUSDT_WALLET_ADDRESS);
      console.log(`wallet cUSDT: ${CUSDT_AMOUNT.toString()}, USDT: ${USDT_AMOUNT.toString()}`);
      await realTokens.get('cUSDT')!.connect(cUSDTWalletSigner).approve(pool.address,amountIn);
      await pool.connect(cUSDTWalletSigner).deposit([{token:CUSDT_ADDRESS,amount:amountIn}],[],{value: 0});

      const CUSDT_STARTING_AMOUNT = await realTokens.get('cUSDT')!.balanceOf(pool.address);
      const USDT_STARTING_AMOUNT = await realTokens.get('USDT')!.balanceOf(pool.address);
      console.log(`pool cUSDT: ${CUSDT_STARTING_AMOUNT.toString()}, USDT: ${USDT_STARTING_AMOUNT.toString()}`);
      const tokenFrom = CUSDT_ADDRESS;
      const tokenTo = USDT_ADDRESS; // TODO should it be ignored or further swapped to a target token?
      const clientAddress = cUSDTWalletSigner.address;
      const lparams = {
        clientAddress, //address
        tokenFrom, //address
        tokenTo, //address
        amountIn, //uint256
        poolFee: 0, //uint24
      };
      // console.log('lparams',lparams);
      const receipt:ContractReceipt = await (await pool.serverLiquidate(SWAP_PROTOCOL_ID_COMPOUND,lparams)).wait();
      // console.log('receipt',receipt);
      const event = receipt.events?.filter((x) => {return x.event == "ServerLiquidateSuccess"})[0];
      // console.log('event args',event?.args);
      const {amount:amountOut,token:tokenOut} = event?.args?.amounts[0];
      expect(amountOut).to.gt(0);
      expect(tokenOut.toLowerCase()).to.eq(tokenTo.toLowerCase());
      expect(event?.args?.tokenFrom?.toLowerCase()).to.eq(tokenFrom.toLowerCase());
      expect(event?.args?.clientAddress?.toLowerCase()).to.eq(clientAddress.toLowerCase());
      
      const CUSDT_FINISHED_AMOUNT = await realTokens.get('cUSDT')!.balanceOf(pool.address);
      const USDT_FINISHED_AMOUNT = await realTokens.get('USDT')!.balanceOf(pool.address);
      console.log(`swapped ${amountIn} cUSDT to ${amountOut} USDT`);
      console.log(`pool cUSDT: ${(CUSDT_FINISHED_AMOUNT).toString()}, USDT: ${(USDT_FINISHED_AMOUNT).toString()}`);
      expect(USDT_FINISHED_AMOUNT).to.eq(amountOut);
      expect(CUSDT_FINISHED_AMOUNT).to.eq(CUSDT_STARTING_AMOUNT.sub(amountIn));
      
    });
  });

  it("swaps via pool: cUSDT: fails with mismatched tokens",async()=>{
    const amountIn = 1000*1e8; // 1000 cUSDT 
    await realTokens.get('cUSDT')!.connect(cUSDTWalletSigner).approve(pool.address,amountIn);
    await pool.connect(cUSDTWalletSigner).deposit([{token:CUSDT_ADDRESS,amount:amountIn}],[],{value: 0});
    const CUSDT_START_AMOUNT = await realTokens.get('cUSDT')!.balanceOf(pool.address);
    console.log(`wallet cUSDT: ${CUSDT_START_AMOUNT.toString()}`);

    const CUSDT_STARTING_AMOUNT = await realTokens.get('cUSDT')!.balanceOf(pool.address);
    console.log(`pool cUSDT: ${CUSDT_STARTING_AMOUNT.toString()}`);
    const tokenFrom = CUSDT_ADDRESS;
    const tokenTo = DAI_ADDRESS; // mismatched token
    const clientAddress = cUSDTWalletSigner.address;
    const lparams = {
      clientAddress, //address
      tokenFrom, //address
      tokenTo, //address
      amountIn, //uint256
      poolFee: 0, //uint24
    };
    // console.log('lparams',lparams);
    await expect(pool.serverLiquidate(SWAP_PROTOCOL_ID_COMPOUND,lparams)).to.be.revertedWith("tokenTo is not underlying asset");
    const CUSDT_FINISHED_AMOUNT = await realTokens.get('cUSDT')!.balanceOf(pool.address);
    console.log(`pool cUSDT: ${(CUSDT_FINISHED_AMOUNT).toString()}}`);
    expect(CUSDT_FINISHED_AMOUNT).to.eq(CUSDT_START_AMOUNT);
    // assert.fail("not implemented");
  });
  // assert.fail("todo");
  // it("bridgeTransfer", async ()=>{
  //   assert.fail("not implemented");
  // });
});
