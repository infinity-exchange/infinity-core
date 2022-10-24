import { task } from "hardhat/config";

import { BigNumber, utils } from 'ethers';

task('deposit', 'Deposit to Infinity')
.addPositionalParam('targetWalletAddress')
.addOptionalParam("poolAddress","Address of Infinity Pool Contract. Uses ENV.INFINITY_POOL_ADDRESS by default.",process.env.INFINITY_POOL_ADDRESS)
.addOptionalParam('dai')
.addOptionalParam('usdt')
.addOptionalParam('usdc')
.addOptionalParam('wbtc')
.addOptionalParam('eth')
.addOptionalParam('aweth')
.addOptionalParam('ausdt')
.addOptionalParam('unft')
.setAction(async(taskArgs, hre) => {
	const {ethers,network} = hre;
	console.log('before:',await ethers.provider.getBlockNumber());
	const { poolAddress:INFINITY_POOL_ADDRESS } = taskArgs;
	console.log('infinity pool address ', INFINITY_POOL_ADDRESS ,'bytecode exists:',(await ethers.provider.getCode(INFINITY_POOL_ADDRESS))!='0x0');
	const targetWalletAddress = taskArgs['targetWalletAddress'];
	await network.provider.request({method:"hardhat_impersonateAccount",params:[targetWalletAddress]});
	// ETH for gas
	await network.provider.request({method:"hardhat_setBalance",params:[targetWalletAddress,ethers.utils.hexStripZeros(ethers.utils.parseEther("10000000").toHexString())]});
	await network.provider.request({method:"hardhat_setBalance",params:[INFINITY_POOL_ADDRESS,ethers.utils.hexStripZeros(ethers.utils.parseEther("10000000").toHexString())]});
	const signer = await ethers.getSigner(targetWalletAddress);
	console.log('Deposit Tokens from ' + targetWalletAddress);
	
	const DAI_CONTRACT = await new ethers.Contract(DAI_ADDRESS, ERC20ABI, ethers.provider);
	const USDT_CONTRACT = await new ethers.Contract(USDT_ADDRESS, ERC20ABI, ethers.provider);
	const USDC_CONTRACT = await new ethers.Contract(USDC_ADDRESS, ERC20ABI, ethers.provider);
	const WBTC_CONTRACT = await new ethers.Contract(WBTC_ADDRESS, ERC20ABI, ethers.provider);
	const UNISWAP_NFT_CONTRACT = await new ethers.Contract(UNISWAP_NFT_ADDRESS, ERC721ABI, ethers.provider);
	const aWETH_CONTRACT = await new ethers.Contract(aWETH_ADDRESS, ERC20ABI, ethers.provider);
	const aUSDT_CONTRACT	= await new ethers.Contract(aUSDT_ADDRESS, ERC20ABI, ethers.provider);
	const WETH_CONTRACT	= await new ethers.Contract(WETH_ADDRESS, ERC20ABI, ethers.provider);

	let tokenTransfers = [];
	let ethTransfer:any = {
		gasLimit: 1000000
	};
	if(taskArgs.dai){
		let amount = utils.parseUnits(taskArgs.dai, await DAI_CONTRACT.decimals());
		tokenTransfers.push({
			token: DAI_ADDRESS,
			amount: amount
		});
		
		console.log('Deposit DAI '+taskArgs.dai);
		await DAI_CONTRACT.connect(signer).approve(INFINITY_POOL_ADDRESS, amount, {gasLimit: 1000000});
	}
	if(taskArgs.usdt){
		let amount = utils.parseUnits(taskArgs.usdt, await USDT_CONTRACT.decimals());
		tokenTransfers.push({
			token: USDT_ADDRESS,
			amount: amount
		});
		
		console.log('Deposit USDT '+taskArgs.usdt);
		let allowance = await USDT_CONTRACT.allowance(targetWalletAddress, INFINITY_POOL_ADDRESS);
		if(!allowance.isZero()){
			await USDT_CONTRACT.connect(signer).approve(INFINITY_POOL_ADDRESS, 0, {gasLimit: 1000000});
		}
		await USDT_CONTRACT.connect(signer).approve(INFINITY_POOL_ADDRESS, amount, {gasLimit: 1000000});
		console.log('Approve USDT '+taskArgs.usdt);
	}
	if(taskArgs.usdc){
		let amount = utils.parseUnits(taskArgs.usdc, await USDC_CONTRACT.decimals());
		tokenTransfers.push({
			token: USDC_ADDRESS,
			amount: amount
		});
		
		console.log('Deposit USDC '+taskArgs.usdc);
		await USDC_CONTRACT.connect(signer).approve(INFINITY_POOL_ADDRESS, amount, {gasLimit: 1000000});
	}
	if(taskArgs.wbtc){
		let amount = utils.parseUnits(taskArgs.wbtc, await WBTC_CONTRACT.decimals());
		tokenTransfers.push({
			token: WBTC_ADDRESS,
			amount: amount
		});
		
		console.log('Deposit WBTC '+taskArgs.wbtc);
		await WBTC_CONTRACT.connect(signer).approve(INFINITY_POOL_ADDRESS, amount, {gasLimit: 1000000});
	}
	if(taskArgs.eth){
		let ethAmount = utils.parseEther(taskArgs.eth);
		// tokenTransfers.push({
		// 	token: '0x0',
		// 	amount: ethAmount
		// });
		
		ethTransfer.value = ethAmount;
	}

	if(taskArgs.aweth){
		let amount = utils.parseUnits(taskArgs.aweth, await aWETH_CONTRACT.decimals());
		tokenTransfers.push({
			token: aWETH_ADDRESS,
			amount: amount
		});

		console.log('Deposit aWETH '+taskArgs.aweth);
		await aWETH_CONTRACT.connect(signer).approve(INFINITY_POOL_ADDRESS, amount, {gasLimit: 1000000});
	}
	
	if(taskArgs.ausdt){
		let amount = utils.parseUnits(taskArgs.ausdt, await aUSDT_CONTRACT.decimals());
		tokenTransfers.push({
			token: aUSDT_ADDRESS,
			amount: amount
		});

		console.log('Deposit aUSDT '+taskArgs.ausdt);
		await aUSDT_CONTRACT.connect(signer).approve(INFINITY_POOL_ADDRESS, amount, {gasLimit: 1000000});
	}

	// uniswap nfts
	if(taskArgs.unft){
		let tokenId = BigNumber.from(taskArgs.unft);
		const originalOwner = await UNISWAP_NFT_CONTRACT.ownerOf(tokenId);
		if(originalOwner==INFINITY_POOL_ADDRESS){
			// send back the token
			console.log('sending uniswap LP token back to user');
			const poolSigner = await ethers.getSigner(INFINITY_POOL_ADDRESS);
			await network.provider.request({method:"hardhat_impersonateAccount",params:[INFINITY_POOL_ADDRESS]});
			await UNISWAP_NFT_CONTRACT.connect(poolSigner).approve(signer.address, tokenId, {gasLimit: 1000000});
			await UNISWAP_NFT_CONTRACT.connect(poolSigner).transferFrom(INFINITY_POOL_ADDRESS, signer.address, tokenId, {gasLimit: 1000000});
			// const data = await INFINITY_POOL_CONTRACT.serverTransferERC721(signer.address,UNISWAP_NFT_CONTRACT.address,tokenId);
		}
			await UNISWAP_NFT_CONTRACT.connect(signer).approve(INFINITY_POOL_ADDRESS, tokenId, {gasLimit: 1000000});
			tokenTransfers.push({
			token: UNISWAP_NFT_ADDRESS,
			amount: tokenId,
		});
	}
	
	
	if(tokenTransfers.length === 0&&ethTransfer.value===0){
		console.error('Please specify tokens to deposit');
		return 1;
	}
	
	
	console.log('Balance');
	console.log((await Promise.all([
		DAI_CONTRACT.balanceOf(targetWalletAddress).then((balance:any) => ('--User DAI: ' + balance)),
		USDT_CONTRACT.balanceOf(targetWalletAddress).then((balance:any) => ('--User USDT: ' + balance)),
		USDC_CONTRACT.balanceOf(targetWalletAddress).then((balance:any) => ('--User USDC: ' + balance)),
		WBTC_CONTRACT.balanceOf(targetWalletAddress).then((balance:any) => ('--User WBTC: ' + balance)),
		aWETH_CONTRACT.balanceOf(targetWalletAddress).then((balance:any) => ('--User aWETH: ' + balance)),
		aUSDT_CONTRACT.balanceOf(targetWalletAddress).then((balance:any) => ('--User aUSDT: ' + balance)),
		WETH_CONTRACT.balanceOf(targetWalletAddress).then((balance:any) => ('--User WETH: ' + balance)),
		ethers.provider.getBalance(targetWalletAddress).then((balance:any) => ('--User ETH: ' + balance)),
		UNISWAP_NFT_CONTRACT.ownerOf(BigNumber.from(taskArgs.unft||'0')).then((address:any) => ('UNFT owner: ' + address.toString())).catch(()=>{}),
		DAI_CONTRACT.balanceOf(INFINITY_POOL_ADDRESS).then((balance:any) => ('--Pool DAI: ' + balance)),
		USDT_CONTRACT.balanceOf(INFINITY_POOL_ADDRESS).then((balance:any) => ('--Pool USDT: ' + balance)),
		USDC_CONTRACT.balanceOf(INFINITY_POOL_ADDRESS).then((balance:any) => ('--Pool USDC: ' + balance)),
		WBTC_CONTRACT.balanceOf(INFINITY_POOL_ADDRESS).then((balance:any) => ('--Pool WBTC: ' + balance)),
		aWETH_CONTRACT.balanceOf(INFINITY_POOL_ADDRESS).then((balance:any) => ('--Pool aWETH: ' + balance)),
		aUSDT_CONTRACT.balanceOf(INFINITY_POOL_ADDRESS).then((balance:any) => ('--Pool aUSDT: ' + balance)),
		WETH_CONTRACT.balanceOf(INFINITY_POOL_ADDRESS).then((balance:any) => ('--Pool WETH: ' + balance)),
		ethers.provider.getBalance(INFINITY_POOL_ADDRESS).then((balance:any) => ('--Pool ETH: ' + balance)),
	])).join('\n'));
	
	
	console.log('Deposit');
	const INFINITY_POOL_CONTRACT = await ethers.getContractAt("InfinityPool", INFINITY_POOL_ADDRESS, signer);
	if(tokenTransfers.length>0||ethTransfer.value>0){
		console.log('deposit tokens to contract',tokenTransfers,ethTransfer);
		const receipt = await INFINITY_POOL_CONTRACT.deposit(tokenTransfers, [], ethTransfer);
		console.log('receipt',receipt);
		const tx = await ethers.provider.getTransactionReceipt(receipt.hash);
		console.log(tx);
		// try{
		// 	console.log("result",INFINITY_POOL_CONTRACT.interface.decodeFunctionResult("deposit",receipt.data));
		// }catch(error){
		// 	try{
		//		console.log("error",INFINITY_POOL_CONTRACT.interface.decodeErrorResult("deposit",receipt.data));
		// 	}catch(error){
		// 		console.log("error2",error,receipt.data);
		// 	}
		// }
	}
	
	console.log('New Balance');
	console.log((await Promise.all([
		DAI_CONTRACT.balanceOf(targetWalletAddress).then((balance:any) => ('--User DAI: ' + balance)),
		USDT_CONTRACT.balanceOf(targetWalletAddress).then((balance:any) => ('--User USDT: ' + balance)),
		USDC_CONTRACT.balanceOf(targetWalletAddress).then((balance:any) => ('--User USDC: ' + balance)),
		WBTC_CONTRACT.balanceOf(targetWalletAddress).then((balance:any) => ('--User WBTC: ' + balance)),
		aWETH_CONTRACT.balanceOf(targetWalletAddress).then((balance:any) => ('--User aWETH: ' + balance)),
		aUSDT_CONTRACT.balanceOf(targetWalletAddress).then((balance:any) => ('--User aUSDT: ' + balance)),
		WETH_CONTRACT.balanceOf(targetWalletAddress).then((balance:any) => ('--User WETH: ' + balance)),
		ethers.provider.getBalance(targetWalletAddress).then((balance:any) => ('--User ETH: ' + balance)),
		UNISWAP_NFT_CONTRACT.ownerOf(BigNumber.from(taskArgs.unft||'0')).then((address:any) => ('UNFT owner: ' + address.toString())).catch(()=>{}),
		DAI_CONTRACT.balanceOf(INFINITY_POOL_ADDRESS).then((balance:any) => ('--Pool DAI: ' + balance)),
		USDT_CONTRACT.balanceOf(INFINITY_POOL_ADDRESS).then((balance:any) => ('--Pool USDT: ' + balance)),
		USDC_CONTRACT.balanceOf(INFINITY_POOL_ADDRESS).then((balance:any) => ('--Pool USDC: ' + balance)),
		WBTC_CONTRACT.balanceOf(INFINITY_POOL_ADDRESS).then((balance:any) => ('--Pool WBTC: ' + balance)),
		aWETH_CONTRACT.balanceOf(INFINITY_POOL_ADDRESS).then((balance:any) => ('--Pool aWETH: ' + balance)),
		aUSDT_CONTRACT.balanceOf(INFINITY_POOL_ADDRESS).then((balance:any) => ('--Pool aUSDT: ' + balance)),
		WETH_CONTRACT.balanceOf(INFINITY_POOL_ADDRESS).then((balance:any) => ('--Pool WETH: ' + balance)),
		ethers.provider.getBalance(INFINITY_POOL_ADDRESS).then((balance:any) => ('--Pool ETH: ' + balance)),
	])).join('\n'));

	// increase block
	console.log('-- mine 15 blocks for job server');
	for(let i=0;i<15;i++){
		await network.provider.send("evm_mine");
	}
	console.log('after:',await ethers.provider.getBlockNumber());
});

const DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const WBTC_ADDRESS = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
const UNISWAP_NFT_ADDRESS = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const aWETH_ADDRESS = '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e';
const aUSDT_ADDRESS = '0x3ed3b47dd13ec9a98b44e6204a523e766b225811';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';


const ERC20ABI = [ { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "spender", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" } ], "name": "Approval", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" } ], "name": "Transfer", "type": "event" }, { "inputs": [ { "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" } ], "name": "allowance", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "approve", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "account", "type": "address" } ], "name": "balanceOf", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "decimals", "outputs": [ { "internalType": "uint8", "name": "", "type": "uint8" } ], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "totalSupply", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "recipient", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "transfer", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "sender", "type": "address" }, { "internalType": "address", "name": "recipient", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "transferFrom", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" } ]
const ERC721ABI = [ { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "approved", "type": "address" }, { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" } ], "name": "Approval", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "operator", "type": "address" }, { "indexed": false, "internalType": "bool", "name": "approved", "type": "bool" } ], "name": "ApprovalForAll", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" } ], "name": "Transfer", "type": "event" }, { "inputs": [ { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" } ], "name": "approve", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "owner", "type": "address" } ], "name": "balanceOf", "outputs": [ { "internalType": "uint256", "name": "balance", "type": "uint256" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "uint256", "name": "tokenId", "type": "uint256" } ], "name": "getApproved", "outputs": [ { "internalType": "address", "name": "operator", "type": "address" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "operator", "type": "address" } ], "name": "isApprovedForAll", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "uint256", "name": "tokenId", "type": "uint256" } ], "name": "ownerOf", "outputs": [ { "internalType": "address", "name": "owner", "type": "address" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" } ], "name": "safeTransferFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "bytes", "name": "data", "type": "bytes" } ], "name": "safeTransferFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "operator", "type": "address" }, { "internalType": "bool", "name": "_approved", "type": "bool" } ], "name": "setApprovalForAll", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "bytes4", "name": "interfaceId", "type": "bytes4" } ], "name": "supportsInterface", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" } ], "name": "transferFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" } ];