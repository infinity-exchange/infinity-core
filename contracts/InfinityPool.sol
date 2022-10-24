// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "./interfaces/IInfinityPool.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/IInfinityToken.sol";
import "./interfaces/ILiquidationProtocol.sol";
import "./libraries/TransferHelper.sol";
import "./libraries/ERC721Validator.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";
// import "hardhat/console.sol";

contract InfinityPool is IERC721Receiver, IInfinityPool, Initializable, ContextUpgradeable, OwnableUpgradeable {

	mapping(uint64=>address) liquidationProtocolAddresses; // mapping of addresses of liquidation protocols
	mapping(uint64=>int64) productVariables;
	mapping(uint=>uint64) priceIndexes; // 13 decimals
	IInfinityToken public poolToken;
	IWETH public weth;
	// ether tokenId = 0

	function version() public pure returns(uint v){
		v = 15;
	}

	function initialize(address _addrPoolToken, address _addrWETH) public initializer{
		_setInfinityToken(_addrPoolToken);
		_setWETH(_addrWETH);
		__Ownable_init();
	}
	function setInfinityToken(address _addrPoolToken) public onlyOwner {
		// require(_addrPoolToken != address(0), "poolToken 0");
		_setInfinityToken(_addrPoolToken);
	}
	function _setInfinityToken(address _addrPoolToken) internal {
		poolToken = IInfinityToken(_addrPoolToken);
	}
	function setWETH(address _addrWETH) public onlyOwner {
		// require(_addrWETH != address(0), "addrWETH 0");
		_setWETH(_addrWETH);
	}
	function _setWETH(address _addrWETH) internal {
		weth = IWETH(_addrWETH);
	}

	function deposit(
		TokenTransfer[] memory tokenTransfers,
		Action[] calldata actions
	) external payable override {
		require(msg.value>0||tokenTransfers.length>0||actions.length>0,"0-len args");
		require(tokenTransfers.length<1e2,"Token limit");
		require(actions.length<1e2,"Action limit");

		TokenTransfer[] memory _tt = new TokenTransfer[](tokenTransfers.length+(msg.value>0?1:0));
	// take tokens
		for(uint i=0;i<tokenTransfers.length;i++){
			uint256 tokenAmount = tokenTransfers[i].amount;
			// TODO check if ether would overflow in iToken
			uint balance = TransferHelper.balanceOf(tokenTransfers[i].token,address(_msgSender()));
			if(ERC721Validator.isERC721(tokenTransfers[i].token)){
				require(ERC721Validator.isERC721Owner(tokenTransfers[i].token,address(_msgSender()),tokenAmount),"Not ERC721 Owner");
				TransferHelper.safeTransferFromERC721(tokenTransfers[i].token,_msgSender(),address(this),tokenAmount);
			}else{
				require(balance>=tokenAmount,"Insufficient balance");
				TransferHelper.safeTransferFrom(tokenTransfers[i].token,_msgSender(),address(this),tokenAmount);
			}
			_tt[i] = tokenTransfers[i];
		}
		// wrap eth
		if(msg.value>0){
			weth.deposit{value:msg.value}();
			// new array 
			_tt[tokenTransfers.length] = TokenTransfer(address(weth),msg.value);
		}
		emit DepositsOrActionsTriggered(
			_msgSender(), _tt, actions
		);
	}

	function requestWithdraw(TokenTransfer[] calldata tokenTransfers) external override{
		require(tokenTransfers.length>0,"0-len args");
		/* only do checkings */
		for(uint i=0;i<tokenTransfers.length;i++){
			if(ERC721Validator.isERC721(tokenTransfers[i].token)){
				require(poolToken.ifUserTokenExistsERC721(_msgSender(), uint256(uint160(tokenTransfers[i].token)), tokenTransfers[i].amount),"Not ERC721 Owner");
			}else{
				require(poolToken.balanceOf(_msgSender(),uint256(uint160(tokenTransfers[i].token)))>=tokenTransfers[i].amount,"Insufficient Token");
				require(TransferHelper.balanceOf(tokenTransfers[i].token,address(this))>=tokenTransfers[i].amount,"Insufficient pool Token");
			}
		}
		emit WithdrawalRequested(
			_msgSender(), tokenTransfers
		);	
	}

	function action(Action[] calldata actions) external override{
		require(actions.length>0,"0-len args");
		require(actions.length<1e2,"Action limit");
		emit DepositsOrActionsTriggered(
			_msgSender(), (new TokenTransfer[](0)), actions
		);	
	}

	function balanceOf(address clientAddress, uint tokenId) external view override returns (uint balance){
		balance = poolToken.balanceOf(clientAddress,tokenId);
	}

	function priceIndex(uint256 tokenId) external view returns (uint64 value){
		value = priceIndexes[tokenId];
	}
	function productVariable(uint64 id) external view returns (int64 value){
		value = productVariables[id];
	}

	/**
	 * @dev serverTransferFunds only transfers external tokens out, does not check nor update internal balance
	 */
	function serverTransferFunds(address clientAddress, TokenTransfer[] calldata tokenTransfers) onlyOwner external override{
		require(tokenTransfers.length>0,"0-len args");
		emit Withdrawal(clientAddress,tokenTransfers);
		/* do checkings again */
		for(uint i=0;i<tokenTransfers.length;i++){
			if(ERC721Validator.isERC721(tokenTransfers[i].token)){
				// require(poolToken.ifUserTokenExistsERC721(clientAddress, uint256(uint160(tokenTransfers[i].token)), tokenTransfers[i].amount),"Not ERC721 Owner");
				TransferHelper.safeApprove(tokenTransfers[i].token,clientAddress,tokenTransfers[i].amount);
				TransferHelper.safeTransferFromERC721(tokenTransfers[i].token,address(this),clientAddress,tokenTransfers[i].amount);
			}else{
				// require(poolToken.balanceOf(clientAddress,uint256(uint160(tokenTransfers[i].token)))>=tokenTransfers[i].amount,"Insufficient Token");
				require(TransferHelper.balanceOf(tokenTransfers[i].token,address(this))>=tokenTransfers[i].amount,"Insufficient pool Token");
				TransferHelper.safeApprove(tokenTransfers[i].token,clientAddress,tokenTransfers[i].amount);
				TransferHelper.safeTransfer(tokenTransfers[i].token,clientAddress,tokenTransfers[i].amount);
			}
		}
	}
	function serverUpdateBalances(
		address[] calldata clientAddresses, TokenUpdate[][] calldata tokenUpdates,
		PriceIndex[] calldata _priceIndexes
	) onlyOwner external override {
		require(clientAddresses.length>0||tokenUpdates.length>0||_priceIndexes.length>0,"0-len args");
		require(clientAddresses.length==tokenUpdates.length,"args-len Mismatch");
		if(_priceIndexes.length>0){
			for(uint i=0;i<_priceIndexes.length;i++){
				priceIndexes[_priceIndexes[i].key] = _priceIndexes[i].value;
			}
			emit PriceIndexesUpdated(_priceIndexes);
		}
		// TODO require: make sure pool size doesnt change overalld
		for(uint i=0;i<clientAddresses.length;i++){
			poolToken.updateBalance(clientAddresses[i],tokenUpdates[i]);
		}
	}
	function serverUpdateProductVariables(
		ProductVariable[] calldata _productVariables
	) onlyOwner external override {
		require(_productVariables.length>0,"varible length == 0");
		for(uint i=0;i<_productVariables.length;i++){
			productVariables[_productVariables[i].key] = _productVariables[i].value;
		}
		emit ProductVariablesUpdated(_productVariables);
	}

	function registerLiquidationProtocol(
		uint64 protocolId, address protocolAddress
	) onlyOwner external override {
		require(protocolAddress!=address(0x0),"protocol cannot be 0");
		// require(liquidationProtocolAddresses[protocolId]==address(0x0),"protocol ID dupl."); 
		liquidationProtocolAddresses[protocolId] = protocolAddress;
		emit LiquidationProtocolRegistered(protocolAddress);
	}

	function serverLiquidate(
		uint64 protocolId, ILiquidationProtocol.LiquidateParams memory lparams
	) onlyOwner external override {
		address protocolAddress = liquidationProtocolAddresses[protocolId];
		require(protocolAddress!=address(0x0),"protocol incorrect");
		ILiquidationProtocol protocol = ILiquidationProtocol(protocolAddress);
		lparams.amountIn = protocol.getApproveAmount(lparams);
		// for aave: atoken calculation might be ahead of actual balance - amountIn should always be smaller than balance
		// uint256 balance = IERC20(lparams.tokenFrom).balanceOf(address(this));
		// if(lparams.amountIn>balance) lparams.amountIn = balance;
        TransferHelper.safeApprove(lparams.tokenFrom, address(protocolAddress), lparams.amountIn);
        // TransferHelper.safeTransfer(lparams.tokenFrom, address(protocolAddress), lparams.amountIn);
        // console.log("lparams.amountIn");
        // console.log(lparams.amountIn);
		ILiquidationProtocol.LiquidatedAmount[] memory amounts = protocol.swap(lparams);
		// TODO update client wallet?
		emit ServerLiquidateSuccess(lparams.clientAddress,lparams.tokenFrom,lparams.amountIn,amounts);
	}

	// Implementing `onERC721Received` so this contract can receive custody of erc721 tokens
	function onERC721Received( address , address , uint256 , bytes calldata ) external pure override returns (bytes4) {
    return this.onERC721Received.selector;
	}

	function serverLiquidateERC721(
		uint64 protocolId, ILiquidationProtocol.LiquidateParams memory lparams
	) onlyOwner external override {
		address protocolAddress = liquidationProtocolAddresses[protocolId];
		require(protocolAddress!=address(0x0),"protocol incorrect");
		ILiquidationProtocol protocol = ILiquidationProtocol(protocolAddress);
		lparams.amountIn = protocol.getApproveAmount(lparams);
    TransferHelper.safeApprove(lparams.tokenFrom, address(protocolAddress), lparams.amountIn);
		ILiquidationProtocol.LiquidatedAmount[] memory amounts = protocol.swap(lparams);
		// TODO update client wallet?
		emit ServerLiquidateSuccess(lparams.clientAddress,lparams.tokenFrom,lparams.amountIn,amounts);
	}
}
