import chai from "chai";
import { createFixtureLoader, solidity } from "ethereum-waffle";
import { BigNumber, Wallet } from "ethers";
import { ethers, upgrades, waffle, getNamedAccounts, deployments } from "hardhat";
import { InfinityPool, InfinityToken, IWETH } from "../typechain";

chai.use(solidity);

import { expect } from "chai";

const WETH_TOKEN_ADDRESS: string = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

describe("InfinityPool ownerships", () => {
  const MOCK_NEW_INFINITY_TOKEN_ADDRESS = '0x8ba1f109551bd432803012645ac136ddd64dba72';
  const MOCK_NEW_WETH_ADDRESS = '0x2357400003a333c00ef000000000000000000070';
  const INTIALIZED_REVERT_STRING = "Initializable: contract is already initialized";
  let admin: Wallet;
  let others: Wallet[];
  
  let pool: InfinityPool;
  let poolToken: InfinityToken;
  let wethToken: IWETH;
  
  const fixture = async () => {
    const {deployer} = await getNamedAccounts();
    const deployerSigner = await ethers.getSigner(deployer);
    await deployments.fixture(['InfinityPool','InfinityToken']);
    const poolDeploy = await deployments.get('InfinityPool');
    const poolTokenDeploy = await deployments.get('InfinityToken');
    const pool = await ethers.getContractAt(poolDeploy.abi,poolDeploy.address,deployerSigner) as InfinityPool;
    const poolToken = await ethers.getContractAt(poolTokenDeploy.abi,poolTokenDeploy.address,deployerSigner) as InfinityToken;
    const wethToken: IWETH = await ethers.getContractAt("IWETH", WETH_TOKEN_ADDRESS) as IWETH;
    return { pool, poolToken, wethToken };
  };
  
  let loadFixture: ReturnType<typeof createFixtureLoader>;
  before('create fixture loader', async () => {
    [admin, ...others] = waffle.provider.getWallets();
    loadFixture = createFixtureLoader([admin, ...others], waffle.provider);
  });
  beforeEach('load fixture', async () => {
    ({ pool, poolToken, wethToken } = await loadFixture(fixture));
  });
  
  describe('as admin/owner', () => {
    it('is the owner', async () => {
      const poolOwnerAddress = await pool.owner();
      expect(poolOwnerAddress).to.equal(admin.address);
    });

    it('cannot call initialize', async () => {
      await expect(
        pool.initialize(MOCK_NEW_INFINITY_TOKEN_ADDRESS, MOCK_NEW_WETH_ADDRESS)
      ).to.be.revertedWith(INTIALIZED_REVERT_STRING);
    });
    
    it('can set new infinity token address', async () => {
      await (await pool.setInfinityToken(MOCK_NEW_INFINITY_TOKEN_ADDRESS)).wait();
      const newInfinityTokenAddress = await pool.poolToken();
      expect(newInfinityTokenAddress).to.hexEqual(MOCK_NEW_INFINITY_TOKEN_ADDRESS);
    });
    
    it('can set WETH token address', async () => {
      await (await pool.setWETH(MOCK_NEW_WETH_ADDRESS)).wait();
      const newWethTokenAddress = await pool.weth();
      expect(newWethTokenAddress).to.hexEqual(MOCK_NEW_WETH_ADDRESS);
    });
  });
  
  describe('as non-admin/non-owner user', () => {
    const OWNABLE_REVERT_STRING = "Ownable: caller is not the owner";
    let user: Wallet;
    let poolAsUser: InfinityPool;
    before('load pool as user', () => {
      user = others[0];
      poolAsUser = pool.connect(user);
    });
    
    it('is not the owner', async () => {
      const poolOwnerAddress = await poolAsUser.owner();
      expect(poolOwnerAddress).to.not.equal(others[0]);
    });
    
    it('cannot call initialize', async () => {
      await expect(
        poolAsUser.initialize(MOCK_NEW_INFINITY_TOKEN_ADDRESS, MOCK_NEW_WETH_ADDRESS)
      ).to.be.revertedWith(INTIALIZED_REVERT_STRING);
    });
    
    it('cannot set new infinity token address', async () => {
      await expect(
        poolAsUser.setInfinityToken(MOCK_NEW_INFINITY_TOKEN_ADDRESS)
      ).to.be.revertedWith(OWNABLE_REVERT_STRING);
    });
    
    it('cannot set new WETH token address', async () => {
      await expect(
        poolAsUser.setWETH(MOCK_NEW_WETH_ADDRESS)
      ).to.be.revertedWith(OWNABLE_REVERT_STRING);
    });
    
    it('cannot call serverTransferFunds', async () => {
      await expect(
        poolAsUser.serverTransferFunds(user.address, [])
      ).to.be.revertedWith(OWNABLE_REVERT_STRING);
    });
    
    it('cannot call serverUpdateBalances', async () => {
      await expect(
        poolAsUser.serverUpdateBalances([], [], [])
      ).to.be.revertedWith(OWNABLE_REVERT_STRING);
    });
    
    it('cannot call serverUpdateProductVariables', async () => {
      await expect(
        poolAsUser.serverUpdateProductVariables([])
      ).to.be.revertedWith(OWNABLE_REVERT_STRING);
    });
    
    it('cannot call registerLiquidationProtocol', async () => {
      const MOCK_LIQUIDATION_PROTOCOL_ADDRESS = "0x78605df79524164911c144801f41e9811b7db73d";
      await expect(
        poolAsUser.registerLiquidationProtocol(1, MOCK_LIQUIDATION_PROTOCOL_ADDRESS)
      ).to.be.revertedWith(OWNABLE_REVERT_STRING);
    });
    
    it('cannot call serverLiquidate', async () => {
      const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
      await expect(poolAsUser.serverLiquidate(1, {
        clientAddress: user.address,
        tokenFrom: WETH_TOKEN_ADDRESS,
        tokenTo: USDT_ADDRESS,
        amountIn: BigNumber.from(10).pow(18),
        poolFee: BigNumber.from(3000)
      })).to.be.revertedWith(OWNABLE_REVERT_STRING);
    });
    
    it('cannot call serverLiquidateERC721', async () => {
      const MOONBIRD_9783 = "0x23581767a106ae21c074b2276d25e5c3e136a68b";
      await expect(poolAsUser.serverLiquidate(1, {
        clientAddress: user.address,
        tokenFrom: MOONBIRD_9783,
        tokenTo: WETH_TOKEN_ADDRESS,
        amountIn: BigNumber.from(1),
        poolFee: BigNumber.from(0)
      })).to.be.revertedWith(OWNABLE_REVERT_STRING);
    });
  });
});