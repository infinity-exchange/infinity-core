// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "./libraries/compound-protocol/contracts/CTokenInterface.sol";
// import "compound-protocol/contracts/CTokenInterfaces.sol";
import "./interfaces/IERC20.sol";
import "./libraries/TransferHelper.sol";
import "./interfaces/ILiquidationProtocol.sol";
import "./access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
// import "hardhat/console.sol";

contract LiquidationCompound is ILiquidationProtocol, Ownable {
    
    constructor(address poolAddress) {
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

        CErc20 cToken = CErc20(lparams.tokenFrom);
        require(cToken.underlying()==lparams.tokenTo,"tokenTo is not underlying asset");
        // exchange rate in 1e18
        //!!! the ref is incorrect !!! not 1*10^(18-8+underlying token decimals) !!!
        //!!! DO NOT refer to ref: https://compound.finance/docs/ctokens#exchange-rate & https://compound.finance/docs#protocol-math
        //!!! CHECK ACTUAL CODE FROM GITHUB INSTEAD !!!
        uint exchangeRate = cToken.exchangeRateCurrent();
        uint amountOut = lparams.amountIn * exchangeRate / 1e18;

        uint errorCode = cToken.redeem(lparams.amountIn); // ref: https://compound.finance/docs/ctokens#error-codes
        require(errorCode==0,Strings.toString(errorCode));

        TransferHelper.safeApprove(lparams.tokenTo, address(msg.sender), amountOut);
        TransferHelper.safeTransfer(lparams.tokenTo, address(msg.sender), amountOut);

        amounts = new LiquidatedAmount[](1);
        amounts[0] = LiquidatedAmount(lparams.tokenTo,amountOut);
	}

	function getApproveAmount(LiquidateParams memory lparams) pure external override returns (uint256 amountOut) { amountOut = lparams.amountIn; }

}
