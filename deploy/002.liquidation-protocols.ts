import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {parseEther} from 'ethers/lib/utils';

const SWAP_PROTOCOL_ID_UNISWAP = 1;
const SWAP_PROTOCOL_ID_AAVE_V2 = 2;
const SWAP_PROTOCOL_ID_COMPOUND = 3;
const SWAP_PROTOCOL_ID_CURVE = 4;
const SWAP_PROTOCOL_ID_UNISWAP_LP = 5;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts, ethers} = hre;
	console.log('before:',await ethers.provider.getBlockNumber());

  const {deploy,get} = deployments;
  const {deployer,contractAdmin,
    SWAP_ROUTER_ADDRESS_UNISWAPV3,
    SWAP_ROUTER_ADDRESS_AAVEV2,
    CRV_PROVIDER_ADDRESS,
    UNISWAP_NONFUNGIBLE_POSITION_MANAGER,
  } = await getNamedAccounts();

  const infinityPoolDeploy = await get('InfinityPool');
  const infinityPool = await ethers.getContractAt('InfinityPool',infinityPoolDeploy.address);
  console.log("InfinityPool proxy contract at:", infinityPool.address);

  const contractAdminSigner = await ethers.getSigner(contractAdmin);
  
  // liquidation implementations
  // uniswap v3
  const liquidationUniswapV3 = await deploy("LiquidationUniswapV3", {
    from: deployer,
    args: [SWAP_ROUTER_ADDRESS_UNISWAPV3,infinityPool.address],
    log: true,
    autoMine: true,
  });
  console.log(`liquidationUniswapV3.address deployed at`,liquidationUniswapV3.address);
  (await infinityPool.connect(contractAdminSigner).registerLiquidationProtocol(SWAP_PROTOCOL_ID_UNISWAP,liquidationUniswapV3.address)).wait();
  console.log(`liquidationUniswapV3 registered`);
  
  // aave
  const liquidationAaveV2 = await deploy("LiquidationAaveV2", {
    from: deployer,
    args: [SWAP_ROUTER_ADDRESS_AAVEV2,infinityPool.address],
    log: true,
    autoMine: true,
  });
  console.log(`liquidationAaveV2.address deployed at`,liquidationAaveV2.address);
  (await infinityPool.connect(contractAdminSigner).registerLiquidationProtocol(SWAP_PROTOCOL_ID_AAVE_V2,liquidationAaveV2.address)).wait();
  console.log(`liquidationAaveV2 registered`);
  
  // compound
  const liquidationCompound = await deploy("LiquidationCompound", {
    from: deployer,
    args: [infinityPool.address],
    log: true,
    autoMine: true,
  });
  console.log(`liquidationCompound.address deployed at`,liquidationCompound.address);
  (await infinityPool.connect(contractAdminSigner).registerLiquidationProtocol(SWAP_PROTOCOL_ID_COMPOUND,liquidationCompound.address)).wait();
  console.log(`liquidationCompound registered`);

  // curve
  const liquidationCurve = await deploy("LiquidationCurve", {
    from: deployer,
    args: [CRV_PROVIDER_ADDRESS,infinityPool.address],
    log: true,
    autoMine: true,
  });
  console.log(`liquidationCurve.address deployed at`,liquidationCurve.address);
  (await infinityPool.connect(contractAdminSigner).registerLiquidationProtocol(SWAP_PROTOCOL_ID_CURVE,liquidationCurve.address)).wait();
  console.log(`liquidationCurve registered`);

  // uniswap lp
  const liquidationUniswapLP = await deploy("LiquidationUniswapLP", {
    from: deployer,
    args: [infinityPool.address,UNISWAP_NONFUNGIBLE_POSITION_MANAGER],
    log: true,
    autoMine: true,
  });
  console.log(`liquidationUniswapLP.address deployed at`,liquidationUniswapLP.address);
  (await infinityPool.connect(contractAdminSigner).registerLiquidationProtocol(SWAP_PROTOCOL_ID_UNISWAP_LP,liquidationUniswapLP.address)).wait();
  console.log(`liquidationUniswapLP registered`);

	console.log('after:',await ethers.provider.getBlockNumber());
};
export default func;
func.tags = ['InfinityPool','InfinityToken'];
