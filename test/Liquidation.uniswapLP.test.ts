import { expect, assert } from "chai";
import { ethers, network, upgrades, waffle } from "hardhat";
import { Wallet, BigNumber, BigNumberish, ContractTransaction, ContractReceipt, utils } from 'ethers';
import { InfinityPool } from '../typechain/InfinityPool';
import { LiquidationUniswapLP } from '../typechain/LiquidationUniswapLP';
import { InfinityToken } from '../typechain/InfinityToken';
import { TestERC20 } from '../typechain/TestERC20'
import { IERC721 } from '../typechain/IERC721';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { constants } = ethers;
const createFixtureLoader = waffle.createFixtureLoader;
const decimal:number = 8;
const MINT_AMOUNT:BigNumberish = BigNumber.from(2).pow(255);
const TOKEN_START_AMOUNT:BigNumberish = BigNumber.from(2).pow(60);
const DAI_ADDRESS:string = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const WETH_ADDRESS:string = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDC_ADDRESS:string = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const UNISWAP_LP_WALLET_ADDRESS:string = '0x036d17ed85510f1cb0b2f63ff8fc548bd8f8275e'; //mainnet fork wallet with Uniswap LP token
const UNISWAP_LP_USDC_WETH_TOKEN_ID:number = 267297;
const UNISWAP_LP_WALLET_NO_LIQUIDITY_ADDRESS:string = '0x6dD91BdaB368282dc4Ea4f4beFc831b78a7C38C0'; //mainnet fork wallet with LP token that has 0 liquidity
const UNISWAP_LP_USDC_WETH_NO_LIQUIDITY_TOKEN_ID:number = 62460;
const SWAP_PROTOCOL_ID_UNISWAP_LP:number = 5;
const UNISWAP_NONFUNGIBLE_POSITION_MANAGER:string = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

