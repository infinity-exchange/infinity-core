// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import {ILendingPool} from "./libraries/aave/v2/ILendingPool.sol";
import { WadRayMath } from "./libraries/aave/v2/math/WadRayMath.sol";
import "./libraries/TransferHelper.sol";
import "./interfaces/ILiquidationProtocol.sol";
// import "./interfaces/IERC20.sol";
import "./access/Ownable.sol";
import "hardhat/console.sol";

contract LiquidationAaveV2 is ILiquidationProtocol, Ownable {
    using WadRayMath for uint256;

	// @dev lending pool address: refer https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
    ILendingPool public immutable lendingPool;
    
    constructor(ILendingPool _lendingPool, address poolAddress){
        lendingPool = _lendingPool;
        Ownable._setOwner(poolAddress);
    }

    /// @notice swap swaps token on uniswap v3.
    /// calls `exactInputSingle` in the swap router.
    /// @dev The calling address must approve this contract to spend at least `amountIn` worth of its DAI for this function to succeed.
    /// @dev check https://docs.aave.com/developers/v/2.0/guides/troubleshooting-errors#reference-guide for error codes from lendingPool.withdraw()
    /// @param lparams check ILiquidationProtocol.LiquidateParams for params strut.
    /// @return amounts The amount of target token received.
	function swap(
		LiquidateParams memory lparams
	) external override onlyOwner returns (LiquidatedAmount[] memory amounts){

        // check tokenFrom/tokenTo pair validity?
        require(lendingPool.getReserveData(lparams.tokenTo).aTokenAddress==lparams.tokenFrom ,"tokenTo is not underlying asset");

        // msg.sender must approve this contract - should always be InfinityPool
        TransferHelper.safeTransferFrom(lparams.tokenFrom, msg.sender, address(this), lparams.amountIn);
        // console.log("approved token from adaptor to router");

        uint amountOut = lendingPool.withdraw(lparams.tokenTo, lparams.amountIn, msg.sender);
        amounts = new LiquidatedAmount[](1);
        amounts[0] = LiquidatedAmount(lparams.tokenTo,amountOut);

	}

	function getApproveAmount(LiquidateParams memory lparams) view external override returns (uint256 amountOut) {
        uint256 reserveNormalizedIncome = lendingPool.getReserveNormalizedIncome(lparams.tokenTo);
        uint256 liquidityIndex = lendingPool.getReserveData(lparams.tokenTo).liquidityIndex;
        amountOut = lparams.amountIn.rayDiv(liquidityIndex).rayMul(reserveNormalizedIncome);
    }

}
