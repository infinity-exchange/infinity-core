import { task } from "hardhat/config";

task('reset-remote-fork', 'Reset Remote Fork')
.addOptionalParam("blockNumber")
.setAction(async(taskArgs, hre) => {
	const { ethers, network } = hre;
	console.log('before:',await ethers.provider.getBlockNumber());
	await network.provider.request({
		method: "hardhat_reset",
		params: [
			{
				forking: {
					jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
					blockNumber: parseInt(taskArgs.blockNumber)||14390000,
				},
			},
		],
	});
	console.log('after:',await ethers.provider.getBlockNumber());
	
});
