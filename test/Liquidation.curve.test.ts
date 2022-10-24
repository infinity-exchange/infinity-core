import { expect, assert } from "chai";
import { ethers, network, upgrades, waffle } from "hardhat";
import { Wallet, BigNumber, BigNumberish, ContractTransaction, ContractReceipt, utils } from 'ethers';
import { InfinityPool } from '../typechain/InfinityPool';
import { LiquidationCurve } from '../typechain/LiquidationCurve';
import { InfinityToken } from '../typechain/InfinityToken';
import { TestERC20 } from '../typechain/TestERC20'
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { constants } = ethers;
const createFixtureLoader = waffle.createFixtureLoader;
const decimal:number = 8;
const MINT_AMOUNT:BigNumberish = BigNumber.from(2).pow(255);
const TOKEN_START_AMOUNT:BigNumberish = BigNumber.from(2).pow(60);
const ETH_TOKEN_ADDRESS:string = '0x0000000000000000000000000000000000000000';
const DAI_ADDRESS:string = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const WETH_ADDRESS:string = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDC_ADDRESS:string = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const USDT_ADDRESS:string = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const CRV_PROVIDER_ADDRESS:string = '0x0000000022D53366457F9d5E68Ec105046FC4383';
const CRV_TRICRYPTO_ADDRESS:string = '0xcA3d75aC011BF5aD07a98d02f18225F9bD9A6BDF';
const CRV_3CRV_ADDRESS:string = '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490';
const DAI_WALLET_ADDRESS:string = '0x5d38b4e4783e34e2301a2a36c39a03c45798c4dd'; //mainnet fork wallet with DAI tokens
const CRV_3CRV_WALLET_ADDRESS:string = '0x701aecf92edcc1daa86c5e7eddbad5c311ad720c';
const CRV_TRICRYPTO_WALLET_ADDRESS:string = '0xe3a7298fe61e5c8b606227508f236cf0a503c0c3';
const SWAP_PROTOCOL_ID_CURVE:number = 4;

