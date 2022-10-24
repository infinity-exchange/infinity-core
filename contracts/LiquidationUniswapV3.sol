// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./libraries/TransferHelper.sol";
import "./interfaces/ILiquidationProtocol.sol";
import "./access/Ownable.sol";
// import "hardhat/console.sol";

contract LiquidationUniswapV3 is ILiquidationProtocol, Ownable {

	// @dev swap router address: refer https://docs.uniswap.org/protocol/reference/deployments
    ISwapRouter public immutable swapRouter;
    
    constructor(ISwapRouter _swapRouter, address poolAddress) {
        swapRouter = _swapRouter;
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
        // msg.sender must approve this contract - should always be InfinityPool
        TransferHelper.safeTransferFrom(lparams.tokenFrom, msg.sender, address(this), lparams.amountIn);
        TransferHelper.safeApprove(lparams.tokenFrom, address(swapRouter), lparams.amountIn);
        // console.log("approved token from adaptor to router");

        // Naively set amountOutMinimum to 0. In production, use an oracle or other data source to choose a safer value for amountOutMinimum.
        // We also set the sqrtPriceLimitx96 to be 0 to ensure we swap our exact input amount.
        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: lparams.tokenFrom,
                tokenOut: lparams.tokenTo,
                fee: lparams.poolFee,
                recipient: msg.sender,
                deadline: block.timestamp*2,
                amountIn: lparams.amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        // The call to `exactInputSingle` executes the swap.
        uint256 amountOut = swapRouter.exactInputSingle(params);
        amounts = new LiquidatedAmount[](1);
        amounts[0] = LiquidatedAmount(lparams.tokenTo,amountOut);
	}
    
	function getApproveAmount(LiquidateParams memory lparams) pure external override returns (uint256 amountOut) { amountOut = lparams.amountIn; }

}
