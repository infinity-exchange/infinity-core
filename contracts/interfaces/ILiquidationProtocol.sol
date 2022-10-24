// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

interface ILiquidationProtocol {

	struct LiquidateParams {
		address clientAddress;
		address tokenFrom;
		address tokenTo;
		uint256 amountIn; // for ERC721: amountIn is tokenId
		uint24 poolFee;
	}

	struct LiquidatedAmount {
		address token;
		uint256 amount;
	}
	
	function swap(
		LiquidateParams memory lparams
	) external returns (LiquidatedAmount[] memory amounts);
	
	function getApproveAmount(
		LiquidateParams memory lparams
	) external returns (uint256 amountOut);
}
