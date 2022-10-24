<p align="center">
  <a href="" rel="noopener">
 <img width=250px src="https://assets.website-files.com/62aae6b5309f121be53985ce/62ab0253e7237c1e85829131_infinity_primary-logo-white-p-500.png" alt="Bot logo"></a>
</p>

<h3 align="center">infinity-core</h3>

<div align="center">
Ethereum smart contract endpoints for client & web server interactions
</div>

---

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Environment Setup to dev net](#environment-setup-to-dev-net)
- [Deployment](#deployment)
- [Contracts](#contracts)
  - [InfinityPool.sol](#infinitypoolsol)
    - [Functions](#functions)
      - [`deposit(TokenTransfer[] memory tokenTransfers,Action[] memory actions)`](#deposittokentransfer-memory-tokentransfersaction-memory-actions)
      - [`action(Action[] memory actions)`](#actionaction-memory-actions)
      - [`requestWithdraw(TokenTransfer[] memory tokenTransfers)`](#requestwithdrawtokentransfer-memory-tokentransfers)
      - [`balanceOf(address clientAddress, uint tokenId)`](#balanceofaddress-clientaddress-uint-tokenid)
      - [`productVariable(uint64 id)`](#productvariableuint64-id)
      - [`priceIndex(uint256 tokenId)`](#priceindexuint256-tokenid)
      - [`serverUpdateBalances(address[] memory clientAddresses, TokenUpdate memory _productVariables)`](#serverupdatebalancesaddress-memory-clientaddresses-tokenupdate-memory-tokentransfers-productvariable-memory-_productvariables)
      - [`serverTransferFunds(address clientAddress, TokenTransfer[] memory tokenTransfers)`](#servertransferfundsaddress-clientaddress-tokentransfer-memory-tokentransfers)
      - [`serverLiquidate(uint64 protocolId, ILiquidationProtocol.LiquidateParams memory lparams)`](#serverliquidateuint64-protocolid-iliquidationprotocolliquidateparams-memory-lparams)
      - [`serverLiquidateERC721(uint64 protocolId, ILiquidationProtocol.LiquidateParams memory lparams)`](#serverliquidateerc721uint64-protocolid-iliquidationprotocolliquidateparams-memory-lparams)
      - [`serverTransferERC721(address client, address token, uint256 tokenId)`](#servertransfererc721address-client-address-token-uint256-tokenid)
      - [`bridgeTransfer()`](#bridgetransfer)
    - [Events](#events)
      - [`DepositsOrActionsTriggered`](#depositsoractionstriggered)
      - [`WithdrawalRequested`](#withdrawalrequested)
      - [`ProductVariablesUpdated`](#productvariablesupdated)
      - [`ServerLiquidateSuccess`](#serverliquidatesuccess)
    - [Variables](#variables)
      - [`mapping(uint64=>int64) productVariables`](#mappinguint64int64-productvariables)
  - [InfinityToken](#infinitytoken)
    - [functions](#functions-1)
      - [`updateBalance()`](#updatebalance)
      - [`deposit()`](#deposit)
      - [`moveProducts()`](#moveproducts)
      - [`transfer()`](#transfer)
      - [`ifUserTokenExistsERC721()`](#ifusertokenexistserc721)
      - [`depositERC721()`](#depositerc721)
      - [`withdrawERC721()`](#withdrawerc721)
      - [`transferERC721()`](#transfererc721)
      - [`setPool(address _poolAddr)`](#setpooladdress-_pooladdr)
      - [`priceIndexOf(address clientAddress, uint256 tokenId)`](#priceindexofaddress-clientaddress-uint256-tokenid)
    - [Variables](#variables-1)
  - [Liquidation{ProtocolName}](#liquidationprotocolname)
    - [Functions](#functions-2)
      - [`swap()`](#swap)
      - [`getApproveAmount()`](#getapproveamount)
    - [Protocols](#protocols)
      - [**UniswapV3**](#uniswapv3)
      - [**AAVEv2**](#aavev2)
      - [**Compound**](#compound)
      - [**CurveLPs**](#curvelps)
      - [**UniswapLPs**](#uniswaplps)
      - [**AAVEv3**](#aavev3)
- [Testing with Hardhat](#testing-with-hardhat)
- [Hardhat commands](#hardhat-commands)
- [Etherscan verification](#etherscan-verification)
- [Performance optimizations](#performance-optimizations)


---


## Environment Setup to dev net
- Copy .env.example to .env file
- Put the following environment variables into .env file 
  ```
  INFINITY_POOL_ADDRESS=<> # for hardhat-task 
  INFTEST_URL=http://18.162.52.171:545
  INFTEST_DEPLOYER_PRIVATE_KEY=<>
  INFTEST_CONTRACT_ADMIN_PRIVATE_KEY=<>
  ETHERSCAN_API_KEY=<>
  ALCHEMY_API_KEY=<>
  ```
- Run the following commands
  ```bash
  npx hardhat compile
  npx hardhat add-fund --network inftest {address}
  npx hardhat deposit --network inftest {address} --usdt 100 --usdc 100 --dai 100 --eth 100 --wbtc 100
  ```

## Deployment
deploy all updated contracts with `hardhat-deploy` - read https://github.com/wighawag/hardhat-deploy for more info on usage
```
npx hardhat deploy --network inftest

# env variables
GOERLI_DEPLOYER_PRIVATE_KEY=<>
GOERLI_CONTRACT_ADMIN_PRIVATE_KEY=<>
MAINNET_DEPLOYER_PRIVATE_KEY=<>
MAINNET_CONTRACT_ADMIN_PRIVATE_KEY=<>
```

- deployment tasks are located under `/deploy`

- deployment configs (networks, deployer/contract admin addresses) are stored under `hardhat.config.ts`; keys are stored as `ENVIRONMENT` variables

- deployment histories are stored under `/deployments` for contract upgrade & tracking purposes


## Contracts
### InfinityPool.sol
#### Functions
##### `deposit(TokenTransfer[] memory tokenTransfers,Action[] memory actions)`
##### `action(Action[] memory actions)`
emits `DepositsOrActionsTriggered` for offchain server calculation
##### `requestWithdraw(TokenTransfer[] memory tokenTransfers)`
emits `WithdrawalRequested` for offchain server handling
callback `serverTransferFunds()`
##### `balanceOf(address clientAddress, uint tokenId)`
look up client balance for a specific token
##### `productVariable(uint64 id)`
look up productVariable
##### `priceIndex(uint256 tokenId)`
look up priceIndex
##### `serverUpdateBalances(address[] memory clientAddresses, TokenUpdate[][] memory tokenTransfers, ProductVariable[] memory _productVariables)`
server only - internal transfers only, takes *absolute* amount in tokenTransfers
##### `serverTransferFunds(address clientAddress, TokenTransfer[] memory tokenTransfers)`
server only - outbound transfers (for user withdrawals)
##### `serverLiquidate(uint64 protocolId, ILiquidationProtocol.LiquidateParams memory lparams)`
server only - swap/liquidate user collateral tokens with respective protocols
##### `serverLiquidateERC721(uint64 protocolId, ILiquidationProtocol.LiquidateParams memory lparams)`
server only - remove all liquidity from ERC721 (uniswap)
##### `serverTransferERC721(address client, address token, uint256 tokenId)`
##### `bridgeTransfer()`
not implemented
#### Events
##### `DepositsOrActionsTriggered`
##### `WithdrawalRequested`
##### `ProductVariablesUpdated`
##### `ServerLiquidateSuccess`
#### Variables
##### `mapping(uint64=>int64) productVariables`
interest index etc.
____
### InfinityToken
Wallet, ERC1155, synth tokens for 1.token value & 2.token-product book keeping & 3.product related states
- uint64 (2**64 per account)
#### functions
##### `updateBalance()`
update client balance with absolute value
##### `deposit()`
mint new virtual tokens (delta function)
##### `moveProducts()`
mint/burn product tokens (delta function)
##### `transfer()`
to another account (delta function)
##### `ifUserTokenExistsERC721()`
ERC721: check if balance ledger for token->user->tokenId exists
##### `depositERC721()`
ERC721: mint token & erc721 mapping
##### `withdrawERC721()`
ERC721: burn token & erc721 mapping
##### `transferERC721()`
ERC721: 
##### `setPool(address _poolAddr)`
owner only
##### `priceIndexOf(address clientAddress, uint256 tokenId)`
check interest bearing token wallet's price index
#### Variables
`productVariables`
(index, interest rate, global update time)

____
### Liquidation{ProtocolName}
implementations for different protocol liquidations
#### Functions
##### `swap()` 
##### `getApproveAmount()`
for protocols that need precalculation of target amount
#### Protocols
##### **UniswapV3**
for simple ERC20 token swapping
##### **AAVEv2**
aTokens swapping - normalized amountIn calculation needed

amountIn = dynamic (aTokens held by pool auto increases with time from interest distributed by AAVE)

amountOut = 1:1 with amountIn

offchain value calculation needed (either by querying aToken.balanceOf() or calculating with liquidityIndex, see LiquidationAAVEv2.sol->getApproveAmount())
##### **Compound**
cTokens swapping - normalized amountOut calculation needed

amountIn = fixed

amountOut = adjusted dynamically with cToken.exchangeRateCurrent()

offchain value calculation needed (query cToken.exchangeRateCurrent() and calculate)
##### **CurveLPs**
curve.fi LP tokens - USDT, USDC, DAI, WBTC, ETH

amountIn = fixed

amountOut = dynamic, queried with token pool.calc_withdraw_one_coin()

using pool.remove_liquidity_one_coin (instead of remove_liquidity) i.e. only returning one coin

- __verified pools__
  - Tricrypto2: USDT + wBTC + WETH
  - 3pool: DAI + USDC + USDT
  - additional pools need extra testing 

##### **UniswapLPs**
uniswap LP tokens - USDT, USDC, DAI, WBTC, ETH

amountIn = tokenId

amounts = token pairs

to acquire LP value: UniswapPositions.positions().liquidity & amountOwed (TBD)
##### **AAVEv3**

(pending implementation)

require layer 2 support first

____
## Testing with Hardhat
```shell
npx hardhat test [test_file.test.ts(optional)]
## remote 
## compile source
npx hardhat compile
## run remote tests
npx hardhat remote-test --network inftest

```
set COINMARKETCAP_API_KEY with you coinmarketcap api key to enable gas cost estimation

impersonate and transfer token to test addresses 
```shell
npx hardhat add-fund --network inftest {address}
npx hardhat deposit --network inftest {address} --usdt 100 --usdc 100 --dai 100 --eth 100 -- wbtc 100
```

## Hardhat commands

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
npx hardhat help
REPORT_GAS=true npx hardhat test
npx hardhat coverage
npx hardhat run scripts/deploy.ts
TS_NODE_FILES=true npx ts-node scripts/deploy.ts
npx eslint '**/*.{js,ts}'
npx eslint '**/*.{js,ts}' --fix
npx prettier '**/*.{json,sol,md}' --check
npx prettier '**/*.{json,sol,md}' --write
npx solhint 'contracts/**/*.sol'
npx solhint 'contracts/**/*.sol' --fix
```

## Etherscan verification

To try out Etherscan verification, you first need to deploy a contract to an Ethereum network that's supported by Etherscan, such as Ropsten.

In this project, copy the .env.example file to a file named .env, and then edit it to fill in the details. Enter your Etherscan API key, your Ropsten node URL (eg from Alchemy), and the private key of the account which will send the deployment transaction. With a valid .env file in place, first deploy your contract:

```shell
hardhat run --network ropsten scripts/sample-script.ts
```

Then, copy the deployment address and paste it in to replace `DEPLOYED_CONTRACT_ADDRESS` in this command:

```shell
npx hardhat verify --network ropsten DEPLOYED_CONTRACT_ADDRESS "Hello, Hardhat!"
```

## Performance optimizations

For faster runs of your tests and scripts, consider skipping ts-node's type checking by setting the environment variable `TS_NODE_TRANSPILE_ONLY` to `1` in hardhat's environment. For more details see [the documentation](https://hardhat.org/guides/typescript.html#performance-optimizations).
