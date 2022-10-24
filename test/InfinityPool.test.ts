import { expect, assert } from "chai";
import chaiAsPromised from 'chai-as-promised';
import { ethers, network, waffle, getNamedAccounts, deployments } from "hardhat";
import { Wallet, BigNumber, BigNumberish, ContractTransaction, ContractReceipt, utils } from 'ethers';
import { InfinityPool } from '../typechain/InfinityPool';
import { InfinityToken } from '../typechain/InfinityToken';
import { TestERC20 } from '../typechain/TestERC20'
import { IWETH } from '../typechain/IWETH'
import { TestERC721 } from "../typechain/TestERC721";

// register solidity matchers for hexEqual
import chai from "chai";
import { solidity } from "ethereum-waffle";
chai.use(solidity);
chai.use(chaiAsPromised);

const VERSION = 15;
const { constants } = ethers;
const createFixtureLoader = waffle.createFixtureLoader;
const decimal:number = 8;
const MINT_AMOUNT = BigNumber.from(2).pow(255);
const TOKEN_START_AMOUNT = BigNumber.from(2).pow(60);
const TOKEN_PRICE_INDEX = BigNumber.from(10).pow(13).mul(121).div(100); // 1.21*1e13
const WETH_TOKEN_ADDRESS:string = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
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
  let nftA: TestERC721;
  const fixture = async ()=>{
    const {deployer} = await getNamedAccounts();
    const deployerSigner = await ethers.getSigner(deployer);
    await deployments.fixture(['InfinityPool','InfinityToken']);
    const poolDeploy = await deployments.get('InfinityPool');
    const poolTokenDeploy = await deployments.get('InfinityToken');
    const pool = await ethers.getContractAt(poolDeploy.abi,poolDeploy.address,deployerSigner) as InfinityPool;
    const poolToken = await ethers.getContractAt(poolTokenDeploy.abi,poolTokenDeploy.address,deployerSigner) as InfinityToken;
    const wethToken: IWETH = await ethers.getContractAt("IWETH",WETH_TOKEN_ADDRESS) as IWETH;
    const tokenA: TestERC20 = await (await ethers.getContractFactory("TestERC20")).deploy(MINT_AMOUNT) as TestERC20;
    const tokenB: TestERC20 = await (await ethers.getContractFactory("TestERC20")).deploy(MINT_AMOUNT) as TestERC20;
    const tokenC: TestERC20 = await (await ethers.getContractFactory("TestERC20")).deploy(MINT_AMOUNT) as TestERC20;
    const tokens: TestERC20[] = [];
    for(let i=0;i<5;i++){
      tokens[i] = await (await ethers.getContractFactory("TestERC20")).deploy(MINT_AMOUNT) as TestERC20;
    }
    const nftA: TestERC721 = await (await ethers.getContractFactory("TestERC721")).deploy("NFT A", "TestNFT_A");
    return {pool,poolToken,wethToken,tokenA,tokenB,tokenC,tokens,nftA};
  }
  let loadFixture: ReturnType<typeof createFixtureLoader>
  before('create fixture loader',async()=>{
    [wallet, ...others] = waffle.provider.getWallets();
    // [wallet,...others] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet,...others],waffle.provider);
  });
  beforeEach('load fixture', async()=>{
    ;({pool,poolToken,wethToken,tokenA,tokenB,tokenC,tokens,nftA} = await loadFixture(fixture));
    // await wethToken.mint(others[0].address,TOKEN_START_AMOUNT);
    await tokenA.mint(others[0].address,TOKEN_START_AMOUNT);
    await tokenB.mint(others[0].address,TOKEN_START_AMOUNT);
    await tokenC.mint(others[0].address,TOKEN_START_AMOUNT);
    // await wethToken.mint(others[1].address,TOKEN_START_AMOUNT);
    await tokenA.mint(others[1].address,TOKEN_START_AMOUNT);
    await tokenB.mint(others[1].address,TOKEN_START_AMOUNT);
    await tokenC.mint(others[1].address,TOKEN_START_AMOUNT);
    
    await nftA.mint(others[0].address, 0);
    await nftA.mint(others[1].address, 1);
  });

  before('load pool bytecode',async()=>{
    poolBytecode = (await ethers.getContractFactory('InfinityPool')).bytecode;
    tokenBytecode = (await ethers.getContractFactory('TestERC20')).bytecode;
  });

  describe('version', ()=>{
    it(`is version ${VERSION}`,async()=>{
      expect(await pool.version()).to.eq(VERSION);
    })
  });

  describe('Transfers Ownership', () => {
    it('fails if caller is not owner', async () => {
      await expect((await pool.connect(others[0])).transferOwnership(others[1].address)).to.be.reverted
    })

    it('updates owner', async () => {
      await expect(pool.transferOwnership(others[0].address))
        .to.emit(pool, 'OwnershipTransferred')
        .withArgs(wallet.address, others[0].address)
      expect(await pool.owner()).to.eq(others[0].address)
      await pool.connect(others[0]).transferOwnership(wallet.address)
    })

    it('cannot be called by original owner', async () => {
      await pool.transferOwnership(others[0].address)
      await expect(pool.transferOwnership(wallet.address)).to.be.reverted
    })
  })

  describe('Switch PoolToken', () => {
    it('deploys a new token', async () => {
      const InfinityToken = await ethers.getContractFactory("InfinityToken");
      const poolToken: InfinityToken = await InfinityToken.deploy();
      await poolToken.deployed();
      await pool.setInfinityToken(poolToken.address);
      expect(await pool.poolToken()).to.eq(poolToken.address);
    });
  });
  describe('Switch WETHToken', () => {
    it('updates WETH Token address', async () => {
      await pool.setWETH('0x0000000000000000000000000000000000000000');
      expect(await pool.weth()).to.eq('0x0000000000000000000000000000000000000000');
    });
  });

  describe("Deposits", ()=>{
    it("checks account balances",async()=>{
      expect(await tokenA.balanceOf(others[0].address)).to.equal(TOKEN_START_AMOUNT);
      expect(await tokenB.balanceOf(others[0].address)).to.equal(TOKEN_START_AMOUNT);
      expect(await tokenC.balanceOf(others[0].address)).to.equal(TOKEN_START_AMOUNT);
      expect(await tokenA.balanceOf(others[1].address)).to.equal(TOKEN_START_AMOUNT);
      expect(await tokenB.balanceOf(others[1].address)).to.equal(TOKEN_START_AMOUNT);
      expect(await tokenC.balanceOf(others[1].address)).to.equal(TOKEN_START_AMOUNT);
    });
    it("deposits ether & tokens",async()=>{
      const TRANSFER_AMOUNT_ETHER = BigNumber.from(4*1e4);
      const TRANSFER_AMOUNT_TOKEN = BigNumber.from(2).pow(8);
      const userEtherBalance = await waffle.provider.getBalance(others[0].address);
      const poolWETHBalance = await wethToken.balanceOf(pool.address);
      const approvalTx = await tokenA.connect(others[0]).approve(pool.address,TRANSFER_AMOUNT_TOKEN);
      expect(approvalTx).to.emit(tokenA,'Approval').withArgs(others[0].address,pool.address,TRANSFER_AMOUNT_TOKEN);
      const approvalReceipt = await approvalTx.wait();
      const receipt:ContractReceipt = await (
        await pool.connect(others[0]).deposit(
          [{token:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN}],
          []
          ,{value: TRANSFER_AMOUNT_ETHER}
        )
      ).wait();
      console.log('deposits ether & tokens -> WETH gas',receipt.effectiveGasPrice.toString(),receipt.gasUsed.toString());
      // console.log("receipt.events", receipt.events);
      const event = receipt.events?.filter((x) => {return x.event == "DepositsOrActionsTriggered"})[0];
      expect(event?.args).to.deep.equal([
        others[0].address,
        [[tokenA.address,TRANSFER_AMOUNT_TOKEN],[WETH_TOKEN_ADDRESS,TRANSFER_AMOUNT_ETHER]],
        []
      ]);
      
      const gasFeeUsed = approvalReceipt.gasUsed.mul(approvalReceipt.effectiveGasPrice).add(
        receipt.gasUsed.mul(receipt.effectiveGasPrice)
      );
      expect(await tokenA.balanceOf(pool.address)).to.equal(TRANSFER_AMOUNT_TOKEN);
      expect(await tokenA.balanceOf(others[0].address)).to.equal(TOKEN_START_AMOUNT.sub(TRANSFER_AMOUNT_TOKEN));
      expect(await wethToken.balanceOf(pool.address)).to.equal(poolWETHBalance.add(TRANSFER_AMOUNT_ETHER));
      expect(await waffle.provider.getBalance(others[0].address)).to.equal(BigNumber.from(userEtherBalance).sub(TRANSFER_AMOUNT_ETHER).sub(gasFeeUsed));
    });
    it("deposits tokens only",async()=>{
      const TRANSFER_AMOUNT_TOKEN = BigNumber.from(2).pow(8);
      expect(await tokenA.connect(others[0]).approve(pool.address,TRANSFER_AMOUNT_TOKEN)).to.emit(tokenA,'Approval');
      const receipt:ContractReceipt = await (
        await pool.connect(others[0]).deposit(
          [{token:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN}],
          []
          ,{value: BigNumber.from(0)}
        )
      ).wait();
      const event = receipt.events?.filter((x) => {return x.event == "DepositsOrActionsTriggered"})[0];
      console.log('deposits tokens only -> WETH gas',receipt.effectiveGasPrice.toString(),receipt.gasUsed.toString());
      expect(event?.args).to.deep.equal([
        others[0].address,
        [[tokenA.address,TRANSFER_AMOUNT_TOKEN]],
        []
      ]);
      expect(await tokenA.balanceOf(pool.address)).to.equal(TRANSFER_AMOUNT_TOKEN);
    });
    it("deposits tokens: ether only",async()=>{
      const startEth = await others[0].getBalance();
      const startAmount = await wethToken.balanceOf(pool.address);
      const TRANSFER_AMOUNT_TOKEN = BigNumber.from(10).pow(18);
      const gasLimit = await pool.connect(others[0]).estimateGas.deposit(
        [],[]
        ,{value: TRANSFER_AMOUNT_TOKEN}
      );
      console.log('[deposit ether only] gasLimit',gasLimit);
      const receipt:ContractReceipt = await (
        await pool.connect(others[0]).deposit(
          [],[]
          ,{value: TRANSFER_AMOUNT_TOKEN}
        )
      ).wait();
      const endEth = await others[0].getBalance();
      console.log('deposits ether -> WETH gas',receipt.effectiveGasPrice.toString(),receipt.gasUsed.toString());
      console.log(`deposits ether change: ${startEth.toString()} -> deposits ${TRANSFER_AMOUNT_TOKEN.toString()} -> ${endEth.toString()}`);
      const event = receipt.events?.filter((x) => {return x.event == "DepositsOrActionsTriggered"})[0];
      expect(event?.args).to.deep.equal([
        others[0].address,
        [[WETH_TOKEN_ADDRESS,TRANSFER_AMOUNT_TOKEN]],
        []
      ]);
      expect(await wethToken.balanceOf(pool.address)).to.equal(BigNumber.from(startAmount).add(TRANSFER_AMOUNT_TOKEN));
    });
    it("deposits tokens: fails token length overflow",async()=>{
      const TRANSFER_AMOUNT_TOKEN = BigNumber.from(2).pow(8);
      for (const token of tokens) {
        await expect(token.connect(others[0]).approve(pool.address,TRANSFER_AMOUNT_TOKEN)).to.emit(token, 'Approval');
      }
      await expect(pool.connect(others[0]).deposit(
        (new Array(1e2+1).fill(tokens[0])).map((token)=>{
          return {token:token.address,amount:TRANSFER_AMOUNT_TOKEN}
        }),
        []
        ,{value: BigNumber.from(0)}
      )).to.be.revertedWith('Token limit')
    });
    it("deposits tokens: fails with 0-len args",async()=>{
      await expect(pool.connect(others[0]).deposit(
          [],[]
          ,{value: BigNumber.from(0)}
        )
      ).to.be.revertedWith('0-len args');
    });
    it("triggers tokens: fails action length overflow",async()=>{
      await expect(pool.connect(others[0]).deposit(
        [],
        (new Array(1e2+1)).fill(1).map((_v, i)=>{return {action:i,parameters:[i]};})
        ,{value: BigNumber.from(0)}
      )).to.be.revertedWith('Action limit')
    });
    it("deposits tokens and triggers actions",async()=>{
      const TRANSFER_AMOUNT_TOKEN = BigNumber.from(2).pow(8);
      const ACTION_KEY = 1;
      const ACTION_VALUE = BigNumber.from(2).pow(32).sub(1);
      expect(await tokenA.connect(others[0]).approve(pool.address,TRANSFER_AMOUNT_TOKEN)).to.emit(tokenA,'Approval');
      const receipt:ContractReceipt = await (
        await pool.connect(others[0]).deposit(
          [{token:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN}],
          [{action:ACTION_KEY,parameters:[ACTION_VALUE]}]
          ,{value: BigNumber.from(0)}
        )
      ).wait();
      const event = receipt.events?.filter((x) => {return x.event == "DepositsOrActionsTriggered"})[0];
      expect(event?.args?.sender).to.equal(others[0].address);
      expect(event?.args?.transfers).to.deep.equal([[tokenA.address,TRANSFER_AMOUNT_TOKEN]]);
      expect(event?.args?.actions[0]?.action).to.equal(ACTION_KEY);
      expect(event?.args?.actions[0]?.parameters).to.deep.equal([ACTION_VALUE]);
      expect(await tokenA.balanceOf(pool.address)).to.equal(TRANSFER_AMOUNT_TOKEN);
    });
    it("deposits tokens: no approval",async()=>{
      const TRANSFER_AMOUNT_TOKEN = TOKEN_START_AMOUNT;
      await expect(pool.connect(others[0]).deposit(
        [{token:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN}],
        []
        ,{value: BigNumber.from(0)}
      )).to.be.revertedWith('transferFrom failed');
    });
    it("deposits tokens: insufficient token fail",async()=>{
      const TRANSFER_AMOUNT_TOKEN = TOKEN_START_AMOUNT;
      expect(await tokenA.connect(others[0]).approve(pool.address,TRANSFER_AMOUNT_TOKEN)).to.emit(tokenA,'Approval');
      await expect(pool.connect(others[0]).deposit(
        [{token:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN.add(BigNumber.from(1))}],
        []
        ,{value: BigNumber.from(0)}
      )).to.be.revertedWith('Insufficient balance');
    });
    it("deposit tokens: n + 1 failed deposit should cause no transfer for the first n token",async()=>{
      const TRANSFER_AMOUNT_TOKEN = TOKEN_START_AMOUNT;
      await (await tokenA.connect(others[0]).approve(pool.address,TRANSFER_AMOUNT_TOKEN)).wait();
      
      expect(pool.connect(others[0]).deposit(
        [
          {token:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN},
          {token:tokenB.address,amount:TRANSFER_AMOUNT_TOKEN} // tokenB is not approved, transfer will fail
        ],
        []
        ,{value: BigNumber.from(0)}
      )).to.be.reverted;

      expect(await tokenA.balanceOf(others[0].address)).to.equal(TOKEN_START_AMOUNT);
      expect(await pool.balanceOf(others[0].address, tokenA.address)).to.equal(0);
    });
    it("deposits with negative amount: fails with overflow",async()=>{
      await (await tokenA.mint(others[3].address, constants.MaxUint256)).wait();
      expect(await tokenA.balanceOf(others[3].address)).to.equal(constants.MaxUint256);
      await (await tokenA.connect(others[3]).approve(pool.address, constants.MaxUint256)).wait();

      await expect(
        pool.connect(others[3]).deposit([
          {token:tokenA.address,amount:constants.MinInt256}, // this is a negative number
        ], [],)
      ).to.be.rejectedWith('value out-of-bounds');
    });
    it("deposits past uint256 maximum",async()=>{
      await (await tokenA.mint(others[3].address, constants.MaxUint256)).wait();
      expect(await tokenA.balanceOf(others[3].address)).to.equal(constants.MaxUint256);
      await (await tokenA.connect(others[3]).approve(pool.address, constants.MaxUint256)).wait();

      await (await pool.connect(others[3]).deposit([
        // we issue three transfers so the number fits in int256
        {token:tokenA.address,amount:constants.MaxInt256}, 
        {token:tokenA.address,amount:constants.MaxInt256},  
        {token:tokenA.address,amount:BigNumber.from(1)}, 
      ], [])).wait();
      
      expect(await tokenA.balanceOf(pool.address)).to.equal(constants.MaxUint256);
      
      await (await tokenA.connect(others[0]).approve(pool.address, BigNumber.from(1))).wait();
      
      await expect(
        pool.connect(others[0]).deposit([
          {token:tokenA.address,amount:BigNumber.from(1)},
        ], [])
      ).to.be.revertedWith("transferFrom failed");
    });
    it('deposits NFT',async()=>{
      await (await nftA.connect(others[0]).approve(pool.address, 0)).wait();
      expect(await nftA.getApproved(0)).to.hexEqual(pool.address);
      
      await expect(pool.connect(others[0]).deposit([
        { token: nftA.address, amount: 0 } // amount is the token ID
      ], [])).to.emit(nftA, 'Transfer').withArgs(others[0].address, pool.address, 0);
      
      expect(await nftA.ownerOf(0)).to.hexEqual(pool.address);
    });
    it('deposits NFT: fails without approval from owner',async()=>{
      expect(await nftA.getApproved(0)).to.hexEqual(constants.AddressZero);
      
      await expect(pool.connect(others[0]).deposit([
        { token: nftA.address, amount: 0 } // amount is the token ID
      ], [])).to.be.revertedWith("erc721 safeTransferFrom failed");
      
      expect(await nftA.ownerOf(0)).to.hexEqual(others[0].address);
    });
    it('deposits NFT: fails with not the owner',async()=>{
      // others[1] does not own nftA 1, others[0] owns it
      await expect(pool.connect(others[1]).deposit([
        { token: nftA.address, amount: 0 } // amount is the token ID
      ], [])).to.be.revertedWith("Not ERC721 Owner");
      
      expect(await nftA.ownerOf(0)).to.hexEqual(others[0].address);
    });
  });


  describe("withdrawal", ()=>{
    beforeEach("starting account",async ()=>{
      await pool.serverUpdateBalances(
        [others[0].address],[
          [{tokenId:wethToken.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenA.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenB.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenC.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},]
        ],[]
      );
      expect(await poolToken.balanceOf(others[0].address,wethToken.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await poolToken.balanceOf(others[0].address,tokenA.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await poolToken.balanceOf(others[0].address,tokenB.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await poolToken.balanceOf(others[0].address,tokenC.address)).to.equal(TOKEN_START_AMOUNT);
      await network.provider.request({method:"hardhat_setBalance",params:[others[0].address,ethers.utils.hexStripZeros(TOKEN_START_AMOUNT.mul(2).toHexString())]});
      await pool.connect(others[0]).deposit([],[],{value: TOKEN_START_AMOUNT});
      await tokenA.mint(pool.address,TOKEN_START_AMOUNT);
      await tokenB.mint(pool.address,TOKEN_START_AMOUNT);
      await tokenC.mint(pool.address,TOKEN_START_AMOUNT);
      expect(await wethToken.balanceOf(pool.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await tokenA.balanceOf(pool.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await tokenB.balanceOf(pool.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await tokenC.balanceOf(pool.address)).to.equal(TOKEN_START_AMOUNT);
    });
    it("withdraws token: fails insufficient fund",async ()=>{
      const TRANSFER_AMOUNT_TOKEN = TOKEN_START_AMOUNT.add(1);
      await expect(pool.connect(others[0]).requestWithdraw(
        [{token:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN}]
      )).to.be.revertedWith('Insufficient Token');
      expect(await tokenA.balanceOf(pool.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await tokenA.balanceOf(others[0].address)).to.equal(TOKEN_START_AMOUNT);
      expect(await poolToken.balanceOf(others[0].address,tokenA.address)).to.equal(TOKEN_START_AMOUNT);
    });
    
    it("withdraws token: fails pool insufficient fund",async ()=>{
      await pool.serverUpdateBalances(
        [others[0].address],[
          [{tokenId:tokenA.address,amount:TOKEN_START_AMOUNT.add(1),priceIndex:0,isERC721:false}]
        ],[]
      );
      // user has deposited TOKEN_START_AMOUNT + 1 of token, according to the contract
      expect(await poolToken.balanceOf(others[0].address,tokenA.address)).to.equal(TOKEN_START_AMOUNT.add(1))

      await expect(pool.connect(others[0]).requestWithdraw(
        [{token:tokenA.address,amount:TOKEN_START_AMOUNT.add(1)}]
      )).to.be.revertedWith("Insufficient pool Token");
      expect(await tokenA.balanceOf(pool.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await tokenA.balanceOf(others[0].address)).to.equal(TOKEN_START_AMOUNT);
      expect(await poolToken.balanceOf(others[0].address,tokenA.address)).to.equal(TOKEN_START_AMOUNT.add(1));
    });

    it("withdraws token",async ()=>{
      const clientWethBalanceStart = await wethToken.balanceOf(others[0].address);
      const poolWethBalanceStart = await wethToken.balanceOf(pool.address);
      expect(await poolToken.balanceOf(others[0].address,wethToken.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await poolToken.balanceOf(others[0].address,tokenA.address)).to.equal(TOKEN_START_AMOUNT);
      const tokenTransfers = [{token:wethToken.address,amount:TOKEN_START_AMOUNT},{token:tokenA.address,amount:TOKEN_START_AMOUNT}];
      const receipt:ContractReceipt = await (
        await pool.connect(others[0]).requestWithdraw(
          tokenTransfers
        )
      ).wait();
      const event = receipt.events?.filter((x) => {return x.event == "WithdrawalRequested"})[0];
      expect(event?.args?.sender).to.equal(others[0].address);
      const transfer = event?.args?.transfers[0];
      expect(transfer.token).to.equal(tokenTransfers[0].token);
      expect(transfer.amount).to.equal(tokenTransfers[0].amount);
      expect(await pool.serverTransferFunds(
        others[0].address,tokenTransfers
      )).to.emit(pool,'Withdrawal');
      expect(await wethToken.balanceOf(pool.address)).to.equal(poolWethBalanceStart.sub(TOKEN_START_AMOUNT));
      expect(await wethToken.balanceOf(others[0].address)).to.equal(clientWethBalanceStart.add(TOKEN_START_AMOUNT));
      // serverTransferFunds does not update balance
      // expect(await poolToken.balanceOf(others[0].address,wethToken.address)).to.equal(0);
      // expect(await poolToken.balanceOf(others[0].address,tokenA.address)).to.equal(0);
      expect(await tokenA.balanceOf(pool.address)).to.equal(0);
      expect(await tokenA.balanceOf(others[0].address)).to.equal(TOKEN_START_AMOUNT.add(TOKEN_START_AMOUNT));
    });
    it("withdraws with negative amount: fails with overflow",async()=>{
      const TWO_TO_255 = BigNumber.from(2).pow(255);
      await (await (tokenA.mint(pool.address, TWO_TO_255))).wait();
      await (await pool.serverUpdateBalances(
        [others[3].address], 
        [[{tokenId:tokenA.address,amount:TWO_TO_255,priceIndex:0,isERC721:false}]],
        []
      )).wait();
      
      await expect(
        pool.connect(others[3]).requestWithdraw([{ token: tokenA.address, amount: constants.MinInt256 }])
      ).to.be.rejectedWith("value out-of-bounds");
    });
    it("requestWithdraw for NFT",async ()=>{
      const NFT_ID = 3;
      await nftA.mint(pool.address, NFT_ID);
      await (await pool.serverUpdateBalances(
        [others[3].address],
        [[{tokenId:nftA.address,amount:NFT_ID,priceIndex:0,isERC721:true}]],
        []
      )).wait();
      
      expect(await poolToken.ifUserTokenExistsERC721(others[3].address,nftA.address,NFT_ID)).to.be.true;
      
      const receipt:ContractReceipt = await (
        await pool.connect(others[3]).requestWithdraw(
          [{token:nftA.address,amount:NFT_ID}]
        )
      ).wait();
      const event = receipt.events?.filter((x) => {return x.event == "WithdrawalRequested"})[0];
      expect(event?.args?.sender).to.equal(others[3].address);
      const transfer = event?.args?.transfers[0];
      expect(transfer.token).to.equal(nftA.address);
      expect(transfer.amount).to.equal(NFT_ID);
    });
  });
  
  describe("Action", ()=>{
    it('triggers action',async ()=>{
      const ACTION_KEY = 1;
      const ACTION_VALUE = BigNumber.from(2).pow(32).sub(1);
      const receipt:ContractReceipt = await (
        await pool.connect(others[0]).action(
          [{action:ACTION_KEY,parameters:[ACTION_VALUE]}]
        )
      ).wait();
      const event = receipt.events?.filter((x) => {return x.event == "DepositsOrActionsTriggered"})[0];
      expect(event?.args?.sender).to.equal(others[0].address);
      expect(event?.args?.transfers).to.deep.equal([]);
      expect(event?.args?.actions[0]?.action).to.equal(ACTION_KEY);
      expect(event?.args?.actions[0]?.parameters).to.deep.equal([ACTION_VALUE]);
    })
  });
  describe("balanceOf", ()=>{
    beforeEach("starting account",async ()=>{
      await pool.serverUpdateBalances(
        [others[0].address,others[1].address],[
          [{tokenId:WETH_TOKEN_ADDRESS,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenA.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenB.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenC.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}],
          [{tokenId:WETH_TOKEN_ADDRESS,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenA.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenB.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenC.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}],
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
    it('checks balance of user',async ()=>{
      expect(await pool.balanceOf(others[0].address,tokenA.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await pool.balanceOf(others[0].address,tokenB.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await pool.balanceOf(others[0].address,tokenC.address)).to.equal(TOKEN_START_AMOUNT);
      const TRANSFER_AMOUNT_TOKEN = BigNumber.from(2).pow(8);
      await pool.serverUpdateBalances(
        [others[0].address],[
          [{tokenId:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN,priceIndex:0,isERC721:false},{tokenId:tokenB.address,amount:TRANSFER_AMOUNT_TOKEN,priceIndex:0,isERC721:false}],
        ],[]
      );
      expect(await pool.balanceOf(others[0].address,tokenA.address)).to.equal(TRANSFER_AMOUNT_TOKEN);
      expect(await pool.balanceOf(others[0].address,tokenB.address)).to.equal(TRANSFER_AMOUNT_TOKEN);
      expect(await pool.balanceOf(others[0].address,tokenC.address)).to.equal(TOKEN_START_AMOUNT);
    });
  });
  
  describe("serverTransferFunds", ()=>{
    beforeEach("starting account",async ()=>{
      await pool.serverUpdateBalances(
        [others[0].address],[
          [{tokenId:wethToken.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenA.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenB.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenC.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},]
        ],[]
      );
      expect(await poolToken.balanceOf(others[0].address,wethToken.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await poolToken.balanceOf(others[0].address,tokenA.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await poolToken.balanceOf(others[0].address,tokenB.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await poolToken.balanceOf(others[0].address,tokenC.address)).to.equal(TOKEN_START_AMOUNT);
      await network.provider.request({method:"hardhat_setBalance",params:[others[0].address,ethers.utils.hexStripZeros(TOKEN_START_AMOUNT.mul(2).toHexString())]});
      await pool.connect(others[0]).deposit([],[],{value: TOKEN_START_AMOUNT});
      await tokenA.mint(pool.address,TOKEN_START_AMOUNT);
      await tokenB.mint(pool.address,TOKEN_START_AMOUNT);
      await tokenC.mint(pool.address,TOKEN_START_AMOUNT);
      expect(await wethToken.balanceOf(pool.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await tokenA.balanceOf(pool.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await tokenB.balanceOf(pool.address)).to.equal(TOKEN_START_AMOUNT);
      expect(await tokenC.balanceOf(pool.address)).to.equal(TOKEN_START_AMOUNT);
    });
    it("transfer token: fails with insufficient pool token",async()=>{
      await (await pool.serverUpdateBalances(
        [others[0].address], 
        [[{tokenId:tokenA.address,amount:TOKEN_START_AMOUNT.add(1),priceIndex:0,isERC721:false}]], 
        []
      )).wait();
      
      await expect(
        pool.serverTransferFunds(
          others[0].address,
          [{token:tokenA.address,amount:TOKEN_START_AMOUNT.add(1)}]
        )
      ).to.be.revertedWith("Insufficient pool Token");
    });
    it("transfer token: success with insufficient infinity fund",async()=>{
      expect(await pool.balanceOf(others[3].address, tokenC.address)).to.equal(0);
      await expect(
        pool.serverTransferFunds(
          others[3].address,
          [{ token: tokenA.address, amount: BigNumber.from(1) }]
        )
      ).to.emit(pool, 'Withdrawal');//.withArgs(others[3].address,[[tokenA.address,BigNumber.from(1)]]);
    });
    it("transfer token",async()=>{
      const poolBalanceBefore = await tokenA.balanceOf(pool.address);
      await expect(
        pool.serverTransferFunds(others[0].address, [{token:tokenA.address,amount:TOKEN_START_AMOUNT}])
      ).to.emit(pool, 'Withdrawal');//.withArgs(others[0].address,[[tokenA.address,TOKEN_START_AMOUNT]]);
      
      expect(await tokenA.balanceOf(pool.address)).to.equal(poolBalanceBefore.sub(TOKEN_START_AMOUNT));
      // expect(await pool.balanceOf(others[0].address,tokenA.address)).to.equal(0);
    });
    it("transfer token: fails with negative amount",async()=>{
      const TWO_TO_255 = BigNumber.from(2).pow(255);
      await (await pool.serverUpdateBalances(
        [others[3].address],
        [[{tokenId:tokenA.address,amount:TWO_TO_255,priceIndex:0,isERC721:false}]],
        []
      )).wait();
      expect(await pool.balanceOf(others[3].address,tokenA.address)).to.equal(TWO_TO_255);
      await (await (tokenA.mint(pool.address,TWO_TO_255))).wait();
      
      await expect(pool.serverTransferFunds(
        others[3].address,
        [{token:tokenA.address,amount:constants.MinInt256}]
      )).to.be.rejectedWith("value out-of-bounds");
    });
    it("transfer token: transfer max uint256 amount",async()=>{
      await (await tokenA.mint(pool.address, constants.MaxUint256.sub((await tokenA.balanceOf(pool.address))))).wait();
      expect(await tokenA.balanceOf(pool.address)).to.equal(constants.MaxUint256);
      
      await (await pool.serverUpdateBalances(
        [others[3].address],
        [[{tokenId:tokenA.address,amount:constants.MaxUint256,priceIndex:0,isERC721:false}]],
        []
      )).wait();
      
      await expect(pool.serverTransferFunds(
        others[3].address,
        [
          {token:tokenA.address,amount:constants.MaxUint256.div(2)},
          {token:tokenA.address,amount:constants.MaxUint256.div(2)},
          {token:tokenA.address,amount:1},
        ]
      )).to.emit(tokenA, 'Transfer');
      
      expect(await tokenA.balanceOf(others[3].address)).to.equal(constants.MaxUint256);
    });
    it("transfer NFT: fails with not the owner",async()=>{
      await expect(pool.serverTransferFunds(others[3].address, [
        {token:nftA.address,amount:0}
      ])).to.be.revertedWith("approve failed");
    });
    it("transfer NFT",async()=>{
      const NFT_ID = 3214;
      await (await nftA.mint(pool.address,NFT_ID)).wait();
      await (await pool.serverUpdateBalances(
        [others[3].address],
        [[{tokenId:nftA.address,amount:NFT_ID,priceIndex:0,isERC721:false}]],
        []
      )).wait();
      
      await (await pool.serverTransferFunds(others[3].address,[{token:nftA.address,amount:NFT_ID}])).wait();
      
      expect(await nftA.ownerOf(NFT_ID)).to.hexEqual(others[3].address);
      // expect(await poolToken.ifUserTokenExistsERC721(others[3].address,nftA.address,NFT_ID)).to.be.false;
    });
  });


  describe("server triggered action", ()=>{
    beforeEach("starting account",async ()=>{
      await pool.serverUpdateBalances(
        [others[0].address,others[1].address],[
          [{tokenId:WETH_TOKEN_ADDRESS,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenA.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenB.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenC.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}],
          [{tokenId:WETH_TOKEN_ADDRESS,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenA.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenB.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}, {tokenId:tokenC.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false}],
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
    it('fails ownership check in attempting to mint iTokens',async ()=>{
      const TRANSFER_AMOUNT_TOKEN = BigNumber.from(2).pow(8);
      await expect((await pool.connect(others[0])).serverUpdateBalances(
        [others[0].address],[
          [{tokenId:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN,priceIndex:0,isERC721:false}]
        ],[]
      )).to.be.reverted;
      expect(await pool.balanceOf(others[0].address,tokenA.address)).to.equal(TOKEN_START_AMOUNT);
    });
    it('mints iTokens for one user',async ()=>{
      const TRANSFER_AMOUNT_TOKEN = BigNumber.from(2).pow(8);
      expect(await pool.serverUpdateBalances(
        [others[0].address],[
          [{tokenId:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN,priceIndex:0,isERC721:false}]
        ],[]
      )).to.emit(poolToken,'UpdateBatch');
      expect(await pool.balanceOf(others[0].address,tokenA.address)).to.equal(TRANSFER_AMOUNT_TOKEN);
    });
    it('mints iTokens for multiple users',async ()=>{
      const TRANSFER_AMOUNT_TOKEN = BigNumber.from(2).pow(8);
      expect(await pool.serverUpdateBalances(
        [others[0].address,others[1].address],[
          [{tokenId:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN,priceIndex:0,isERC721:false}],
          [{tokenId:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN,priceIndex:0,isERC721:false}],
        ],[]
      )).to.emit(poolToken,'UpdateBatch');
      expect(await poolToken.balanceOf(others[0].address,tokenA.address)).to.equal(TRANSFER_AMOUNT_TOKEN);
      expect(await poolToken.balanceOf(others[1].address,tokenA.address)).to.equal(TRANSFER_AMOUNT_TOKEN);
    });
    it('mints iTokens for multiple users and updates priceIndexes',async ()=>{
      const TRANSFER_AMOUNT_TOKEN = BigNumber.from(2).pow(8);
      const PRICE_INDEX_ID = '0x'+'01'+tokenA.address.slice(2);
      const PRICE_INDEX = BigNumber.from(1.21*1e13);
      const receipt:ContractReceipt = await (
        await pool.serverUpdateBalances(
          [others[0].address,others[1].address],[
            [{tokenId:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN,priceIndex:0,isERC721:false}],
            [{tokenId:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN,priceIndex:0,isERC721:false}],
          ],
          [{key:PRICE_INDEX_ID,value:PRICE_INDEX}]
        )
      ).wait();
      const event = receipt.events?.filter((x) => {return x.event == "PriceIndexesUpdated"})[0];
  // console.log('event?.args?.priceIndexes',event?.args?.priceIndexes,[[PRICE_INDEX_ID,PRICE_INDEX]]);
      expect(event?.args?.priceIndexes[0][0]).to.equal(BigNumber.from(PRICE_INDEX_ID));
      expect(event?.args?.priceIndexes[0][1]).to.equal(PRICE_INDEX);
      expect(await poolToken.balanceOf(others[0].address,tokenA.address)).to.equal(TRANSFER_AMOUNT_TOKEN);
      expect(await poolToken.balanceOf(others[1].address,tokenA.address)).to.equal(TRANSFER_AMOUNT_TOKEN);
    });
    it('updates priceIndexes',async ()=>{
      const PRICE_INDEX_ID = '0x'+'01'+tokenA.address.slice(2);
      const PRICE_INDEX = BigNumber.from(1.21*1e13);
      const receipt:ContractReceipt = await (
        await pool.serverUpdateBalances(
          [],[],
          [{key:PRICE_INDEX_ID,value:PRICE_INDEX}]
        )
      ).wait();
// console.log(receipt);
      const event = receipt.events?.filter((x) => {return x.event == "PriceIndexesUpdated"})[0];
  // console.log('event?.args?.priceIndexes',event?.args?.priceIndexes,[[PRICE_INDEX_ID,PRICE_INDEX]]);
      expect(event?.args?.priceIndexes[0][0]).to.equal(BigNumber.from(PRICE_INDEX_ID));
      expect(event?.args?.priceIndexes[0][1]).to.equal(PRICE_INDEX);
    });
    it('updates productVariables',async ()=>{
      const PRODUCT_VAR_KEY = BigNumber.from(1);
      const PRODUCT_VAR_VALUE = BigNumber.from(1.21*1e13);
      const receipt:ContractReceipt = await (
        await pool.serverUpdateProductVariables(
          [{key:PRODUCT_VAR_KEY,value:PRODUCT_VAR_VALUE}]
        )
      ).wait();
      const event = receipt.events?.filter((x) => {return x.event == "ProductVariablesUpdated"})[0];
      expect(event?.args?.variables).to.deep.equal([[PRODUCT_VAR_KEY,PRODUCT_VAR_VALUE]]);
    });
    it('mints iTokens for one user: fails with mismatched argument length',async ()=>{
      const TRANSFER_AMOUNT_TOKEN = BigNumber.from(2).pow(8);
      await expect(pool.serverUpdateBalances(
        [others[0].address,others[1].address],[
          [{tokenId:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN,priceIndex:0,isERC721:false}]
        ],[]
      )).to.be.revertedWith('args-len Mismatch');
      expect(await poolToken.balanceOf(others[0].address,tokenA.address)).to.equal(TOKEN_START_AMOUNT);
    });
    it('mints iTokens for one user: fails with overflow',async ()=>{
      const TRANSFER_AMOUNT_TOKEN = BigNumber.from(2).pow(256).add(1);
      await expect(pool.serverUpdateBalances(
        [others[0].address],[
          [{tokenId:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN,priceIndex:0,isERC721:false}]
        ],[]
      )).to.be.reverted;
      expect(await poolToken.balanceOf(others[0].address,tokenA.address)).to.equal(TOKEN_START_AMOUNT);
    });
    it('burns iTokens for one user',async ()=>{
      const TRANSFER_AMOUNT_TOKEN = BigNumber.from(0);
      expect(await pool.serverUpdateBalances(
        [others[0].address],[
          [{tokenId:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN,priceIndex:0,isERC721:false}]
        ],[]
      )).to.emit(poolToken,'UpdateBatch');
      expect(await pool.balanceOf(others[0].address,tokenA.address)).to.equal(TRANSFER_AMOUNT_TOKEN);
    });
    it('burns iTokens for multiple users',async ()=>{
      const TRANSFER_AMOUNT_TOKEN = BigNumber.from(0);
      expect(await pool.serverUpdateBalances(
        [others[0].address,others[1].address],[
          [{tokenId:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN,priceIndex:0,isERC721:false}],
          [{tokenId:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN,priceIndex:0,isERC721:false}]
        ],[]
      )).to.emit(poolToken,'UpdateBatch');
      expect(await poolToken.balanceOf(others[0].address,tokenA.address)).to.equal(TRANSFER_AMOUNT_TOKEN);
      expect(await poolToken.balanceOf(others[1].address,tokenA.address)).to.equal(TRANSFER_AMOUNT_TOKEN);
    });
    it('burns iTokens for one user: fails with underflow',async ()=>{
      const TRANSFER_AMOUNT_TOKEN = BigNumber.from(-1)
      await expect(pool.serverUpdateBalances(
        [others[0].address],[
          [{tokenId:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN,priceIndex:0,isERC721:false}]
        ],[]
      )).to.be.reverted;
      expect(await pool.balanceOf(others[0].address,tokenA.address)).to.equal(TOKEN_START_AMOUNT);
    });
    it('mints & burns iTokens for multiple users',async ()=>{
      const TRANSFER_AMOUNT_TOKEN = BigNumber.from(2).pow(8);
      const TRANSFER_AMOUNT_TOKEN_NEG = BigNumber.from(0);
      expect(await pool.serverUpdateBalances(
        [others[0].address,others[1].address],[
          [{tokenId:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN,priceIndex:0,isERC721:false}],
          [{tokenId:tokenA.address,amount:TRANSFER_AMOUNT_TOKEN_NEG,priceIndex:0,isERC721:false}]
        ],[]
      )).to.emit(poolToken,'UpdateBatch');
      expect(await poolToken.balanceOf(others[0].address,tokenA.address)).to.equal(TRANSFER_AMOUNT_TOKEN);
      expect(await poolToken.balanceOf(others[1].address,tokenA.address)).to.equal(TRANSFER_AMOUNT_TOKEN_NEG);
    });
    it('update balance with max uint256',async()=>{
      await expect(pool.serverUpdateBalances(
          [others[0].address],
          [[{tokenId:tokenA.address,amount:constants.MaxUint256,priceIndex:0,isERC721:false}]],
          []
      )).to.emit(poolToken, 'UpdateBatch')
        .withArgs(
          pool.address,
          constants.AddressZero,
          others[0].address,
          [tokenA.address],
          [constants.MaxUint256], 
        );
      
      expect(await pool.balanceOf(others[0].address,tokenA.address)).to.equal(constants.MaxUint256);
      
    });
    it('update balances with repeated token',async()=>{
      await expect(pool.serverUpdateBalances(
        [others[0].address],
        [[
          {tokenId:tokenA.address,amount:BigNumber.from(2).pow(32),priceIndex:0,isERC721:false},
          {tokenId:tokenA.address,amount:BigNumber.from(2).pow(42),priceIndex:0,isERC721:false},
        ]],
        []
      )).to.emit(poolToken, 'UpdateBatch');
      
      expect(await pool.balanceOf(others[0].address,tokenA.address)).to.equal(BigNumber.from(2).pow(42));
    });
    it('update balance of NFT',async()=>{
      const NFT_ID = 0;
      expect(await pool.balanceOf(others[0].address,nftA.address)).to.equal(0);

      await expect(pool.serverUpdateBalances(
        [others[0].address],
        [[{tokenId:nftA.address,amount:NFT_ID,priceIndex:0,isERC721:true}]],
        []
      )).to.emit(poolToken, 'TransferSingle')
        .withArgs(
          pool.address,
          constants.AddressZero,
          others[0].address,
          nftA.address,
          NFT_ID
        );
      
      expect(await pool.balanceOf(others[0].address,nftA.address)).to.equal(1);
      expect(await poolToken.ifUserTokenExistsERC721(others[0].address,nftA.address,0)).to.be.true;
    });
    
    it('change NFT owner: denied (Infinity does not support inter-client NFT transfers)',async()=>{
      const NFT_ID = 3214;
      await (await pool.serverUpdateBalances(
        [others[3].address],
        [[{tokenId:nftA.address,amount:NFT_ID,priceIndex:0,isERC721:true}]],
        []
      )).wait();
      expect(await poolToken.ifUserTokenExistsERC721(others[3].address,nftA.address,NFT_ID)).to.be.true;
      expect(await pool.balanceOf(others[3].address,nftA.address)).to.equal(1);
      expect(await poolToken.ifUserTokenExistsERC721(others[4].address,nftA.address,NFT_ID)).to.be.false;
      expect(await pool.balanceOf(others[4].address,nftA.address)).to.equal(0);
      
      await expect(pool.serverUpdateBalances(
        [others[4].address],
        [[{tokenId:nftA.address,amount:NFT_ID,priceIndex:0,isERC721:true}]],
        []
      )).to.be.revertedWith('ERC721 already owned by another user');

      /* 
      // route taken if Infinity supports inter-client NFT transfers
      // now others[4] owns the NFT
      await expect(pool.serverUpdateBalances(
        [others[4].address],
        [[{tokenId:nftA.address,amount:NFT_ID,priceIndex:0}]],
        []
      )).to.emit(poolToken, 'TransferSingle')
        .withArgs(
          pool.address,
          constants.AddressZero,
          others[4].address,
          nftA.address,
          NFT_ID
        );

      expect(await poolToken.ifUserTokenExistsERC721(others[4].address,nftA.address,NFT_ID)).to.be.true;
      expect(await pool.balanceOf(others[4].address,nftA.address)).to.equal(1);
      expect(await poolToken.ifUserTokenExistsERC721(others[3].address,nftA.address,NFT_ID)).to.be.false;
      expect(await pool.balanceOf(others[3].address,nftA.address)).to.equal(0);
      */
    });
  });

  // it("bridgeTransfer", async ()=>{
  //   assert.fail("not implemented");
  // });
});