describe("Liquidation", () => {
  let wallet: Wallet, others: Wallet[];
  let DAIWalletSigner: SignerWithAddress;
  let aUSDTWalletSigner: SignerWithAddress;
  let crv3CRVWalletSigner: SignerWithAddress;
  let crvTRICRYPTOWalletSigner: SignerWithAddress;
  let poolBytecode: string;
  let tokenBytecode: string;
  let pool: InfinityPool;
  let poolSigner: SignerWithAddress;
  let poolToken: InfinityToken;
  let liquidationCurve: LiquidationCurve;
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
    realTokens.set('3CRV',await ethers.getContractAt("TestERC20", CRV_3CRV_ADDRESS));
    realTokens.set('TRICRYPTO',await ethers.getContractAt("TestERC20", CRV_TRICRYPTO_ADDRESS));
    const tokens: TestERC20[] = [];
    for(let i=0;i<5;i++){
      tokens[i] = await (await ethers.getContractFactory("TestERC20")).deploy(MINT_AMOUNT) as TestERC20;
    }
    // seed pool eth
    await pool.connect(others[0]).deposit([],[],{value: BigNumber.from(Number.MAX_SAFE_INTEGER-1)});
    // protocol
    const liquidationCurve = await (await ethers.getContractFactory("LiquidationCurve")).deploy(CRV_PROVIDER_ADDRESS,pool.address);
    await pool.registerLiquidationProtocol(SWAP_PROTOCOL_ID_CURVE,liquidationCurve.address);
    // impersonate
    await network.provider.request({method:"hardhat_impersonateAccount",params:[pool.address]});
    await network.provider.request({method:"hardhat_impersonateAccount",params:[DAI_WALLET_ADDRESS]});
    await network.provider.request({method:"hardhat_impersonateAccount",params:[CRV_3CRV_WALLET_ADDRESS]});
    await network.provider.request({method:"hardhat_impersonateAccount",params:[CRV_TRICRYPTO_WALLET_ADDRESS]});
    await network.provider.request({method:"hardhat_setBalance",params:[pool.address,ethers.utils.hexStripZeros(ethers.utils.parseEther("10000000").toHexString())]});
    poolSigner = await ethers.getSigner(pool.address);
    DAIWalletSigner = await ethers.getSigner(DAI_WALLET_ADDRESS);
    crv3CRVWalletSigner = await ethers.getSigner(CRV_3CRV_WALLET_ADDRESS);
    crvTRICRYPTOWalletSigner = await ethers.getSigner(CRV_TRICRYPTO_WALLET_ADDRESS);
    return {liquidationCurve,pool,poolToken,realTokens,tokens};
  }
  let loadFixture: ReturnType<typeof createFixtureLoader>
  before('create fixture loader',async()=>{
    [wallet,...others] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet,...others],waffle.provider);
  });
  beforeEach('load fixture', async()=>{
    ;({liquidationCurve,pool,poolToken,realTokens,tokens} = await loadFixture(fixture));
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
      await expect((await liquidationCurve.connect(others[0])).transferOwnership(others[1].address)).to.be.reverted
    })

    it('emits event', async () => {
      await expect(liquidationCurve.connect(poolSigner).transferOwnership(others[0].address))
        .to.emit(liquidationCurve, 'OwnershipTransferred')
        .withArgs(poolSigner.address, others[0].address)
    })

    it('cannot be called by original owner', async () => {
      await liquidationCurve.connect(poolSigner).transferOwnership(others[0].address)
      await expect(liquidationCurve.connect(poolSigner).transferOwnership(wallet.address)).to.be.reverted
    })
  });

  describe("Swap: curve", ()=>{
    it("swaps directly: should fail (only owner)",async()=>{
      const lparams = {
        clientAddress: others[0].address, //address
        tokenFrom: CRV_3CRV_ADDRESS, //address
        tokenTo: USDT_ADDRESS, //address
        amountIn: 1*1e8, //uint256
        poolFee: 0, //uint24
      };
      expect((await liquidationCurve.connect(others[0])).swap(lparams)).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it("swaps via pool: TRICRYPTO: fails with mismatched tokens",async()=>{
      const amountIn = BigNumber.from("1000000000000000000");
      const CRVTOKEN_AMOUNT = await realTokens.get('TRICRYPTO')!.balanceOf(CRV_TRICRYPTO_WALLET_ADDRESS);
      console.log(`wallet TRICRYPTO: ${CRVTOKEN_AMOUNT.toString()}`);
      await realTokens.get('TRICRYPTO')!.connect(crvTRICRYPTOWalletSigner).approve(pool.address,amountIn);
      await pool.connect(crvTRICRYPTOWalletSigner).deposit([{token:CRV_TRICRYPTO_ADDRESS,amount:amountIn}],[],{value: 0});

      const CRVTOKEN_STARTING_AMOUNT = await realTokens.get('TRICRYPTO')!.balanceOf(pool.address);
      console.log(`pool TRICRYPTO: ${CRVTOKEN_STARTING_AMOUNT.toString()}`);
      const tokenFrom = CRV_TRICRYPTO_ADDRESS;
      const tokenTo = tokens[0].address; // not underlying asset
      const clientAddress = crvTRICRYPTOWalletSigner.address;
      const lparams = {
        clientAddress, //address
        tokenFrom, //address
        tokenTo, //address
        amountIn, //uint256
        poolFee: 0, //uint24
      };
      // console.log('lparams',lparams);
      await expect(pool.serverLiquidate(SWAP_PROTOCOL_ID_CURVE,lparams)).to.be.revertedWith("tokenTo is not underlying asset");
      const CRVTOKEN_FINISHED_AMOUNT = await realTokens.get('TRICRYPTO')!.balanceOf(pool.address);
      console.log(`pool TRICRYPTO: ${(CRVTOKEN_FINISHED_AMOUNT).toString()}}`);
      expect(CRVTOKEN_FINISHED_AMOUNT).to.eq(CRVTOKEN_STARTING_AMOUNT);
      // assert.fail("not implemented");
    });
    it("swaps via pool: TRICRYPTO",async()=>{
      const amountIn = BigNumber.from("1000000000000000000");
      const CRVTOKEN_AMOUNT = await realTokens.get('TRICRYPTO')!.balanceOf(CRV_TRICRYPTO_WALLET_ADDRESS);
      const USDT_AMOUNT = await realTokens.get('USDT')!.balanceOf(CRV_TRICRYPTO_WALLET_ADDRESS);
      console.log(`wallet TRICRYPTO: ${CRVTOKEN_AMOUNT.toString()}, USDT: ${USDT_AMOUNT.toString()}`);
      await realTokens.get('TRICRYPTO')!.connect(crvTRICRYPTOWalletSigner).approve(pool.address,amountIn);
      await pool.connect(crvTRICRYPTOWalletSigner).deposit([{token:CRV_TRICRYPTO_ADDRESS,amount:amountIn}],[],{value: 0});

      const CRVTOKEN_STARTING_AMOUNT = await realTokens.get('TRICRYPTO')!.balanceOf(pool.address);
      const USDT_STARTING_AMOUNT = await realTokens.get('USDT')!.balanceOf(pool.address);
      console.log(`pool TRICRYPTO: ${CRVTOKEN_STARTING_AMOUNT.toString()}, USDT: ${USDT_STARTING_AMOUNT.toString()}`);
      const tokenFrom = CRV_TRICRYPTO_ADDRESS;
      const tokenTo = USDT_ADDRESS; // TODO should it be ignored or further swapped to a target token?
      const clientAddress = crvTRICRYPTOWalletSigner.address;
      const lparams = {
        clientAddress, //address
        tokenFrom, //address
        tokenTo, //address
        amountIn, //uint256
        poolFee: 0, //uint24
      };
      // console.log('lparams',lparams);
      const receipt:ContractReceipt = await (await pool.serverLiquidate(SWAP_PROTOCOL_ID_CURVE,lparams)).wait();
      // console.log('receipt',receipt);
      const event = receipt.events?.filter((x) => {return x.event == "ServerLiquidateSuccess"})[0];
      // console.log('event args',event?.args);
      const {amount:amountOut,token:tokenOut} = event?.args?.amounts[0];
      expect(amountOut).to.gt(0);
      expect(tokenOut?.toLowerCase()).to.eq(tokenTo.toLowerCase());
      expect(event?.args?.tokenFrom?.toLowerCase()).to.eq(tokenFrom.toLowerCase());
      expect(event?.args?.clientAddress?.toLowerCase()).to.eq(clientAddress.toLowerCase());
      
      const CRVTOKEN_FINISHED_AMOUNT = await realTokens.get('TRICRYPTO')!.balanceOf(pool.address);
      const USDT_FINISHED_AMOUNT = await realTokens.get('USDT')!.balanceOf(pool.address);
      console.log(`swapped ${amountIn} TRICRYPTO to ${amountOut} USDT`);
      console.log(`pool TRICRYPTO: ${(CRVTOKEN_FINISHED_AMOUNT).toString()}, USDT: ${(USDT_FINISHED_AMOUNT).toString()}`);
      expect(USDT_FINISHED_AMOUNT).to.eq(amountOut);
      expect(CRVTOKEN_FINISHED_AMOUNT).to.eq(CRVTOKEN_STARTING_AMOUNT.sub(amountIn));
      // assert.fail("not implemented");
    });
    it("swaps via pool: 3CRV",async()=>{
      const amountIn = BigNumber.from("1000000000000000000");
      const CRVTOKEN_AMOUNT = await realTokens.get('3CRV')!.balanceOf(CRV_3CRV_WALLET_ADDRESS);
      const DAI_AMOUNT = await realTokens.get('DAI')!.balanceOf(CRV_3CRV_WALLET_ADDRESS);
      console.log(`wallet 3CRV: ${CRVTOKEN_AMOUNT.toString()}, DAI: ${DAI_AMOUNT.toString()}`);
      await realTokens.get('3CRV')!.connect(crv3CRVWalletSigner).approve(pool.address,amountIn);
      await pool.connect(crv3CRVWalletSigner).deposit([{token:CRV_3CRV_ADDRESS,amount:amountIn}],[],{value: 0});

      const CRVTOKEN_STARTING_AMOUNT = await realTokens.get('3CRV')!.balanceOf(pool.address);
      const DAI_STARTING_AMOUNT = await realTokens.get('DAI')!.balanceOf(pool.address);
      console.log(`pool 3CRV: ${CRVTOKEN_STARTING_AMOUNT.toString()}, DAI: ${DAI_STARTING_AMOUNT.toString()}`);
      const tokenFrom = CRV_3CRV_ADDRESS;
      const tokenTo = DAI_ADDRESS; // TODO should it be ignored or further swapped to a target token?
      const clientAddress = crv3CRVWalletSigner.address;
      const lparams = {
        clientAddress, //address
        tokenFrom, //address
        tokenTo, //address
        amountIn, //uint256
        poolFee: 0, //uint24
      };
      // console.log('lparams',lparams);
      const receipt:ContractReceipt = await (await pool.serverLiquidate(SWAP_PROTOCOL_ID_CURVE,lparams)).wait();
      // console.log('receipt',receipt);
      const event = receipt.events?.filter((x) => {return x.event == "ServerLiquidateSuccess"})[0];
      // console.log('event args',event?.args);
      const {amount:amountOut,token:tokenOut} = event?.args?.amounts[0];
      expect(amountOut).to.gt(0);
      expect(tokenOut.toLowerCase()).to.eq(tokenTo.toLowerCase());
      expect(event?.args?.tokenFrom?.toLowerCase()).to.eq(tokenFrom.toLowerCase());
      expect(event?.args?.clientAddress?.toLowerCase()).to.eq(clientAddress.toLowerCase());
      
      const CRVTOKEN_FINISHED_AMOUNT = await realTokens.get('3CRV')!.balanceOf(pool.address);
      const DAI_FINISHED_AMOUNT = await realTokens.get('DAI')!.balanceOf(pool.address);
      console.log(`swapped ${amountIn} 3CRV to ${amountOut} DAI`);
      console.log(`pool 3CRV: ${(CRVTOKEN_FINISHED_AMOUNT).toString()}, DAI: ${(DAI_FINISHED_AMOUNT).toString()}`);
      expect(DAI_FINISHED_AMOUNT).to.eq(amountOut);
      expect(CRVTOKEN_FINISHED_AMOUNT).to.eq(CRVTOKEN_STARTING_AMOUNT.sub(amountIn));
      // assert.fail("not implemented");
    });
  });
  
  // assert.fail("todo");
  // it("bridgeTransfer", async ()=>{
  //   assert.fail("not implemented");
  // });
});
