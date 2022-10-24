import { expect, assert } from "chai";
import { ethers, upgrades, waffle } from "hardhat";
import { Wallet, BigNumber, ContractReceipt } from 'ethers';
import { InfinityPool } from '../typechain/InfinityPool';
import { InfinityToken } from '../typechain/InfinityToken';
import { TestERC20 } from '../typechain/TestERC20'
import { TestERC721 } from "../typechain";

// TODO unit test

const { constants } = ethers;
const STATE_IDS: {[key:string]:number} = {
  'UPDATE_TIME':0,
  'INDEX':1,
  'INTEREST_RATE':2,
};
const TOKEN_IDS: {[key:string]:number} = {
  'ETH':10000,
  'USDT':20000,
  'USDC':30000,
  'COIN4':40000,
  'COIN5':50000,
  'COIN6':60000,
};
const PRODUCT_ID_FRAGMENTS: {[key:string]:number} = { // TOKEN_ID+PRODUCT_ID_FRAGMENT gives actual product id
  'CASH':0,
  'DEPOSIT':1,
  'PROD2':2,
  'PROD3':3,
  'PROD4':4,
};
const PRODUCT_NFT_ID: number = 1000000; // unique id
const MINT_AMOUNT = BigNumber.from(2).pow(255);
const createFixtureLoader = waffle.createFixtureLoader;
const WETH_TOKEN_ADDRESS:string = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

