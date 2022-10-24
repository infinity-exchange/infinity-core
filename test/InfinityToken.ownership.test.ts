
import chai from "chai";
import { createFixtureLoader, solidity } from "ethereum-waffle";
import { BigNumber, constants, Signer, Wallet } from "ethers";
import { ethers, network, upgrades, waffle } from "hardhat";
import { InfinityPool, InfinityToken } from "../typechain";

chai.use(solidity);

import { expect } from "chai";

const WETH_TOKEN_ADDRESS: string = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const OWNABLE_REVERT_STRING = 'Ownable: caller is not the owner';

describe("InfinityToken ownerships", () => {
  const MOCK_NEW_INFINITY_POOL_ADDRESS = '0x8ba1f109551bd432803012645ac136ddd64dba72';
  let admin: Wallet;
  let others: Wallet[];
  
  let pool: InfinityPool;
  let poolToken: InfinityToken;
  
  const fixture = async () => {
    const InfinityPool = await ethers.getContractFactory("InfinityPool");
    const InfinityToken = await ethers.getContractFactory("InfinityToken");
    const poolToken: InfinityToken = await InfinityToken.deploy();
    const pool: InfinityPool = await upgrades.deployProxy(InfinityPool, [poolToken.address, WETH_TOKEN_ADDRESS]) as InfinityPool;
    await poolToken.setPool(pool.address);
    return { pool, poolToken };
  };
  
  let loadFixture: ReturnType<typeof createFixtureLoader>;
  before('create fixture loader', async () => {
    [admin, ...others] = waffle.provider.getWallets();
    loadFixture = createFixtureLoader([admin, ...others], waffle.provider);
  });
  beforeEach('load fixture', async () => {
    ({ pool, poolToken } = await loadFixture(fixture));
  });
  
  describe('as admin/owner', async () => {
    it('is the owner', async () => {
      expect(await poolToken.owner()).to.equal(admin.address);
    });
    
    it('can set new pool', async () => {
      await (await poolToken.setPool(MOCK_NEW_INFINITY_POOL_ADDRESS)).wait();
      expect(await poolToken.pool()).to.hexEqual(MOCK_NEW_INFINITY_POOL_ADDRESS);
    });
    
    it('can deposit', async () => {
      await expect(poolToken.deposit(others[0].address, [], []))
        .to.emit(poolToken, 'TransferBatch')
        .withArgs(admin.address, constants.AddressZero, others[0].address, [], []);
    });
    
    it('can withdraw', async () => {
      await expect(poolToken.withdraw(others[0].address, [], []))
        .to.emit(poolToken, 'TransferBatch')
        .withArgs(admin.address, others[0].address, constants.AddressZero, [], []);
    });
    
    it('can transfer', async () => {
      await expect(poolToken.transfer(others[0].address, others[1].address, [], []))
        .to.emit(poolToken, 'TransferBatch')
        .withArgs(admin.address, others[0].address, others[1].address, [], []);
    });
    
    it('can move products', async () => {
      await expect(poolToken.moveProducts(others[0].address, [], [], [], []))
        .to.emit(poolToken, 'TransferBatch')
        .withArgs(admin.address, constants.AddressZero, others[0].address, [], []);
    });
    
    it('can update balance', async () => {
      await expect(poolToken.updateBalance(others[0].address, [{ tokenId: 1, amount: 100, priceIndex: 0, isERC721:false }]))
        .to.emit(poolToken, 'UpdateBatch')
        .withArgs(admin.address, constants.AddressZero, others[0].address, [1], [100]);
    });
  });

  describe('as pool', async () => {
    let poolSigner: Signer;
    beforeEach('mock pool as caller', async () => {
      await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [pool.address]
      });
      await network.provider.send('hardhat_setBalance', [
        pool.address,
        "0x10000000000000000"
      ]);
      poolSigner = waffle.provider.getSigner(pool.address);
    });
    it('is not the owner', async () => {
      expect(await poolToken.owner()).to.not.equal(pool.address);
    });
    
    it('cannot set new pool', async () => {
      await expect(
        poolToken.connect(poolSigner).setPool(MOCK_NEW_INFINITY_POOL_ADDRESS)
      ).to.be.revertedWith(OWNABLE_REVERT_STRING);
    });
    
    it('can deposit', async () => {
      await expect(poolToken.connect(poolSigner).deposit(others[0].address, [], []))
        .to.emit(poolToken, 'TransferBatch')
        .withArgs(pool.address, constants.AddressZero, others[0].address, [], []);
    });
    
    it('can withdraw', async () => {
      await expect(poolToken.connect(poolSigner).withdraw(others[0].address, [], []))
        .to.emit(poolToken, 'TransferBatch')
        .withArgs(pool.address, others[0].address, constants.AddressZero, [], []);
    });
    
    it('can transfer', async () => {
      await expect(poolToken.connect(poolSigner).transfer(others[0].address, others[1].address, [], []))
        .to.emit(poolToken, 'TransferBatch')
        .withArgs(pool.address, others[0].address, others[1].address, [], []);
    });
    
    it('can move products', async () => {
      await expect(poolToken.connect(poolSigner).moveProducts(others[0].address, [], [], [], []))
        .to.emit(poolToken, 'TransferBatch')
        .withArgs(pool.address, constants.AddressZero, others[0].address, [], []);
    });
    
    it('can update balance', async () => {
      await expect(poolToken.connect(poolSigner).updateBalance(others[0].address, [{ tokenId: 1, amount: 100, priceIndex: 0, isERC721:false }]))
        .to.emit(poolToken, 'UpdateBatch')
        .withArgs(pool.address, constants.AddressZero, others[0].address, [1], [100]);
    });
  });
  
  describe('as non-admin/non-pool user', async () => {
    const NON_POOL_NON_OWNER_REVERT_STRING = "caller is not pool";
    it('is not the owner', async () => {
      expect(await poolToken.owner()).to.not.equal(pool.address);
    });
    
    it('cannot set new pool', async () => {
      await expect(
        poolToken.connect(others[0]).setPool(MOCK_NEW_INFINITY_POOL_ADDRESS)
      ).to.be.revertedWith(OWNABLE_REVERT_STRING);
    });

    it('cannot deposit', async () => {
      await expect(poolToken.connect(others[0]).deposit(others[0].address, [], []))
        .to.be.revertedWith(NON_POOL_NON_OWNER_REVERT_STRING);
    });
    
    it('cannot withdraw', async () => {
      await expect(poolToken.connect(others[0]).withdraw(others[0].address, [], []))
        .to.be.revertedWith(NON_POOL_NON_OWNER_REVERT_STRING);
    });
    
    it('cannot transfer', async () => {
      await expect(poolToken.connect(others[0]).transfer(others[0].address, others[1].address, [], []))
        .to.be.revertedWith(NON_POOL_NON_OWNER_REVERT_STRING);
    });
    
    it('cannot move products', async () => {
      await expect(poolToken.connect(others[0]).moveProducts(others[0].address, [], [], [], []))
        .to.be.revertedWith(NON_POOL_NON_OWNER_REVERT_STRING);
    });
    
    it('cannot update balance', async () => {
      await expect(poolToken.connect(others[0]).updateBalance(others[0].address, [{ tokenId: 1, amount: 100, priceIndex: 0, isERC721:false }]))
        .to.be.revertedWith(NON_POOL_NON_OWNER_REVERT_STRING);
    });
  })
 
});