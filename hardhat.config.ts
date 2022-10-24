import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-deploy-fake-erc20";

import "hardhat-deploy";
import "./hardhat-task/add-fund";
import "./hardhat-task/deposit";
import "./hardhat-task/withdraw";
import "./hardhat-task/reset-remote-fork";
import "./hardhat-task/remote-test";



dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

/* addresses */
const MAINNET_ACCOUNTS:string[] = [];
const GOERLI_ACCOUNTS:string[] = [];
const INFTEST_ACCOUNTS:string[] = [];
const { 
  MAINNET_DEPLOYER_PRIVATE_KEY, MAINNET_CONTRACT_ADMIN_PRIVATE_KEY, 
  GOERLI_DEPLOYER_PRIVATE_KEY, GOERLI_CONTRACT_ADMIN_PRIVATE_KEY, 
  INFTEST_DEPLOYER_PRIVATE_KEY, INFTEST_CONTRACT_ADMIN_PRIVATE_KEY 
} = process.env;
MAINNET_DEPLOYER_PRIVATE_KEY&&MAINNET_ACCOUNTS.push(MAINNET_DEPLOYER_PRIVATE_KEY);
MAINNET_CONTRACT_ADMIN_PRIVATE_KEY&&MAINNET_ACCOUNTS.push(MAINNET_CONTRACT_ADMIN_PRIVATE_KEY);
GOERLI_DEPLOYER_PRIVATE_KEY&&GOERLI_ACCOUNTS.push(GOERLI_DEPLOYER_PRIVATE_KEY);
GOERLI_CONTRACT_ADMIN_PRIVATE_KEY&&GOERLI_ACCOUNTS.push(GOERLI_CONTRACT_ADMIN_PRIVATE_KEY);
INFTEST_DEPLOYER_PRIVATE_KEY&&INFTEST_ACCOUNTS.push(INFTEST_DEPLOYER_PRIVATE_KEY);
INFTEST_CONTRACT_ADMIN_PRIVATE_KEY&&INFTEST_ACCOUNTS.push(INFTEST_CONTRACT_ADMIN_PRIVATE_KEY);
const namedAccounts = {
  deployer: {
    default: 0,
    1: 0, // mainnet
    "inftest": '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    "goerli": '0x0858e5aCF759EC6e071f7CedC177f4085c722b8B',
  },
  contractAdmin: {
    default: 0,
    1: 0, // mainnet
    "inftest": '0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199',
    "goerli": '0x9c0390c6e5b0780db5B7741C46a6fB69107aFc05',
  },
  // support contract addresses
  SWAP_ROUTER_ADDRESS_UNISWAPV3: {
    default: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    "goerli": '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  },
  SWAP_ROUTER_ADDRESS_AAVEV2: {
    default: '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9',
    "goerli": '0x0000000000000000000000000000000000000000',
  },
  CRV_PROVIDER_ADDRESS: {
    default: '0x0000000022D53366457F9d5E68Ec105046FC4383',
    "goerli": '0x0000000000000000000000000000000000000000',
  },
  UNISWAP_NONFUNGIBLE_POSITION_MANAGER: {
    default: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    "goerli": '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  },
  WETH_TOKEN_ADDRESS: {
    default: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    "goerli": '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
  },
};

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    compilers:[
      {version: "0.8.12"},
    ],
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000
      }
    },
  },
  mocha: {
    timeout: 50000,
  },
  networks: {
    hardhat:{
      gas: 1800000,
      forking:{
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
        // blockNumber: 15121772, // uniswap LP test
        blockNumber: 14390000,  //14846785 // faster test
      },
      initialBaseFeePerGas: 10,
      live: false,
      saveDeployments: false,
      tags: ["local","dev"],
    },
    mainnet: {
      url: `https://eth-mainnet.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: MAINNET_ACCOUNTS,
      live: true,
      saveDeployments: true,
      tags: ["live"],
    },
    goerli: {
      url: `https://eth-goerli.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: GOERLI_ACCOUNTS,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
    },
    inftest: {
      url: process.env.INFTEST_URL || "",
      // accounts: INFTEST_ACCOUNTS,
      live: false,
      saveDeployments: true,
      tags: ["dev","test"],
    },
    local: {
      url: "http://127.0.0.1:8545/",
      accounts: [],
      live: false,
      saveDeployments: true,
      tags: ["local","dev"],
    },
  },
  namedAccounts,
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  fakeERC20Network: {
    tokens: [
      {
        name: "USDT",
        symbol: "USDT",
        defaultMintAmount: "80000000000000000000",
      },
      {
        name: "USDC",
        symbol: "USDC",
        defaultMintAmount: "80000000000000000000",
      },
      {
        name: "Gold",
        symbol: "GLD",
        defaultMintAmount: "80000000000000000000",
      },
    ],
    defaultMintAmount: "80000000000000000000",
  },
};

export default config;