describe("InfinityToken", () => {
  let owner: Wallet, others: Wallet[];
  let tokenBytecode: string;
  let token: InfinityToken;
  let pool: InfinityPool;
  let tokenA: TestERC20;
  let tokenB: TestERC20;
  let tokenC: TestERC20;
  let nftA: TestERC721;
  const fixture = async ()=>{
    const InfinityToken = await ethers.getContractFactory("InfinityToken");
    const InfinityPool = await ethers.getContractFactory("InfinityPool");
    const token: InfinityToken = (await InfinityToken.deploy()) as InfinityToken;
    const pool: InfinityPool = await upgrades.deployProxy(InfinityPool,[token.address,WETH_TOKEN_ADDRESS]) as InfinityPool;
    await token.setPool(pool.address);
    const tokenA: TestERC20 = await (await ethers.getContractFactory("TestERC20")).deploy(MINT_AMOUNT) as TestERC20;
    const tokenB: TestERC20 = await (await ethers.getContractFactory("TestERC20")).deploy(MINT_AMOUNT) as TestERC20;
    const tokenC: TestERC20 = await (await ethers.getContractFactory("TestERC20")).deploy(MINT_AMOUNT) as TestERC20;
    const nftA: TestERC721 = await (await ethers.getContractFactory("TestERC721")).deploy("NFT A", "TestNFT_A");
    return {pool,token,tokenA,tokenB,tokenC,nftA};
  }

  let loadFixture: ReturnType<typeof createFixtureLoader>
  before('create fixture loader',async()=>{
    [owner,...others] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader()
  });
  before('load token bytecode',async()=>{
    tokenBytecode = (await ethers.getContractFactory('InfinityToken')).bytecode;
  });
  beforeEach('deploy token', async()=>{
    ;({pool,token,tokenA,tokenB,tokenC,nftA} = await loadFixture(fixture));
  });
  describe("Transfers",()=>{
    const startAmount = BigNumber.from(2*1e8);
    const transferAmount = BigNumber.from(5*1e7);
    beforeEach('deposit token to users', async()=>{
      const tokenAddresses = [tokenA.address,tokenB.address,tokenC.address];
      const tokenAmounts = tokenAddresses.map(()=>startAmount);
      expect((await token.deposit(others[0].address,tokenAddresses,tokenAmounts))).to.emit(token,'TransferBatch');
      expect((await token.deposit(others[1].address,tokenAddresses,tokenAmounts))).to.emit(token,'TransferBatch');
    });
    it("checks token from user deposit", async function () {
      const clientAddress = others[0].address;
      const tokenAddresses = [tokenA.address,tokenB.address,tokenC.address];
      tokenAddresses.map(async (tokenAddress,i)=>{
        expect((await token.balanceOf(clientAddress,BigNumber.from(tokenAddress)))).to.eq(startAmount);
        expect(await token.priceIndexOf(clientAddress,BigNumber.from(tokenAddress))).to.eq(0);
      })
    });
    it("transfers token from user 1 to user 2", async function () {
      const fromAddress = others[0].address;
      const toAddress = others[1].address;
      const tokenAddress = tokenA.address;

      expect((await token.transfer(fromAddress,toAddress,[tokenAddress],[transferAmount]))).to.emit(token,'TransferBatch');

      expect((await token.balanceOf(fromAddress,BigNumber.from(tokenAddress)))).to.eq(startAmount.sub(transferAmount));
      expect((await token.balanceOf(toAddress,BigNumber.from(tokenAddress)))).to.eq(startAmount.add(transferAmount));

    });
    it("transfers token from user 1 to user 2: insufficient fund fail", async function () {
      const fromAddress = others[0].address;
      const toAddress = others[1].address;
      const tokenAddress = tokenA.address;

      await expect(token.transfer(fromAddress,toAddress,[tokenAddress],[startAmount.add(1)])).to.be.revertedWith("ERC1155: insufficient balance for transfer");

      expect((await token.balanceOf(fromAddress,BigNumber.from(tokenAddress)))).to.eq(startAmount);
      expect((await token.balanceOf(toAddress,BigNumber.from(tokenAddress)))).to.eq(startAmount);

    });
    it("transfers token from user 1 to user 2 by user 1: approval fail", async function () {
      const fromAddress = others[0].address;
      const toAddress = others[1].address;
      const tokenAddress = tokenA.address;

      await expect(token.connect(others[0]).safeBatchTransferFrom(fromAddress,toAddress,[tokenAddress],[transferAmount],[])).to.be.revertedWith("caller is not pool");

      expect((await token.balanceOf(fromAddress,BigNumber.from(tokenAddress)))).to.eq(startAmount);
      expect((await token.balanceOf(toAddress,BigNumber.from(tokenAddress)))).to.eq(startAmount);
    });
    it("transfers product token for user 1", async function () {
      const userAddress = others[0].address;
      const tokenId = TOKEN_IDS.ETH;
      const compoundId1 = tokenId+PRODUCT_ID_FRAGMENTS.DEPOSIT;
      const compoundId2 = tokenId+PRODUCT_ID_FRAGMENTS.PROD2;
      const uniqueProductId = PRODUCT_NFT_ID;
      const compoundAmount1 = BigNumber.from(5*1e8);
      const compoundAmount2 = BigNumber.from(25*1e7);

      expect((await token.moveProducts(userAddress,[compoundId1,compoundId2,uniqueProductId],[compoundAmount1,compoundAmount2,1],[],[]))).to.emit(token,'TransferBatch');

      expect((await token.balanceOf(userAddress,compoundId1))).to.eq(compoundAmount1);
      expect((await token.balanceOf(userAddress,compoundId2))).to.eq(compoundAmount2);
      expect((await token.balanceOf(userAddress,uniqueProductId))).to.eq(1);

      const compoundAmount1Batch2 = BigNumber.from(-5*1e8);
      const compoundAmount2Batch2 = BigNumber.from(5*1e7);

      expect((await token.moveProducts(userAddress,[compoundId2],[compoundAmount2Batch2],[compoundId1],[compoundAmount1Batch2.abs()]))).to.emit(token,'TransferBatch');

      expect((await token.balanceOf(userAddress,compoundId1))).to.eq(compoundAmount1.add(compoundAmount1Batch2));
      expect((await token.balanceOf(userAddress,compoundId2))).to.eq(compoundAmount2.add(compoundAmount2Batch2));

    });
  });
  describe("ERC20",()=>{
    const startAmount = BigNumber.from(10).pow(18).mul(10);
    beforeEach('deposit token to users', async()=>{
      const tokenAddresses = [tokenA.address,tokenB.address,tokenC.address];
      const tokenAmounts = tokenAddresses.map(()=>startAmount);
      expect((await token.deposit(others[0].address,tokenAddresses,tokenAmounts))).to.emit(token,'TransferBatch');
      expect((await token.deposit(others[1].address,tokenAddresses,tokenAmounts))).to.emit(token,'TransferBatch');
    });
    it("gets balance of interest bearing token", async function () {
      const LEND_TOKEN_A_ID = BigNumber.from(tokenA.address).add(BigNumber.from(2).pow(160).mul(1));
      const TOKEN_POSITION_PRICE_INDEX = BigNumber.from(10).pow(13).mul(101).div(100);
      const TOKEN_CURRENT_PRICE_INDEX = BigNumber.from(10).pow(13).mul(131).div(100);
      const clientAddress = others[0].address;
      const tokenAmount = BigNumber.from(10).pow(18).mul(2);
      // update wallet
      await pool.serverUpdateBalances([clientAddress],[[
        {tokenId:LEND_TOKEN_A_ID,amount:tokenAmount,priceIndex:TOKEN_POSITION_PRICE_INDEX,isERC721:false}
      ]],[
        {key:LEND_TOKEN_A_ID,value:TOKEN_POSITION_PRICE_INDEX}
      ]);
      const tokenBalanceStart = await token.balanceOf(clientAddress,BigNumber.from(LEND_TOKEN_A_ID));
      expect(tokenBalanceStart).to.eq(tokenAmount);
// console.log('tokenBalanceStart',tokenBalanceStart);
      // update pool price index
      await pool.serverUpdateBalances([clientAddress],[[
        {tokenId:tokenA.address,amount:tokenAmount,priceIndex:0,isERC721:false}
      ]],[
        {key:LEND_TOKEN_A_ID,value:TOKEN_CURRENT_PRICE_INDEX}
      ]);
      const tokenCurrentPriceIndex = await pool.priceIndex(LEND_TOKEN_A_ID);
      const tokenPositionPriceIndex = await token.priceIndexOf(clientAddress,LEND_TOKEN_A_ID);
// console.log('tokenCurrentPriceIndex',tokenCurrentPriceIndex);
// console.log('tokenPositionPriceIndex',tokenPositionPriceIndex);
      expect(tokenCurrentPriceIndex).to.eq(TOKEN_CURRENT_PRICE_INDEX);
      expect(tokenPositionPriceIndex).to.eq(TOKEN_POSITION_PRICE_INDEX);
      const tokenBalanceEnd = await token.balanceOf(clientAddress,BigNumber.from(LEND_TOKEN_A_ID));
// console.log('tokenBalanceEnd',tokenBalanceEnd);
      const priceFactor = tokenCurrentPriceIndex.sub(tokenPositionPriceIndex).add(10000000000000).toNumber()/10000000000000;
// console.log('priceFactor',priceFactor);
      expect(tokenBalanceEnd).to.eq(tokenAmount.mul(tokenCurrentPriceIndex.sub(tokenPositionPriceIndex).add(10000000000000)).div(10000000000000));
      expect(await token.balanceOf(clientAddress,tokenA.address)).to.eq(tokenAmount);
    });
  });
  describe("deposit",()=>{
    it('deposit erc20',async()=>{
      const DEPOSIT_AMOUNT = BigNumber.from(2).pow(10);
      expect(await token.balanceOf(others[0].address, tokenA.address)).to.equal(0);
      await (await token.deposit(others[0].address,[tokenA.address],[DEPOSIT_AMOUNT])).wait();
      expect(await token.balanceOf(others[0].address, tokenA.address)).to.equal(DEPOSIT_AMOUNT);
    });
    it('deposit multiple erc20',async()=>{
      const DEPOSIT_AMOUNT = BigNumber.from(2).pow(10);
      expect(await token.balanceOf(others[0].address, tokenA.address)).to.equal(0);
      expect(await token.balanceOf(others[0].address, tokenB.address)).to.equal(0);
      await (await token.deposit(others[0].address,[tokenA.address,tokenB.address],[DEPOSIT_AMOUNT,DEPOSIT_AMOUNT])).wait();
      expect(await token.balanceOf(others[0].address, tokenA.address)).to.equal(DEPOSIT_AMOUNT);
      expect(await token.balanceOf(others[0].address, tokenB.address)).to.equal(DEPOSIT_AMOUNT);
    });
    it('deposit multiple of the same erc20',async()=>{
      const DEPOSIT_AMOUNT = BigNumber.from(2).pow(10);
      expect(await token.balanceOf(others[0].address, tokenA.address)).to.equal(0);
      await (await token.deposit(others[0].address,[tokenA.address,tokenA.address],[DEPOSIT_AMOUNT,DEPOSIT_AMOUNT])).wait();
      expect(await token.balanceOf(others[0].address, tokenA.address)).to.equal(DEPOSIT_AMOUNT.mul(2));
    });
    it('cannot deposit NFT',async()=>{
      const NFT_ID = 10;
      await expect(token.deposit(others[0].address,[nftA.address],[NFT_ID])).to.be.revertedWith("ERC721 not accepted");
    });
    it('deposit with max uint256',async()=>{
      await expect(token.deposit(others[0].address,[tokenA.address],[constants.MaxUint256]))
        .to.emit(token, 'TransferBatch')
        .withArgs(owner.address,constants.AddressZero,others[0].address,[tokenA.address],[constants.MaxUint256]);
      expect(await token.balanceOf(others[0].address, tokenA.address)).to.equal(constants.MaxUint256);
    });
    it('deposit: fails with overflow ',async()=>{
      await expect(token.deposit(others[0].address,[tokenA.address,tokenA.address],[constants.MaxUint256,1]))
        .to.be.revertedWith('panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)');
    });
    it('deposit: fails with deposit to zero address',async()=>{
      await expect(token.deposit(constants.AddressZero,[tokenA.address],[1]))
        .to.be.revertedWith("ERC1155: mint to the zero address");
    });
    it('deposit: fails with arg length mismatch',async()=>{
      await expect(token.deposit(others[1].address,[tokenA.address],[1,2]))
        .to.be.revertedWith("ERC1155: ids and amounts length mismatch");
    });
  });
  
  describe("withdraw", ()=>{
    const TOKEN_START_AMOUNT = BigNumber.from(2).pow(32);
    beforeEach("deposit token",async()=>{
      await token.updateBalance(others[0].address, [
        {tokenId:tokenA.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:tokenB.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:tokenC.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:nftA.address,amount:0,priceIndex:0,isERC721:false}
      ]);
      await token.updateBalance(others[1].address, [
        {tokenId:tokenA.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:tokenB.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:tokenC.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:nftA.address,amount:1,priceIndex:0,isERC721:false}
      ]);
    });
    it("withdraw erc20 success",async()=>{
      const startAmount = await token.balanceOf(others[0].address,tokenA.address);
      const WITHDRAWAL_AMOUNT = BigNumber.from(2).pow(16);
      await expect(token.withdraw(others[0].address,[tokenA.address],[WITHDRAWAL_AMOUNT]))
        .to.emit(token,'TransferBatch')
        .withArgs(owner.address,others[0].address,constants.AddressZero,[tokenA.address],[WITHDRAWAL_AMOUNT]);
      
      expect(await token.balanceOf(others[0].address,tokenA.address)).to.equal(startAmount.sub(WITHDRAWAL_AMOUNT));
    });
    it("withdraw multiple erc20 success",async()=>{
      const startAmount = await token.balanceOf(others[0].address,tokenA.address);
      const WITHDRAWAL_AMOUNT = BigNumber.from(2).pow(16);
      const WITHDRAWAL_TOKENS = [tokenA.address,tokenB.address,tokenC.address];
      const WITHDRAWAL_AMOUNTS = WITHDRAWAL_TOKENS.map(()=>WITHDRAWAL_AMOUNT);
      await expect(token.withdraw(others[0].address,WITHDRAWAL_TOKENS,WITHDRAWAL_AMOUNTS))
        .to.emit(token,'TransferBatch')
        .withArgs(owner.address,others[0].address,constants.AddressZero,WITHDRAWAL_TOKENS,WITHDRAWAL_AMOUNTS);
      
      expect(await token.balanceOf(others[0].address,tokenA.address)).to.equal(startAmount.sub(WITHDRAWAL_AMOUNT));
      expect(await token.balanceOf(others[0].address,tokenB.address)).to.equal(startAmount.sub(WITHDRAWAL_AMOUNT));
      expect(await token.balanceOf(others[0].address,tokenC.address)).to.equal(startAmount.sub(WITHDRAWAL_AMOUNT));
    });
    it("withdraw erc20: fail with not enough balance",async()=>{
      await expect(token.withdraw(others[0].address,[tokenA.address],[TOKEN_START_AMOUNT.add(1)]))
        .to.be.revertedWith("ERC1155: burn amount exceeds balance");
    });
    it("withdraw erc20: fail with underflow",async()=>{
      await expect(token.withdraw(others[0].address,[tokenA.address,tokenA.address],[TOKEN_START_AMOUNT,1]))
        .to.be.revertedWith("ERC1155: burn amount exceeds balance");
    });
    it("withdraw NFT success",async()=>{
      const NFT_ID = 0;
      expect(await token.ifUserTokenExistsERC721(others[0].address,nftA.address,NFT_ID)).to.be.true;
      await expect(token.withdraw(others[0].address,[nftA.address],[NFT_ID]))
        .to.emit(token, 'TransferSingle')
        .withArgs(owner.address,others[0].address,constants.AddressZero,nftA.address,NFT_ID);
        
      expect(await token.ifUserTokenExistsERC721(others[0].address,nftA.address,NFT_ID)).to.be.false;
    });
    it("withdraw NFT with ID success",async()=>{
      const NFT_ID = 1;
      await expect(token.withdraw(others[1].address,[nftA.address],[NFT_ID]))
        .to.emit(token, 'TransferSingle')
        .withArgs(owner.address,others[1].address,constants.AddressZero,nftA.address,NFT_ID);
    });
    it("withdraw NFT: failed with not-owned by user",async()=>{
      const NFT_ID = 1;
      expect(await token.ifUserTokenExistsERC721(others[0].address,nftA.address,NFT_ID)).to.be.false;
      await expect(token.withdraw(others[0].address,[nftA.address],[NFT_ID]))
        .to.be.revertedWith("ERC721: already belongs to another address");
    });
    it("withdraw NFT should emit empty TransferBatch",async()=>{
      const NFT_ID = 1;
      await expect(token.withdraw(others[1].address,[nftA.address],[NFT_ID]))
        .to.emit(token, 'TransferBatch')
        .withArgs(owner.address, others[1].address, constants.AddressZero, [0], [0]);
    });
    it('withdraw: fails with arg length mismatch',async()=>{
      await expect(token.withdraw(others[1].address,[tokenA.address],[1,2]))
        .to.be.revertedWith("ERC1155: ids and amounts length mismatch");
    });
  });

  describe("transfer",()=>{
    const TOKEN_START_AMOUNT = BigNumber.from(2).pow(32);
    beforeEach("deposit token",async()=>{
      await token.updateBalance(others[0].address, [
        {tokenId:tokenA.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:tokenB.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:tokenC.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:nftA.address,amount:0,priceIndex:0,isERC721:false}
      ]);
      await token.updateBalance(others[1].address, [
        {tokenId:tokenA.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:tokenB.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:tokenC.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:nftA.address,amount:1,priceIndex:0,isERC721:false}
      ]);
    });
    
    it("transfer erc20 tokens",async()=>{
      const TOKEN_TRANSFER_AMOUNT = BigNumber.from(2).pow(24);
      const userA = others[0];
      const userB = others[1];
      const userAStartingAmount = await token.balanceOf(userA.address,tokenA.address);
      await expect(token.transfer(userA.address,userB.address,[tokenA.address],[TOKEN_TRANSFER_AMOUNT]))
        .to.emit(token, 'TransferBatch')
        .withArgs(owner.address,userA.address,userB.address,[tokenA.address],[TOKEN_TRANSFER_AMOUNT]);
      
      expect(await token.balanceOf(userA.address,tokenA.address)).to.equal(userAStartingAmount.sub(TOKEN_TRANSFER_AMOUNT));
    });

    it("transfer erc20 tokens: fail with insufficient balance",async()=>{
      await expect(token.transfer(others[0].address,others[1].address,[tokenA.address],[TOKEN_START_AMOUNT.add(1)]))
        .to.be.revertedWith("ERC1155: insufficient balance for transfer");
    });

    it("transfer erc20 tokens: fail with underflow",async()=>{
      await expect(token.transfer(others[0].address,others[1].address,[tokenA.address,tokenA.address],[TOKEN_START_AMOUNT,1]))
        .to.be.revertedWith("ERC1155: insufficient balance for transfer");
    });
    
    it("cannot transfer NFT",async()=>{
      await expect(token.transfer(others[0].address,others[1].address,[nftA.address,1],[0]))
        .to.be.revertedWith("cannot transfer ERC721 token");
    });
    
    it("transfer: fail with different length of argument",async()=>{
      await expect(token.transfer(others[0].address,others[1].address,[tokenA.address],[1, 2]))
        .to.be.revertedWith("ERC1155: ids and amounts length mismatch");
    });
    
    it("transfer: fail with transferring to zero address",async()=>{
      await expect(token.transfer(others[0].address,constants.AddressZero,[tokenA.address],[1]))
        .to.be.revertedWith("ERC1155: transfer to the zero address");
    });
  });
  
  describe("moveProducts",async()=>{
    const TOKEN_START_AMOUNT = BigNumber.from(2).pow(32);
    beforeEach("deposit token",async()=>{
      await token.updateBalance(others[0].address, [
        {tokenId:tokenA.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:tokenB.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:tokenC.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:nftA.address,amount:0,priceIndex:0,isERC721:false}
      ]);
      await token.updateBalance(others[1].address, [
        {tokenId:tokenA.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:tokenB.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:tokenC.address,amount:TOKEN_START_AMOUNT,priceIndex:0,isERC721:false},
        {tokenId:nftA.address,amount:1,priceIndex:0,isERC721:false}
      ]);
    });
    
    it("move products",async()=>{
      const MINT_AMOUNT = BigNumber.from(1000);
      const BURN_AMOUNT = BigNumber.from(200);
      const preMintAmount = await token.balanceOf(others[0].address,tokenA.address);
      const preBurnAmount = await token.balanceOf(others[0].address,tokenB.address);
      await expect(token.moveProducts(others[0].address,[tokenA.address],[MINT_AMOUNT],[tokenB.address],[BURN_AMOUNT]))
        .to.emit(token,'TransferBatch');
      
      expect(await token.balanceOf(others[0].address,tokenA.address)).to.equal(preMintAmount.add(MINT_AMOUNT));
      expect(await token.balanceOf(others[0].address,tokenB.address)).to.equal(preBurnAmount.sub(BURN_AMOUNT));
    });
    
    it("should not be minting NFT",async()=>{
      const NFT_ID = 3;
      const BURN_AMOUNT = BigNumber.from(200);
      await expect(token.moveProducts(others[0].address,[nftA.address],[NFT_ID],[tokenB.address],[BURN_AMOUNT]))
        .to.be.revertedWith('cannot transfer ERC721 token');
    });

    it("should not be burning NFT",async()=>{
      const NFT_ID = 0;
      const MINT_AMOUNT = BigNumber.from(200);
      await expect(token.moveProducts(others[0].address,[tokenC.address],[MINT_AMOUNT],[nftA.address],[NFT_ID]))
        .to.be.revertedWith('cannot transfer ERC721 token');
    });
    
    it("fail: insufficient balance",async()=>{
      await expect(token.moveProducts(others[0].address,[],[],[tokenA.address],[TOKEN_START_AMOUNT.add(1)]))
        .to.be.revertedWith('ERC1155: burn amount exceeds balance');
    });
    
    it("fail: underflow when burning",async()=>{
      await expect(token.moveProducts(others[0].address,[],[],[tokenA.address,tokenA.address],[TOKEN_START_AMOUNT, 1]))
        .to.be.revertedWith('ERC1155: burn amount exceeds balance');
    });

    it("fail: overflow when minting",async()=>{
      await expect(token.moveProducts(others[0].address,[tokenA.address],[constants.MaxUint256],[],[]))
        .to.be.revertedWith('panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)');
    });
    
    it("fail: mismatch mint length",async()=>{
      await expect(token.moveProducts(others[0].address,[tokenA.address],[1, 2],[],[]))
        .to.be.revertedWith('ERC1155: ids and amounts length mismatch');
    });

    it("fail: mismatch burn length",async()=>{
      await expect(token.moveProducts(others[0].address,[],[],[tokenA.address],[1, 2]))
        .to.be.revertedWith('ERC1155: ids and amounts length mismatch');
    });
  });
  
  describe("updateBalance",async()=>{
    it("update ERC20 balances",async()=>{
      const DEPOSIT_AMOUNT = BigNumber.from(2).pow(42);
      await expect(
        token.updateBalance(others[0].address,[
          {tokenId: tokenA.address, amount: DEPOSIT_AMOUNT, priceIndex: 0, isERC721:false} 
        ])
      ).emit(token, 'UpdateBatch')
        .withArgs(owner.address,constants.AddressZero,others[0].address,[tokenA.address],[DEPOSIT_AMOUNT]);
      
      expect(await token.balanceOf(others[0].address, tokenA.address)).to.equal(DEPOSIT_AMOUNT);
    });

    it("update multiple ERC20 balances",async()=>{
      const DEPOSIT_AMOUNT_1 = BigNumber.from(2).pow(42);
      const DEPOSIT_AMOUNT_2 = BigNumber.from(2).pow(32);
      await expect(
        token.updateBalance(others[0].address,[
          {tokenId: tokenA.address, amount: DEPOSIT_AMOUNT_1, priceIndex: 0, isERC721:false},
          {tokenId: tokenB.address, amount: DEPOSIT_AMOUNT_2, priceIndex: 0, isERC721:false} 
        ])
      ).emit(token, 'UpdateBatch')
        .withArgs(owner.address,constants.AddressZero,others[0].address,[tokenA.address,tokenB.address],[DEPOSIT_AMOUNT_1,DEPOSIT_AMOUNT_2]);
      
      expect(await token.balanceOf(others[0].address, tokenA.address)).to.equal(DEPOSIT_AMOUNT_1);
      expect(await token.balanceOf(others[0].address, tokenB.address)).to.equal(DEPOSIT_AMOUNT_2);
    });

    it("update ERC20 price index ",async()=>{
      const DEPOSIT_AMOUNT = BigNumber.from(2).pow(42);
      const PRICE_INDEX = BigNumber.from(10).pow(18).mul(103).div(100);
      await expect(
        token.updateBalance(others[0].address,[
          {tokenId: tokenA.address, amount: DEPOSIT_AMOUNT, priceIndex: PRICE_INDEX, isERC721:false} 
        ])
      ).emit(token, 'UpdateBatch')
        .withArgs(owner.address,constants.AddressZero,others[0].address,[tokenA.address],[DEPOSIT_AMOUNT]);
      
      expect(await token.priceIndexOf(others[0].address, tokenA.address)).to.equal(PRICE_INDEX);
    });
    
    it("update NFT",async()=>{
      const NFT_ID = 0;
      await expect(
        token.updateBalance(others[0].address,[
          {tokenId:nftA.address, amount: NFT_ID, priceIndex: 0, isERC721:true}
        ])
      ).emit(token, 'TransferSingle')
        .withArgs(owner.address,constants.AddressZero,others[0].address,nftA.address,NFT_ID);
      
      expect(await token.ifUserTokenExistsERC721(others[0].address,nftA.address,NFT_ID)).to.be.true;
    });

    it("cannot update NFT that is owned by other",async()=>{
      const NFT_ID = 0;
      await expect(
        token.updateBalance(others[0].address,[
          {tokenId:nftA.address, amount: NFT_ID, priceIndex: 0, isERC721:true}
        ])
      ).emit(token, 'TransferSingle')
        .withArgs(owner.address,constants.AddressZero,others[0].address,nftA.address,NFT_ID);
      
      expect(await token.ifUserTokenExistsERC721(others[0].address,nftA.address,NFT_ID)).to.be.true;
      
      await expect(
        token.updateBalance(others[1].address,[
          {tokenId:nftA.address, amount: NFT_ID, priceIndex: 0, isERC721:true}
        ])
      ).to.be.revertedWith("ERC721 already owned by another user");
    });
  });
});
