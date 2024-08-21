// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "hardhat/console.sol";


error AlreadyDroped();
contract CoreskyAirDrop is AccessControl {
    using Address for address;
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using BitMaps for BitMaps.BitMap;
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ASSET_ROLE = keccak256("ASSET_ROLE");
    bytes32 constant BOT_SIGN_DEPOSIT = keccak256('deposit(uint256 serialNo,address token,uint256 amount,uint256 deadline)');


    struct ApNFTDrop{
        uint256 batchNo;
        address user;
        address token;
        uint256 amount;
        uint256 searilNo;
    }

    // dropBatchNo => searilNo[] 
    mapping(uint256=> uint256[]) private batchNoMap;
    // searilNo => ApNFTDrop 
    mapping(uint256=> ApNFTDrop) private searilNoMap;
    // distribute status of index
    BitMaps.BitMap bitmap;     

    // searilNo => token 
    mapping(uint256=> address) public tokenMap;

    // deposit token event
    event DepositToken(address indexed token, uint256 amount, uint256 time, uint256 searilNo);

    // Airdrop token event
    event AirDropToken(address indexed token, address indexed to, uint256 indexed amount, uint256 time, uint256 searilNo, uint256 batchNo);

    constructor(address admin, address operator) {
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(OPERATOR_ROLE, operator);
    }

    /**
     * @dev Token deposit method
     *
     * @param serialNo  serial no used to associate Allocation.
     * @param token Unlock token address.
     * @param amount Unlock token amount.
     * @param deadline Signature validity period.
     * @param signature Data Signature.
     */
    function deposit(uint256 serialNo, address token, uint256 amount, uint256 deadline, bytes memory signature) external {
        require(token.isContract(), "Token non existent");
        require(amount > 0, "amount must be getter 0");
        uint256 _balance = IERC20(token).balanceOf(msg.sender);
        require(_balance >= amount, "Token Insufficient");
        require(tokenMap[serialNo] == address(0), "The current batch of data has been processed");        
        
        // sign verify
        require(verifyDeposit(serialNo, token, amount,deadline,signature), "Sign verify error");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        tokenMap[serialNo] = token;
        emit DepositToken(token, amount, block.timestamp, serialNo);
    }

    /**
     * @dev verifyDeposit.
     */
    function verifyDeposit(
        uint256 serialNo, 
        address token, 
        uint256 amount,
        uint256 deadline,
        bytes memory signature
    ) public view returns (bool) {
        require(block.timestamp < deadline, "The sign deadline error");
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                BOT_SIGN_DEPOSIT,
                serialNo,
                token,
                amount,
                deadline
            )
        );

        return hasRole(OPERATOR_ROLE, messageHash.recover(signature));
    }


    /**
     * batch transfer  native token
     */
    function sendNativeToken(address[] calldata _to, uint256[] calldata _value)
        public
        payable
        onlyRole(OPERATOR_ROLE)
        returns (bool _success)
    {
        assert(_to.length == _value.length);
        assert(_to.length <= 1000);
        uint256 beforeValue = msg.value;
        uint256 afterValue = 0;
        for (uint256 i = 0; i < _to.length; i++) {
            afterValue = afterValue + _value[i];
            assert(payable(_to[i]).send(_value[i]));
        }
        uint256 remainingValue = beforeValue - afterValue;
        if (remainingValue > 0) {
            assert(payable(msg.sender).send(remainingValue));
        }
        return true;
    }

    /**
     * batch transfer erc20 token
     */
    function sendERC20(
        uint256 _batchNo,
        address _tokenAddress,
        address[] calldata _to,
        uint256[] calldata _value,
        uint256[] calldata _serialNo
    ) public payable onlyRole(OPERATOR_ROLE) returns (bool _success) {
        require(_to.length == _value.length, "The length of array [_to] and array [_value] does not match");
        require(_to.length == _serialNo.length, "The length of array [_to] and array [_serialNo] does not match");
        require(_to.length <= 1000, "The maximum limit of 1000");

        // Verify drop
        if (bitmap.get(_batchNo)) revert AlreadyDroped();
        // Mark it droped
        bitmap.set(_batchNo);

        if(_tokenAddress == address(0)){
            uint256 total = 0;
            for (uint256 i = 0; i < _value.length; i++) {
                total = total + _value[i];
            }
            require(msg.value >= total, "Insufficient amount token");
            uint256 beforeValue = msg.value;
            uint256 afterValue = 0;
            for (uint256 i = 0; i < _to.length; i++) {
                afterValue = afterValue + _value[i];
                console.log("sendERC20Token from: %s to %s, send value:%s",msg.sender, _to[i], _value[i]);
                assert(payable(_to[i]).send(_value[i]));
                emitAirDropToken(_batchNo,_tokenAddress,_to[i], _value[i], _serialNo[i]);
            }
            uint256 remainingValue = beforeValue - afterValue;
            if (remainingValue > 0) {
                assert(payable(msg.sender).send(remainingValue));
            }
        }else {
            require(msg.value == 0, "Needn't pay mainnet token");
            IERC20 token = IERC20(_tokenAddress);
            
            uint256 allowed = token.allowance(msg.sender,address(this));
            uint256 total = 0;
            for (uint256 i = 0; i < _value.length; i++) {
                total += _value[i];
            }
            
            console.log("sendERC20Token allowed %s value:%s, pay total:%s",address(this), allowed, total);
            require(total <= allowed, "ERC20 Token Insufficient limit");

            for (uint256 i = 0; i < _to.length; i++) {
                uint256 amount =  _value[i];
                console.log("sendERC20Token from: %s to %s, value:%s",msg.sender, _to[i], amount);
                token.safeTransferFrom(msg.sender, _to[i], amount);
                emitAirDropToken(_batchNo,_tokenAddress,_to[i], _value[i], _serialNo[i]);
            }
        }

        return true;
    }

    /**
     * @dev batch transfer erc20 token
     *  Batch unlocking of user asset package tokens
     *
     * @param _batchNo Unlock batch number.
     * @param _tokenAddress Unlock token address.
     * @param _to Ap NFT Pledge user address array.
     * @param _value Unlock quantity array.
     * @param _serialNo serial no array.
     * @return _success returns unlock ture or false
     */
    function releaseToken(
        uint256 _batchNo,
        address _tokenAddress,
        address[] calldata _to,
        uint256[] calldata _value,
        uint256[] calldata _serialNo
    ) public onlyRole(OPERATOR_ROLE) returns (bool _success) {
        require(_batchNo > 0, "BatchNo is empty");
        require(_to.length == _value.length, "The length of array [_to] and array [_value] does not match");
        require(_to.length == _serialNo.length, "The length of array [_to] and array [_serialNo] does not match");
        require(_to.length <= 1000, "The maximum limit of 1000");

        // Verify drop
        if (bitmap.get(_batchNo)) revert AlreadyDroped();
        // Mark it droped
        bitmap.set(_batchNo);

        uint256 total;
        for(uint256 i; i< _value.length; i++){
            total+= _value[i];
        }

        require(total > 0, "Total value must be getter 0");
        uint256 bal = getWithdrawableAmount(_tokenAddress);
        require(bal > 0, "Total balance must be getter 0");
        require(bal >= total, "Insufficient token balance");


        IERC20 token = IERC20(_tokenAddress);

        for (uint256 i = 0; i < _to.length; i++) {
            uint256 amount =  _value[i];
            console.log("sendERC20Token safeTransfer to %s, value:%s", _to[i], amount);
            token.safeTransfer(_to[i], amount);
            emitAirDropToken(_batchNo,_tokenAddress,_to[i], _value[i], _serialNo[i]);
        }
        
        return true;
    }


    function emitAirDropToken(
        uint256 _batchNo,
        address _tokenAddress,
        address _to,
        uint256 _value,
        uint256 _serialNo
    ) internal {
        // mapping(uint256=> uint256[]) private batchNoMap;
        batchNoMap[_batchNo].push(_serialNo);
        //mapping(uint256=> ApNFTDrop) private searilNoMap;
        searilNoMap[_serialNo] = ApNFTDrop(_batchNo,_to, _tokenAddress,_value,_serialNo);
        //  event AirDropToken(address indexed token, address indexed to, uint256 indexed amount, uint256 time, uint256 searilNo, uint256 batchNo);
        emit AirDropToken(_tokenAddress, _to, _value, block.timestamp, _serialNo, _batchNo);
    }

    /**
     * @dev Returns the apnft drop result by serialNo.
     * @param _serialNo Execute batch number
     * @return (drop.batchNo, drop.user, drop.token, drop.amount, drop.searilNo)
     */
    function getApNFTDrop(uint256 _serialNo)
        external
        view
        returns (uint256, address, address, uint256, uint256)
    {
        ApNFTDrop storage drop = searilNoMap[_serialNo];
        return (drop.batchNo, drop.user, drop.token, drop.amount, drop.searilNo);
    }

    /**
     * @dev Returns Batch result.
     * @param _batchNo Execute batch number
     * @return searilNo's array
     */
    function getBatchSerialNo(uint256 _batchNo)
        external
        view
        returns (uint256[] memory)
    {
        return batchNoMap[_batchNo];
    }

    /**
     * @dev withdraw native currency
     * 
     */
    function withdraw(address payable _to) public onlyRole(ASSET_ROLE) {
        _to.transfer(address(this).balance);
    }

   /**
     * @dev get this contract's native currency balance
     * @return balance
     */
    function thisBalance() public view returns (uint256){
        return address(this).balance;
    }


    /**
     * @dev withdraw token
     * 
     *
     * @param _token token contract.
     * @param _to  withdraw address.
     */
    function withdrawToken(address _token, address _to) public onlyRole(ASSET_ROLE) {
        uint256 balance = getWithdrawableAmount(_token);
        IERC20(_token).transfer(_to, balance);
    }

    /**
     * @dev Returns the amount of tokens that can be withdrawn by the owner.
     * @return the amount of tokens
     */
    function getWithdrawableAmount(address _token) public view returns (uint256) {
        return IERC20(_token).balanceOf(address(this));
    }

}
