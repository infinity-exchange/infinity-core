// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "./interfaces/IERC20.sol";
import "./libraries/TransferHelper.sol";
import "./interfaces/ILiquidationProtocol.sol";
import "./access/Ownable.sol";
// import "@openzeppelin/contracts/utils/Strings.sol";
// import "hardhat/console.sol";

contract LiquidationCurve is ILiquidationProtocol, Ownable {


    address private _addrProvider; // should be immutable at 0x0000000022D53366457F9d5E68Ec105046FC4383
    
    constructor(address addrProvider,address poolAddress) {
        _addrProvider = addrProvider;
        Ownable._setOwner(poolAddress);
    }
    
    /// @notice swap swaps token on uniswap v3.
    /// calls `exactInputSingle` in the swap router.
    /// @dev The calling address must approve this contract to spend at least `amountIn` worth of its DAI for this function to succeed.
    /// @param lparams check ILiquidationProtocol.LiquidateParams for params strut.
    /// @return amounts The amount of target token received.
	function swap(
		LiquidateParams memory lparams
	) external override onlyOwner returns (LiquidatedAmount[] memory amounts){
        (bool success,bytes memory data) = _addrProvider.call(abi.encodeWithSelector(0xa262904b)); // bytes4(keccak256(bytes("get_registry()")))
        address registry = abi.decode(data,(address));
        require(success&&registry!=address(0x00),"registry not found");
        (success,data) = registry.call(abi.encodeWithSelector(0xbdf475c3,lparams.tokenFrom)); // bytes4(keccak256(bytes("get_pool_from_lp_token(address)")))
        address pool = abi.decode(data,(address));
        require(success&&pool!=address(0x00),"LP token pool not found");
        // console.log("pool");
        // console.log(pool);
        (success,data) = registry.call(abi.encodeWithSelector(0x940494f1,pool)); // bytes4(keccak256(bytes("get_n_coins(address)")))
        uint256[] memory minAmounts = new uint256[](abi.decode(data,(uint256[2]))[1]); for(uint256 i=0;i<minAmounts.length;i++){minAmounts[i]=0;}
        // console.log("coinCounts");
        // console.log(coinCounts[0]);
        // console.log(coinCounts[1]);
        require(success,"get_n_coins(address) failed");
        (success,data) = registry.call(abi.encodeWithSelector(0xa77576ef,pool)); // bytes4(keccak256(bytes("get_underlying_coins(address)")))
        address[8] memory coins = abi.decode(data,(address[8]));
        require(success&&coins.length>0,"pool coins not found");
        int256 coinIdx = -1;
        for(uint256 i=0;i<coins.length;i++){
            // console.log(coins[i]);
            if(coins[i]==lparams.tokenTo){
                coinIdx = int256(i);
            }
        }
        require(coinIdx!=-1,"tokenTo is not underlying asset");
        (success,data) = pool.call(abi.encodeWithSelector(bytes4(keccak256(bytes("calc_withdraw_one_coin(uint256,uint256)"))),lparams.amountIn,uint256(coinIdx))); // bytes4(keccak256(bytes("calc_withdraw_one_coin(uint256,uint256)")))
        if(!(success&&data.length>0)){ // retry with different signature cause curve can't keep their signatures straight
            (success,data) = pool.call(abi.encodeWithSelector(bytes4(keccak256(bytes("calc_withdraw_one_coin(uint256,int128)"))),lparams.amountIn,int128(coinIdx))); // bytes4(keccak256(bytes("calc_withdraw_one_coin(uint256,int128)")))
        }
        // console.logBytes(data);
        require(success&&data.length>0,"pool withdraw calc failed");
        (uint256 amountOut) = abi.decode(data,(uint256));
        // console.log("calc_withdraw_one_coin: amountOut");
        // console.log(amountOut);

        // msg.sender must approve this contract - should always be InfinityPool
        TransferHelper.safeTransferFrom(lparams.tokenFrom, msg.sender, address(this), lparams.amountIn);
        
        (success,data) = pool.call(abi.encodeWithSelector(bytes4(keccak256(bytes("remove_liquidity_one_coin(uint256,uint256,uint256)"))),lparams.amountIn,coinIdx,amountOut)); // bytes4(keccak256(bytes("remove_liquidity_one_coin(uint256,int128,uint256)")))
        if(!success){ // retry with different signature cause curve can't keep their signatures straight
            // uint128 call DOESNT throw error and cannot be checked by success==false
            (success,data) = pool.call(abi.encodeWithSelector(bytes4(keccak256(bytes("remove_liquidity_one_coin(uint256,int128,uint256)"))),lparams.amountIn,coinIdx,amountOut));
        }
        require(success,"pool withdraw failed");
        // NOTE: remove_liquidity fails - 3pool doesnt even return amount withdrawn so it's very inefficient to use anyways
        // (success,data) = pool.call(abi.encodeWithSelector(bytes4(keccak256(bytes(string.concat("remove_liquidity(uint256,uint256[",Strings.toString(minAmounts.length),"])")))),lparams.amountIn,minAmounts)); // bytes4(keccak256(bytes("remove_liquidity(uint256,uint256[])")))
        // require(success,"remove_liquidity failed");
        // for(uint256 i=0;i<coins.length;i++){
        //     if(coins[i]!=address(0x00)){
        //         uint256 balance = TransferHelper.balanceOf(lparams.tokenTo, coins[i]);
        //         console.log("remove_liquidity: coin balance");
        //         console.log(coins[i]);
        //         console.log(balance);
        //         TransferHelper.safeApprove(coins[i], address(msg.sender), balance);
        //         TransferHelper.safeTransfer(coins[i], address(msg.sender), balance);
        //     }
        // }

        TransferHelper.safeApprove(lparams.tokenTo, address(msg.sender), amountOut);
        TransferHelper.safeTransfer(lparams.tokenTo, address(msg.sender), amountOut);

        amounts = new LiquidatedAmount[](1);
        amounts[0] = LiquidatedAmount(lparams.tokenTo,amountOut);
	}

	function getApproveAmount(LiquidateParams memory lparams) pure external override returns (uint256 amountOut) { amountOut = lparams.amountIn; }

}
