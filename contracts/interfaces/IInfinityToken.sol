// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./IInfinityPool.sol";

interface IInfinityToken is IERC1155 {

    function setPool(address _poolAddr) external;

    function priceIndexOf(address clientAddress, uint256 tokenId) external returns(uint64);

    function deposit(
    	address clientAddress, 
    	uint[] memory _coinIds, 
    	uint[] memory _amounts
    ) external;

    function withdraw(
    	address clientAddress, 
    	uint[] memory _coinIds, 
    	uint[] memory _amounts
	) external;

    function transfer(
        address from,
        address to,
    	uint[] memory _coinIds, 
        uint[] memory _amounts
    ) external;

    function moveProducts(
        address clientAddress,
    	uint[] memory _mintIds, 
        uint[] memory _mintAmounts,
    	uint[] memory _burnIds, 
        uint[] memory _burnAmounts
    ) external ;

    function updateBalance(
		address clientAddress, IInfinityPool.TokenUpdate[] calldata tokenUpdates
    ) external;

    function ifUserTokenExistsERC721(
        address account,
    	uint tokenAddress, 
    	uint tokenId
    ) external returns(bool exists);
    // function depositERC721(
    // 	address account, 
    // 	uint tokenAddress, 
    // 	uint tokenId
    // ) external;
    // function withdrawERC721(
    // 	address account, 
    // 	uint tokenAddress, 
    // 	uint tokenId
	// ) external;
    // function transferERC721(
    //     address from,
    //     address to,
    // 	uint tokenAddress, 
    //     uint tokenId
    // ) external;

	
}
