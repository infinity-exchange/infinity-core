// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

// import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./libraries/ERC721Validator.sol";
import "./interfaces/IInfinityToken.sol";
import "./InfinityTokenERC1155.sol";
import "./InfinityTokenERC721.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
// import "@openzeppelin/contracts/interfaces/IERC721.sol";
// import "hardhat/console.sol";

contract InfinityToken is IInfinityToken, Initializable, InfinityTokenERC1155, InfinityTokenERC721 {
    using Address for address;

	function initialize() public initializer{
        _initializeInfinityTokenERC1155("https://infinity.exchange/t/{tokenAddress}.json");
        _initializeInfinityTokenERC721();
		__Ownable_init();
    }

    /**
     * @dev set pool contract for permission check, and interest bearing balance calculation
     */
    function setPool(address _poolAddr) external override onlyOwner {
        pool = IInfinityPool(_poolAddr);
    }

    function priceIndexOf(address clientAddress, uint256 tokenId) external override view returns(uint64 priceIndex){
        priceIndex = _balances[tokenId][clientAddress].priceIndex;
    }

    function deposit(
    	address clientAddress, 
    	uint[] memory _coinIds, 
    	uint[] memory _amounts
    ) external override onlyPoolOrOwner {
        for(uint i=0;i<_coinIds.length;i++){
            uint tokenId = _coinIds[i];
			require(!ERC721Validator.isERC721(address(uint160(tokenId))),"ERC721 not accepted");
        }
        _mintBatch(clientAddress, _coinIds, _amounts, "");
    }
    function withdraw(
    	address clientAddress, 
    	uint[] memory _coinIds, 
    	uint[] memory _amounts
	) external override onlyPoolOrOwner {
        uint256[] memory _tokenIds = new uint256[](_coinIds.length);
        uint256[] memory _tokenAmounts = new uint256[](_amounts.length);
        for(uint i=0;i<_tokenIds.length;i++){
            uint tokenId = _coinIds[i];
            uint tokenAmount = _amounts[i];
			if(ERC721Validator.isERC721(address(uint160(tokenId)))){
                _withdrawERC721(clientAddress,tokenId,tokenAmount);
			}else{
                _tokenIds[i] = tokenId;
                _tokenAmounts[i] = tokenAmount;
            }
        }
        _burnBatch(clientAddress, _tokenIds, _tokenAmounts);
    }
    function transfer(
        address from,
        address to,
    	uint[] memory _coinIds, 
        uint[] memory _amounts
    ) external override onlyPoolOrOwner {
        for(uint i=0;i<_coinIds.length;i++){
			require(!ERC721Validator.isERC721(address(uint160(_coinIds[i]))),"cannot transfer ERC721 token");
        }
        _safeBatchTransferFrom(from, to, _coinIds, _amounts, "");
    }
    
    function moveProducts(
        address clientAddress,
    	uint[] memory _mintIds, 
        uint[] memory _mintAmounts,
    	uint[] memory _burnIds, 
        uint[] memory _burnAmounts
    ) external override onlyPoolOrOwner {
        for(uint i=0;i<_mintIds.length;i++){
			require(!ERC721Validator.isERC721(address(uint160(_mintIds[i]))),"cannot transfer ERC721 token");
        }
        for(uint i=0;i<_burnIds.length;i++){
			require(!ERC721Validator.isERC721(address(uint160(_burnIds[i]))),"cannot transfer ERC721 token");
        }
        _mintBatch(clientAddress, _mintIds, _mintAmounts, "");
        _burnBatch(clientAddress, _burnIds, _burnAmounts);
    }

    function updateBalance(
		address clientAddress, IInfinityPool.TokenUpdate[] calldata tokenUpdates
    ) external override onlyPoolOrOwner {
        require(tokenUpdates.length>0,"0-len args");
        uint256[] memory _tokenAmounts = new uint256[](tokenUpdates.length);
        uint256[] memory _tokenIds = new uint256[](tokenUpdates.length);
        uint64[] memory _tokenPriceIndexes = new uint64[](tokenUpdates.length);
        for(uint j=0;j<tokenUpdates.length;j++){
            uint tokenId = tokenUpdates[j].tokenId;
            if(tokenUpdates[j].isERC721){
			// if(ERC721Validator.isERC721(address(uint160(tokenId)))){
                _depositERC721(clientAddress, tokenUpdates[j].tokenId, tokenUpdates[j].amount);
			}else{
                _tokenIds[j] = tokenId;
                _tokenAmounts[j] = tokenUpdates[j].amount;
                _tokenPriceIndexes[j] = tokenUpdates[j].priceIndex;
            }
        }
        _updateBatch(clientAddress,_tokenIds,_tokenAmounts,_tokenPriceIndexes,"");
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override onlyPoolOrOwner {
        // empty implementation - will check onlyPoolOrOwner
    }

    // NFT balances = different balance
    function ifUserTokenExistsERC721(
        address account,
    	uint tokenAddress, 
    	uint tokenId
    ) external view override returns(bool exists) {
        exists = _ifUserTokenExistsERC721(account,tokenAddress,tokenId);
    }
    function _ifUserTokenExistsERC721(
        address account,
    	uint tokenAddress, 
    	uint tokenId
    ) internal view returns(bool exists) {
        exists = _balancesNFT[tokenAddress][tokenId]==account;
    }
    function _depositERC721(
    	address account, 
    	uint tokenAddress, 
    	uint tokenId
    ) internal onlyPoolOrOwner {
        require(account != address(0), "ERC1155: mint to the zero address");
        require(_balancesNFT[tokenAddress][tokenId]==address(0), "ERC721 already owned by another user");
        address operator = _msgSender();
        _balances[tokenAddress][account].amount += 1; // standard balance update
        _balancesNFT[tokenAddress][tokenId] = account; // save tokenId to user
        emit TransferSingle(operator, address(0), account, tokenAddress, tokenId);
        __doSafeTransferAcceptanceCheck(operator, address(0), account, tokenAddress, tokenId, "");
    }
    function _withdrawERC721(
    	address account, 
    	uint tokenAddress, 
    	uint tokenId
	) internal onlyPoolOrOwner {
        require(account != address(0), "ERC1155: burn from the zero address");
        address operator = _msgSender();
        require(_balances[tokenAddress][account].amount > 0, "ERC1155: burn tokenId exceeds balance");
        require(_balancesNFT[tokenAddress][tokenId]==address(account), "ERC721: already belongs to another address");
        _balances[tokenAddress][account].amount -= 1; // standard balance update
        _balancesNFT[tokenAddress][tokenId] = address(0);
        emit TransferSingle(operator, account, address(0), tokenAddress, tokenId);
    }
    // function transferERC721(
    //     address from,
    //     address to,
    // 	uint tokenAddress, 
    //     uint tokenId
    // ) external override onlyPoolOrOwner {
    //     require(
    //         from == _msgSender() || isApprovedForAll(from, _msgSender()),
    //         "ERC1155: caller is not owner nor approved"
    //     );
    //     require(to != address(0), "ERC1155: transfer to the zero address");
    //     address operator = _msgSender();
    //     require(_balances[tokenAddress][from].amount > 0, "ERC1155: insufficient balance for transfer");
    //     require(_balancesNFT[tokenAddress][tokenId]==from, "ERC721: does not belong to from address");
    //     _balances[tokenAddress][from].amount -= 1;
    //     _balances[tokenAddress][to].amount += 1;
    //     _balancesNFT[tokenAddress][tokenId] = to;
    //     emit TransferSingle(operator, from, to, tokenAddress, tokenId);
    //     __doSafeTransferAcceptanceCheck(operator, from, to, tokenAddress, tokenId, "");
    // }

    // inherited from ERC1155 private function
    function __doSafeTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256 tokenAddress,
        uint256 tokenId,
        bytes memory data
    ) private {
        if (to.isContract()) {
            try IERC1155Receiver(to).onERC1155Received(operator, from, tokenAddress, tokenId, data) returns (bytes4 response) {
                if (response != IERC1155Receiver.onERC1155Received.selector) {
                    revert("ERC1155: ERC1155Receiver rejected tokens");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("ERC1155: transfer to non ERC1155Receiver implementer");
            }
        }
    }

}
