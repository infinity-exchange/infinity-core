// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "./interfaces/ILiquidationProtocol.sol";
import "./access/Ownable.sol";
import "./libraries/uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
// import "./libraries/TransferHelper.sol";
// import "hardhat/console.sol";
// import "./interfaces/IERC20.sol";

contract LiquidationUniswapLP is ILiquidationProtocol, Ownable {

    address private addrNonfungiblePositionManager;

    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }
    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    constructor(address poolAddress,address _addrNonfungiblePositionManager) {
        addrNonfungiblePositionManager = _addrNonfungiblePositionManager;
        Ownable._setOwner(poolAddress);
    }

    /// @notice swap remove liquidity from uniswap lp. only supports removal of full liquidity
    /// calls `DecreaseLiquidityParams` in the INonfungiblePositionManager.
    /// @dev The calling address must approve this contract to spend at least `amountIn` worth of its DAI for this function to succeed.
    /// @param lparams check ILiquidationProtocol.LiquidateParams for params strut.
    /// @return amounts LiquidatedAmount[] The amount of target token received.
	function swap(
		LiquidateParams memory lparams
	) external override onlyOwner returns (LiquidatedAmount[] memory amounts){
        (address token0, address token1, uint128 liquidity) = _getPositions(lparams.amountIn);
        require(liquidity>0,"liquidity is 0");

        // amount0Min and amount1Min are price slippage checks
        // if the amount received after burning is not greater than these minimums, transaction will fail
        DecreaseLiquidityParams memory params =
            DecreaseLiquidityParams({
                tokenId: lparams.amountIn,
                liquidity: liquidity, // always remove all liquidity
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            });
        
        (bool success,bytes memory data) = addrNonfungiblePositionManager.call(abi.encodeWithSelector(0x0c49ccbe,params)); // bytes4(keccak256(bytes("decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))")))
        require(success&&data.length>0,string(data)); //"npm.decreaseLiquidity failed"
        // (uint256 amount0, uint256 amount1) = abi.decode(data,(uint256,uint256));

        // collect all and send to pool
        CollectParams memory params2 =
            CollectParams({
                tokenId:lparams.amountIn,
                recipient:msg.sender,
                amount0Max:type(uint128).max,
                amount1Max:type(uint128).max
            });
        (success,data) = addrNonfungiblePositionManager.call(abi.encodeWithSelector(0xfc6f7865,params2)); // bytes4(keccak256(bytes("collect((uint256,address,uint128,uint128))")))
        require(success&&data.length>0,string(data)); //"npm.collectAllFees failed"
        (uint256 amount0, uint256 amount1) = abi.decode(data,(uint256,uint256));

        amounts = new LiquidatedAmount[](2);
        amounts[0] = LiquidatedAmount(token0,amount0);
        amounts[1] = LiquidatedAmount(token1,amount1);
	}

	function getApproveAmount(LiquidateParams memory lparams) pure external override returns (uint256 amountOut) { 
        amountOut = lparams.amountIn; // tokenId
        // (bool success,bytes memory data) = addrNonfungiblePositionManager.call(abi.encodeWithSelector(0x99fbab88,lparams.amountIn)); // bytes4(keccak256(bytes("positions(uint256)")))
        // require(success&&data.length>0,"npm.positions failed");
        // ( , , , , , , , uint128 liquidity) =  abi.decode(data,(uint96, address, address, address, uint24, int24, int24, uint128));
        // amountOut = liquidity; //lparams.amountIn; 
    }

    function _getPositions(uint256 tokenId) private returns(address token0,address token1,uint128 liquidity){
        (bool success,bytes memory data) = addrNonfungiblePositionManager.call(abi.encodeWithSelector(0x99fbab88,tokenId)); // bytes4(keccak256(bytes("positions(uint256)")))
        require(success&&data.length>0,"npm.positions failed");
        ( ,, token0, token1, , , , liquidity) =  abi.decode(data,(uint96, address, address, address, uint24, int24, int24, uint128));
    }

    // TODO check if remove liquidity already calculates fees
    // /// @notice Collects the fees associated with provided liquidity
    // /// @dev The contract must hold the erc721 token before it can collect fees
    // /// @param tokenId The id of the erc721 token
    // /// @return amount0 The amount of fees collected in token0
    // /// @return amount1 The amount of fees collected in token1
    // function collectAllFees(uint256 tokenId) external returns (uint256 amount0, uint256 amount1) {
    //     // Caller must own the ERC721 position, meaning it must be a deposit

    //     // set amount0Max and amount1Max to uint256.max to collect all fees
    //     // alternatively can set recipient to msg.sender and avoid another transaction in `sendToOwner`
    //     INonfungiblePositionManager.CollectParams memory params =
    //         INonfungiblePositionManager.CollectParams({
    //             tokenId: tokenId,
    //             recipient: address(this),
    //             amount0Max: type(uint128).max,
    //             amount1Max: type(uint128).max
    //         });

    //     (amount0, amount1) = nonfungiblePositionManager.collect(params);

    //     // send collected feed back to owner
    //     _sendToOwner(tokenId, amount0, amount1);
    // }


    // /// @notice Transfers the NFT to the owner
    // /// @param tokenId The id of the erc721
    // function retrieveNFT(uint256 tokenId) external {
    //     // must be the owner of the NFT
    //     require(msg.sender == deposits[tokenId].owner, "Not the owner");
    //     // transfer ownership to original owner
    //     nonfungiblePositionManager.safeTransferFrom(address(this), msg.sender, tokenId);
    //     //remove information related to tokenId
    //     delete deposits[tokenId];
    // }
}