describe("Liquidation", () => {
  let wallet: Wallet, others: Wallet[];
  let uniswapLPWalletSigner: SignerWithAddress;
  let uniswapLPNoLiquidityWalletSigner: SignerWithAddress;
  let poolBytecode: string;
  let tokenBytecode: string;
  let pool: InfinityPool;
  let poolSigner: SignerWithAddress;
  let poolToken: InfinityToken;
  let liquidationUniswapLP: LiquidationUniswapLP;
  let tokens: TestERC20[] = [];
  let realTokens: Map<string,TestERC20> = new Map();
  let uniswapLPToken:IERC721;
  const fixture = async ()=>{ 
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
            blockNumber: 15121772,
          },
        },
      ],
    });
    const InfinityToken = await ethers.getContractFactory("InfinityToken");
    const InfinityPool = await ethers.getContractFactory("InfinityPool");
    const poolToken: InfinityToken = (await InfinityToken.deploy()) as InfinityToken;
    const pool: InfinityPool = await upgrades.deployProxy(InfinityPool,[poolToken.address,WETH_ADDRESS]) as InfinityPool;
    await poolToken.setPool(pool.address);
    uniswapLPToken = await ethers.getContractAt("IERC721", UNISWAP_NONFUNGIBLE_POSITION_MANAGER);
    const realTokens: Map<string,TestERC20> = new Map();
    realTokens.set('DAI',await ethers.getContractAt("TestERC20", DAI_ADDRESS));
    realTokens.set('WETH',await ethers.getContractAt("TestERC20", WETH_ADDRESS));
    realTokens.set('USDC',await ethers.getContractAt("TestERC20", USDC_ADDRESS));
    const tokens: TestERC20[] = [];
    for(let i=0;i<5;i++){
      tokens[i] = await (await ethers.getContractFactory("TestERC20")).deploy(MINT_AMOUNT) as TestERC20;
    }
    // seed pool eth
    await pool.connect(others[0]).deposit([],[],{value: BigNumber.from(Number.MAX_SAFE_INTEGER-1)});
    // protocol
    const liquidationUniswapLP = await (await ethers.getContractFactory("LiquidationUniswapLP")).deploy(pool.address,uniswapLPToken.address);
    await pool.registerLiquidationProtocol(SWAP_PROTOCOL_ID_UNISWAP_LP,liquidationUniswapLP.address);
    // impersonate
    await network.provider.request({method:"hardhat_impersonateAccount",params:[pool.address]});
    await network.provider.request({method:"hardhat_impersonateAccount",params:[UNISWAP_LP_WALLET_ADDRESS]});
    await network.provider.request({method:"hardhat_impersonateAccount",params:[UNISWAP_LP_WALLET_NO_LIQUIDITY_ADDRESS]});
    await network.provider.request({method:"hardhat_setBalance",params:[pool.address,ethers.utils.hexStripZeros(ethers.utils.parseEther("10000000").toHexString())]});
    poolSigner = await ethers.getSigner(pool.address);
    uniswapLPWalletSigner = await ethers.getSigner(UNISWAP_LP_WALLET_ADDRESS);
    uniswapLPNoLiquidityWalletSigner = await ethers.getSigner(UNISWAP_LP_WALLET_NO_LIQUIDITY_ADDRESS);
    return {liquidationUniswapLP,pool,poolToken,realTokens,tokens,uniswapLPToken};
  }
  let loadFixture: ReturnType<typeof createFixtureLoader>
  before('create fixture loader',async()=>{
    [wallet,...others] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet,...others],waffle.provider);
  });
  beforeEach('load fixture', async()=>{
    ;({liquidationUniswapLP,pool,poolToken,realTokens,tokens,uniswapLPToken} = await loadFixture(fixture));
    // mint 
    // await tokens[0].mint(await uniswapLPWalletSigner.getAddress(),TOKEN_START_AMOUNT);
    // await tokens[0].mint(others[0].address,TOKEN_START_AMOUNT);
    // await tokens[0].mint(others[1].address,TOKEN_START_AMOUNT);
  });

  before('load pool bytecode',async()=>{
    poolBytecode = (await ethers.getContractFactory('InfinityPool')).bytecode;
    tokenBytecode = (await ethers.getContractFactory('TestERC20')).bytecode;
  });

  describe("Liquidate uniswapLP", ()=>{
    beforeEach("empty",async()=>{
    });
    it("deposits uniswap LP",async()=>{
      expect(await uniswapLPToken.ownerOf(UNISWAP_LP_USDC_WETH_TOKEN_ID)).to.eq(uniswapLPWalletSigner.address);
      await uniswapLPToken.connect(uniswapLPWalletSigner).approve(pool.address,UNISWAP_LP_USDC_WETH_TOKEN_ID);
      // await uniswapLPToken.connect(uniswapLPWalletSigner)["safeTransferFrom(address,address,uint256)"](uniswapLPWalletSigner.address,pool.address,UNISWAP_LP_USDC_WETH_TOKEN_ID);
      const receipt:ContractReceipt = await (
        await pool.connect(uniswapLPWalletSigner).deposit([{token:uniswapLPToken.address,amount:UNISWAP_LP_USDC_WETH_TOKEN_ID}],[],{value:0})
      ).wait();
      const event = receipt.events?.filter((x) => {return x.event == "DepositsOrActionsTriggered"})[0];
      expect(event?.args).to.deep.equal([ uniswapLPWalletSigner.address, [[uniswapLPToken.address,BigNumber.from(UNISWAP_LP_USDC_WETH_TOKEN_ID)]], [] ]);
      await pool.serverUpdateBalances([uniswapLPWalletSigner.address],[[{tokenId:uniswapLPToken.address,amount:UNISWAP_LP_USDC_WETH_TOKEN_ID,priceIndex:0,isERC721:true}]],[]);
      expect(await uniswapLPToken.ownerOf(UNISWAP_LP_USDC_WETH_TOKEN_ID)).to.eq(pool.address);
      expect(await pool.balanceOf(uniswapLPWalletSigner.address,uniswapLPToken.address)).to.eq(1);
    });
    it("deposits and withdraws uniswap LP",async()=>{
      expect(await uniswapLPToken.ownerOf(UNISWAP_LP_USDC_WETH_TOKEN_ID)).to.eq(uniswapLPWalletSigner.address);
      await uniswapLPToken.connect(uniswapLPWalletSigner).approve(pool.address,UNISWAP_LP_USDC_WETH_TOKEN_ID);
      // await uniswapLPToken.connect(uniswapLPWalletSigner)["safeTransferFrom(address,address,uint256)"](uniswapLPWalletSigner.address,pool.address,UNISWAP_LP_USDC_WETH_TOKEN_ID);
      await pool.connect(uniswapLPWalletSigner).deposit([{token:uniswapLPToken.address,amount:UNISWAP_LP_USDC_WETH_TOKEN_ID}],[],{value:0});
      await pool.serverUpdateBalances([uniswapLPWalletSigner.address],[[{tokenId:uniswapLPToken.address,amount:UNISWAP_LP_USDC_WETH_TOKEN_ID,priceIndex:0,isERC721:true}]],[]);
      expect(await uniswapLPToken.ownerOf(UNISWAP_LP_USDC_WETH_TOKEN_ID)).to.eq(pool.address);
      expect(await pool.balanceOf(uniswapLPWalletSigner.address,uniswapLPToken.address)).to.eq(1);
      await pool.serverTransferFunds(uniswapLPWalletSigner.address,[{token:uniswapLPToken.address,amount:UNISWAP_LP_USDC_WETH_TOKEN_ID}]);
      expect(await uniswapLPToken.ownerOf(UNISWAP_LP_USDC_WETH_TOKEN_ID)).to.eq(uniswapLPWalletSigner.address);
      expect(await pool.balanceOf(uniswapLPWalletSigner.address,uniswapLPToken.address)).to.eq(0);
    });
    it("withdraws uniswap LP: fails do not own",async()=>{
      expect(await uniswapLPToken.ownerOf(UNISWAP_LP_USDC_WETH_TOKEN_ID)).to.eq(uniswapLPWalletSigner.address);
      await uniswapLPToken.connect(uniswapLPWalletSigner).approve(pool.address,UNISWAP_LP_USDC_WETH_TOKEN_ID);
      // await uniswapLPToken.connect(uniswapLPWalletSigner)["safeTransferFrom(address,address,uint256)"](uniswapLPWalletSigner.address,pool.address,UNISWAP_LP_USDC_WETH_TOKEN_ID);
      await pool.connect(uniswapLPWalletSigner).deposit([{token:uniswapLPToken.address,amount:UNISWAP_LP_USDC_WETH_TOKEN_ID}],[],{value:0});
      await pool.serverUpdateBalances([uniswapLPWalletSigner.address],[[{tokenId:uniswapLPToken.address,amount:UNISWAP_LP_USDC_WETH_TOKEN_ID,priceIndex:0,isERC721:true}]],[]);
      expect(await uniswapLPToken.ownerOf(UNISWAP_LP_USDC_WETH_TOKEN_ID)).to.eq(pool.address);
      expect(await pool.balanceOf(uniswapLPWalletSigner.address,uniswapLPToken.address)).to.eq(1);
      await expect(pool.serverTransferFunds(uniswapLPNoLiquidityWalletSigner.address,[{token:uniswapLPToken.address,amount:UNISWAP_LP_USDC_WETH_TOKEN_ID}])).to.be.revertedWith("Not ERC721 Owner");
    });
    it("liquidates uniswap LP",async()=>{
      const DAI_STARTING_AMOUNT = await realTokens.get('DAI')!.balanceOf(pool.address);
      const WETH_STARTING_AMOUNT = await realTokens.get('WETH')!.balanceOf(pool.address);
      console.log(`pool DAI/WETH: ${DAI_STARTING_AMOUNT}, ${WETH_STARTING_AMOUNT}`);
      await uniswapLPToken.connect(uniswapLPWalletSigner).approve(pool.address,UNISWAP_LP_USDC_WETH_TOKEN_ID);
      // await uniswapLPToken.connect(uniswapLPWalletSigner)["safeTransferFrom(address,address,uint256)"](uniswapLPWalletSigner.address,pool.address,UNISWAP_LP_USDC_WETH_TOKEN_ID);
      await pool.connect(uniswapLPWalletSigner).deposit([{token:uniswapLPToken.address,amount:UNISWAP_LP_USDC_WETH_TOKEN_ID}],[],{value:0});
      await pool.serverUpdateBalances([uniswapLPWalletSigner.address],[[{tokenId:uniswapLPToken.address,amount:UNISWAP_LP_USDC_WETH_TOKEN_ID,priceIndex:0,isERC721:true}]],[]);
      const clientAddress = uniswapLPWalletSigner.address;
      const tokenFrom = uniswapLPToken.address;
      const tokenTo =  '0x0000000000000000000000000000000000000000';
      const amountIn = UNISWAP_LP_USDC_WETH_TOKEN_ID;
      const poolFee =  0;
      const lparams = { clientAddress, tokenFrom, tokenTo, amountIn, poolFee };
      const receipt:ContractReceipt = await (await pool.serverLiquidateERC721(SWAP_PROTOCOL_ID_UNISWAP_LP,lparams)).wait();
      const event = receipt.events?.filter((x) => {return x.event == "ServerLiquidateSuccess"})[0];
      // console.log('event args',event?.args);
      const amountOut1 = event?.args?.amounts[0].amount;
      const amountOut2 = event?.args?.amounts[1].amount;
      expect(event?.args?.amounts.length).to.eq(2);
      expect(event?.args?.amounts[0].token).to.eq(DAI_ADDRESS);
      expect(event?.args?.amounts[1].token).to.eq(WETH_ADDRESS);
      expect(amountOut1).to.gt(0);
      expect(amountOut2).to.gt(0);
      expect(event?.args?.tokenFrom).to.eq(tokenFrom);
      expect(event?.args?.clientAddress).to.eq(clientAddress);
      const DAI_ENDING_AMOUNT = await realTokens.get('DAI')!.balanceOf(pool.address);
      const WETH_ENDING_AMOUNT = await realTokens.get('WETH')!.balanceOf(pool.address);
      console.log(`pool DAI/WETH: ${DAI_ENDING_AMOUNT}, ${WETH_ENDING_AMOUNT}`);
      expect(await realTokens.get('DAI')!.balanceOf(pool.address)).to.eq(DAI_STARTING_AMOUNT.add(amountOut1));
      expect(await realTokens.get('WETH')!.balanceOf(pool.address)).to.eq(WETH_STARTING_AMOUNT.add(amountOut2));
    });
    it("liquidates uniswap LP with no Liquidity",async()=>{
      await uniswapLPToken.connect(uniswapLPNoLiquidityWalletSigner).approve(pool.address,UNISWAP_LP_USDC_WETH_NO_LIQUIDITY_TOKEN_ID);
      // await uniswapLPToken.connect(uniswapLPNoLiquidityWalletSigner)["safeTransferFrom(address,address,uint256)"](uniswapLPNoLiquidityWalletSigner.address,pool.address,UNISWAP_LP_USDC_WETH_NO_LIQUIDITY_TOKEN_ID);
      await pool.connect(uniswapLPNoLiquidityWalletSigner).deposit([{token:uniswapLPToken.address,amount:UNISWAP_LP_USDC_WETH_NO_LIQUIDITY_TOKEN_ID}],[],{value:0});
      await pool.serverUpdateBalances([uniswapLPNoLiquidityWalletSigner.address],[[{tokenId:uniswapLPToken.address,amount:UNISWAP_LP_USDC_WETH_NO_LIQUIDITY_TOKEN_ID,priceIndex:0,isERC721:true}]],[]);
      const clientAddress = uniswapLPNoLiquidityWalletSigner.address;
      const tokenFrom = uniswapLPToken.address;
      const tokenTo =  '0x0000000000000000000000000000000000000000';
      const amountIn = UNISWAP_LP_USDC_WETH_NO_LIQUIDITY_TOKEN_ID;
      const poolFee =  0;
      const lparams = { clientAddress, tokenFrom, tokenTo, amountIn, poolFee };
      await expect(pool.serverLiquidateERC721(SWAP_PROTOCOL_ID_UNISWAP_LP,lparams)).to.be.revertedWith('liquidity is 0');
    });
    it("transfers uniswap LP",async()=>{
      assert.fail("TODO");
    });
  });
  
});
