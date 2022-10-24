// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/Address.sol";

contract InfinityTokenERC721 {

    // ERC721 mapping: token->tokenId->wallet - we dont care about the token details
    mapping(uint => mapping(uint => address)) internal _balancesNFT;

    function _initializeInfinityTokenERC721() internal{
	}

}
