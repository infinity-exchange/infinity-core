import { task } from "hardhat/config";

import {BigNumber, Contract, Signer, utils} from 'ethers';

import tokenJson from './tokenmap-mainnet.json';


const ERC20ABI = [ { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "spender", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" } ], "name": "Approval", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" } ], "name": "Transfer", "type": "event" }, { "inputs": [ { "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" } ], "name": "allowance", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "approve", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "account", "type": "address" } ], "name": "balanceOf", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "decimals", "outputs": [ { "internalType": "uint8", "name": "", "type": "uint8" } ], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "totalSupply", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "recipient", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "transfer", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "sender", "type": "address" }, { "internalType": "address", "name": "recipient", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "transferFrom", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" } ]

task('add-fund', 'Add fund to the given account')
	.addPositionalParam('targetWalletAddress')
	.setAction(async(taskArgs, hre) => {
		const ethers = hre.ethers;
		const network = hre.network;

		const targetWalletAddress = taskArgs['targetWalletAddress'];
		console.log('Transfer Tokens to ' + targetWalletAddress);

		await network.provider.request({method:"hardhat_setBalance",params:[targetWalletAddress,ethers.utils.hexStripZeros(ethers.utils.parseEther("10000000").toHexString())]});
		console.log('Set ETH for ' + targetWalletAddress);

		const tokenContractMap = new Map<string, [Contract,Signer, number]>();

		for (const [symbol, info] of Object.entries(tokenJson)) {
			const WETHABI = [...ERC20ABI, {"constant":false,"inputs":[{"name":"wad","type":"uint256"}],"name":"withdraw","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]
			let token: Contract = new ethers.Contract(info.token_address, ERC20ABI, ethers.provider);

			if (symbol === "WETH")
				token = new ethers.Contract(info.token_address, WETHABI, ethers.provider);

			// impersonate rich holder
			await network.provider.request({method:"hardhat_impersonateAccount",params:[info.impersonate_holder_address]});
			const signer = await ethers.provider.getSigner(info.impersonate_holder_address);
			const fund_transfer_amount = info.fund_transfer_amount;
			tokenContractMap.set(symbol, [token, signer, fund_transfer_amount]);
		}

		const showTokenBalances = async function() {
			await ethers.provider.getBalance(targetWalletAddress)
				.then(async (balance: any) => console.log(`ETH: ` + utils.formatEther(balance)))
			for (const [symbol, info] of tokenContractMap) {
				const token = info[0];
				await token.balanceOf(targetWalletAddress)
					.then(async (balance: any) => console.log(`${symbol}: ` + utils.formatUnits(balance, await token.decimals())))
			}
		}

		console.log('Balance:');
		await showTokenBalances()

		for (const [symbol, info] of tokenContractMap) {
			const token = info[0];
			const impersonatedSigner = info[1];
			const transfer_amount = info[2];


			try {
				const dp = await token.decimals();
				const holder_address = await impersonatedSigner.getAddress();
				const amount = utils.parseUnits(transfer_amount.toFixed(), dp)
				let holder_balance = await token.balanceOf(holder_address);

				console.log(`Transfer ${transfer_amount} ${symbol} from ${holder_address}, holder balance: ${utils.formatUnits(holder_balance, dp)}`);
				// check if holder has enough eth to pay gas
				const holder_eth_balance = await impersonatedSigner.getBalance();
				if (holder_eth_balance.eq(BigNumber.from(0)))
					await network.provider.request({method:"hardhat_setBalance",params:[await impersonatedSigner.getAddress(),
							ethers.utils.parseEther('1').toHexString().replace("0x0", "0x")]});
				await token.connect(impersonatedSigner).transfer(targetWalletAddress, amount);

				if (symbol === "WETH") { // set eth balance as well
					const eth_balance = await ethers.provider.getBalance(targetWalletAddress);
					const transfer_eth_amount = eth_balance.add(utils.parseEther(transfer_amount.toFixed()));
					console.log(`Adding ETH balance ${transfer_amount}, wallet balance: ${utils.formatEther(eth_balance)}`)
					await network.provider.request({method:"hardhat_setBalance",params:[targetWalletAddress,
							transfer_eth_amount.toHexString().replace("0x0", "0x")]});
				}
			} catch (e) {
				console.log(e)
			}
		}

		console.log('\nNew Balance: ');
		await showTokenBalances();

	});