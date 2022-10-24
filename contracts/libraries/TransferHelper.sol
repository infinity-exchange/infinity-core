// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

library TransferHelper {
    function safeApprove( address token, address to, uint256 value ) internal {
        // bytes4(keccak256(bytes('approve(address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x095ea7b3, to, value));
        require( success && (data.length == 0 || abi.decode(data, (bool))), 'approve failed' );
    }

    function safeTransferFrom( address token, address from, address to, uint256 value ) internal {
        // bytes4(keccak256(bytes('transferFrom(address,address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require( success && (data.length == 0 || abi.decode(data, (bool))), 'transferFrom failed' );
    }

    function safeTransfer( address token, address to, uint256 value ) internal {
        // bytes4(keccak256(bytes('transfer(address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        require( success && (data.length == 0 || abi.decode(data, (bool))), 'transfer failed' );
    }

    function safeTransferFromERC721( address token, address from, address to, uint256 tokenId ) internal {
        // bytes4(keccak256(bytes('safeTransferFrom(address,address,uint256)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x42842e0e, from, to, tokenId));
        require( success && (data.length == 0 || abi.decode(data, (bool))), 'erc721 safeTransferFrom failed' );
    }

    function balanceOf( address token, address account ) internal returns (uint256 balance){
        // bytes4(keccak256(bytes('balanceOf(address)')));
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x70a08231, account));
        require(success,'balanceOf failed');
        balance = abi.decode(data, (uint256));
    }
}