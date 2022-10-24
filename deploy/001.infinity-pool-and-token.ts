import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {parseEther} from 'ethers/lib/utils';
import { InfinityPool } from '../typechain';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts, ethers} = hre;
	console.log('before:',await ethers.provider.getBlockNumber());

  const {deploy,get} = deployments;
  const {deployer,contractAdmin,WETH_TOKEN_ADDRESS} = await getNamedAccounts();

console.log('deployer',deployer,'contractAdmin',contractAdmin);
  const deployerSigner = await ethers.getSigner(deployer);
  const contractAdminSigner = await ethers.getSigner(contractAdmin);
  
  const infinityTokenDeploy = await deploy('InfinityToken', {
    from: deployer,
    proxy: {
      owner: deployer,
      proxyContract: "OptimizedTransparentProxy", 
      execute: {
        init: {
          methodName: "initialize", 
          args: [],
        }
      }
    },
    log: true,
    autoMine: true,
  })
  const tokenNewlyDeployed = infinityTokenDeploy.newlyDeployed;
  const infinityToken = await ethers.getContractAt('InfinityToken',infinityTokenDeploy.address);
  console.log('await infinityToken.owner()',await infinityToken.owner())
  if(contractAdmin!=await infinityToken.owner()){
    await (await infinityToken.transferOwnership(contractAdmin)).wait();
    console.log(`InfinityToken now owned by ${contractAdmin}`);
  }
  // console.log("InfinityToken deployed to:", infinityToken.address);


  const infinityPoolDeploy = await deploy('InfinityPool', {
    from: deployer,
    proxy: {
      owner: deployer,
      proxyContract: "OptimizedTransparentProxy", 
      execute: {
        init: {
          methodName: "initialize", 
          args: [infinityToken.address,WETH_TOKEN_ADDRESS],
        }
      }
    },
    log: true,
    autoMine: true,
  });
  const poolFirstDeploy = infinityPoolDeploy.newlyDeployed&&((infinityPoolDeploy.numDeployments||0)==1);
  const poolUpgraded = infinityPoolDeploy.newlyDeployed&&((infinityPoolDeploy.numDeployments||0)>1);
  const infinityPool = await ethers.getContractAt('InfinityPool',infinityPoolDeploy.address);
  
  if(infinityPool.address!=await infinityToken.pool()){
    await (await infinityToken.connect(contractAdminSigner).setPool(infinityPool.address)).wait();
    console.log("InfinityToken now connected to pool");
  }
  if(contractAdmin!=await infinityPool.owner()){
    // update ownership
    await (await infinityPool.transferOwnership(contractAdmin)).wait();
    console.log(`InfinityPool now owned by ${contractAdmin}`);
  }
  
  const currentTokenAddress = await infinityPool.poolToken();
  console.log("InfinityPool deployed at:", infinityPool.address, ", poolToken:", currentTokenAddress);

  if(currentTokenAddress!=infinityToken.address){
    await (await infinityPool.connect(contractAdminSigner).setInfinityToken(infinityToken.address)).wait();
    console.log("InfinityToken updated, saved to InfinityPool");
  }
  if(await infinityPool.weth()!==WETH_TOKEN_ADDRESS){
    await (await infinityPool.connect(contractAdminSigner).setWETH(WETH_TOKEN_ADDRESS)).wait();
    console.log(`InfinityPool WETH set to ${WETH_TOKEN_ADDRESS}`);
  }

  console.log("InfinityToken owner:", await infinityToken.owner());
  console.log("InfinityPool owner:", await infinityPool.owner());

  // print version
  const version = await infinityPool.version();
	console.log('version',version.toString());

	console.log('after:',await ethers.provider.getBlockNumber());
};
export default func;
func.tags = ['InfinityPool','InfinityToken'];
