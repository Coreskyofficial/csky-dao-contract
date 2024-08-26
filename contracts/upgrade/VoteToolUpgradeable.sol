// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../libraries/Types.sol";
import "../libraries/MetaTxLibUpgradeable.sol";

import "hardhat/console.sol";

contract VoteToolUpgradeable is Initializable, AccessControlUpgradeable {


    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ASSET_ROLE = keccak256("ASSET_ROLE");

    using SafeMath for uint256;
    using Address for address;
    using SafeERC20 for IERC20;


    enum PayType {
        None,  // 0
        Native,// 1
        Token  // 2
    }

    IERC20 public proposalToken;

    PayType public pay;

    uint256 ONE_VOTE_ETH = 1 gwei;

    /* BASE PERCENT. */
    uint public constant BASE_PERCENT = 100;
    
    // expire 7 day
    uint256 public constant EXPIRE_TIME = 604800;

    // proposals
    uint256[] public proposals;

    // proposal => proposalOwner
    mapping(uint256 => address) private owners;
    // proposal => Proposal
    mapping(uint256 => Types.Proposal) private proposalMap;

    // support's user => proposal => count
    mapping(address => mapping(uint256 => uint256)) private supportVoteMap;

    // oppose's user => proposal => count
    mapping(address => mapping(uint256 => uint256)) private opposeVoteMap;

    // signature => exsist: 0 or 1 
    mapping(bytes32 =>uint8) public signMap;

    

    event AddProposal(uint256 indexed proposal, address indexed from, uint256 expireTime);
    event Vote(address indexed from, uint256 indexed proposal, uint256 count, string voteType);


   /**
     * @dev Initializes the contract by setting a `admin_` and a `operator_` to the Alloction.
     */
    function initialize(address admin_, address operator_) external initializer {
        __VoteTool_init(admin_, operator_);
    }

    /**
     * @dev Initializes the contract by setting a `admin_` and a `operator_` to the Alloction.
     */
    function __VoteTool_init(address admin_, address operator_) internal onlyInitializing {
        _setupRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(OPERATOR_ROLE, operator_);
        pay = PayType.None;
    }


    modifier onlyOwner(uint256 _proposal) {
        require(tx.origin == owners[_proposal], "Ownable: caller is not the owner");
        _;
    }

    /**
     * create proposal
     */
    
    function addProposal(Types.EIP712Signature calldata signature, uint256 serialNo, uint256 expireTime) public {

        require(serialNo > 0, "proposal empty");
        require(proposalMap[serialNo].serialNo == 0, "proposal exists");

        // sign verify
        bytes32 signHash = keccak256(abi.encodePacked(signature.r, signature.s, signature.v));
        if(signMap[signHash] > 0){
            require(false, "ApplyProjectVoteAlreadyExists");
            // revert Errors.ApplyProjectVoteAlreadyExists();
        }

        Types.Proposal memory vote = Types.Proposal(
                        serialNo,
                        address(0),
                        0,
                        0,
                        0,
                        expireTime,
                        0);
        MetaTxLibUpgradeable.validateAddProposalSignature(signature, vote);

        signMap[signHash] = 1;
        proposals.push(serialNo);
        
        proposalMap[serialNo] = vote;

        emit AddProposal(serialNo, msg.sender, expireTime);
    }

    function voteSupport(Types.EIP712Signature calldata signature, uint256 serialNo, uint256 voteCount) public payable {

        require(voteCount > 0, "The number of votes needs to be greater than 0");

        Types.Proposal storage p = proposalMap[serialNo];

        require(p.serialNo > 0, "proposal not exists");
        require(p.expireTime >= block.timestamp, "proposal expired");
        // sign verify
        bytes32 signHash = keccak256(abi.encodePacked(signature.r, signature.s, signature.v));
        if(signMap[signHash] > 0){
            require(false, "ApplyProjectVoteAlreadyExists");
            // revert Errors.ApplyProjectVoteAlreadyExists();
        }

        MetaTxLibUpgradeable.validateVoteSupportSignature(signature, serialNo, msg.sender, voteCount);

        uint256 userNum = supportVoteMap[msg.sender][serialNo];

        uint256 nextNum = userNum.add(voteCount);

        if(PayType.None != pay){
            uint256 amount;
            for (; userNum < nextNum; userNum++) {
                amount = amount.add(numPower(userNum).mul(ONE_VOTE_ETH));
            }
            // native pay
            if(PayType.Native == pay){
                console.log("support pay value: %s, amount: %s", msg.value, amount);
                require(msg.value >= amount, "support pay eth not enough");
                // Send returns a boolean value indicating success or failure.
                // This function is not recommended for sending Ether.
                require(payable(address(this)).send(amount), "Failed to send Ether");
            } else if(PayType.Token == pay){
                uint256 payment = proposalToken.balanceOf(msg.sender);
                console.log("support pay payment: %s, amount: %s", payment, amount);
                require(payment >= amount, "support pay token not enough");
                safeTransferFrom(address(proposalToken),msg.sender, address(this), amount);
            }

            p.amount = p.amount.add(amount);
        }
        p.supportCount = p.supportCount.add(voteCount);
        p.voteRatio = SafeMath.div(SafeMath.mul(p.supportCount, BASE_PERCENT), SafeMath.add(p.supportCount, p.opposeCount));

        signMap[signHash] = 1;
        supportVoteMap[msg.sender][serialNo] = nextNum;


        emit Vote(msg.sender, serialNo, voteCount, "support");
    }

    function voteOppose(
        Types.EIP712Signature calldata signature,
        uint256 _serialNo,
        uint256 _voteCount) public payable {

        require(_voteCount > 0, "The number of votes needs to be greater than 0");

        Types.Proposal storage p = proposalMap[_serialNo];

        require(p.serialNo > 0, "proposal not exists");
        require(p.expireTime >= block.timestamp, "proposal expired");
        // sign verify
        bytes32 signHash = keccak256(abi.encodePacked(signature.r, signature.s, signature.v));
        if(signMap[signHash] > 0){
            require(false, "ApplyProjectVoteAlreadyExists");
            // revert Errors.ApplyProjectVoteAlreadyExists();
        }

        MetaTxLibUpgradeable.validateVoteOpposeSignature(signature, _serialNo, msg.sender, _voteCount);

        uint256 userNum = opposeVoteMap[msg.sender][_serialNo];

        uint256 nextNum = userNum.add(_voteCount);

        if(PayType.None != pay){
            uint256 amount;
            for (; userNum < nextNum; userNum++) {
                amount = amount.add(numPower(userNum).mul(ONE_VOTE_ETH));
            }
            // native pay
            if(PayType.Native == pay){
                require(msg.value >= amount, "eth not enough");
                // Send returns a boolean value indicating success or failure.
                // This function is not recommended for sending Ether.
                require(payable(address(this)).send(amount), "Failed to send Ether");

            } else if(PayType.Token == pay){
                uint256 payment = proposalToken.balanceOf(msg.sender);
                require(payment >= amount, "token not enough");
                safeTransferFrom(address(proposalToken),msg.sender, address(this), amount);
            }

            p.amount = p.amount.add(amount);
        }
        p.opposeCount = p.opposeCount.add(_voteCount);
        p.voteRatio = SafeMath.div(SafeMath.mul(p.supportCount, BASE_PERCENT), SafeMath.add(p.supportCount, p.opposeCount));

        signMap[signHash] = 1;
        opposeVoteMap[msg.sender][_serialNo] = nextNum;

        emit Vote(msg.sender, _serialNo, _voteCount, "oppose");
    }

    function safeTransfer(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FAILED');
    }

    function safeTransferFrom(address token, address from, address to, uint value) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FROM_FAILED');
    }

    // Set voting method, whether to support token or native coin voting
    function setPayType(address token, uint8 payType) public onlyRole(OPERATOR_ROLE) {
        pay = PayType(payType);
        proposalToken=IERC20(token);
    }

    function thisBalance() public view returns (uint256){
        return address(this).balance;
    }

    function withdraw(address payable _to) public onlyRole(ASSET_ROLE) {
        _to.transfer(address(this).balance);
    }


    function withdrawToken(address _token, address to) public onlyRole(ASSET_ROLE) {
        uint256 balance = getWithdrawableAmount(_token);
        IERC20(_token).transfer(to, balance);
    }

    /**
     * @dev Returns the amount of tokens that can be withdrawn by the owner.
     * @return the amount of tokens
     */
    function getWithdrawableAmount(address _token) public view returns (uint256) {
        return IERC20(_token).balanceOf(address(this));
    }

    function getProposalLength() public view returns (uint256){
        return proposals.length;
    }

    function getProposal(uint256 _proposal) public view returns (uint256, address, uint256, uint256, uint256,uint256, uint256){
        Types.Proposal memory p = proposalMap[_proposal];
       /**
        *  // 投票编号
        uint256 serialNo;
        // 项目方地址
        address projectAddr;
        // 支持数量
        uint256 supportCount;
        // 反对数量
        uint256 opposeCount;
        // 投票比率
        uint256 voteRatio;
        // 过期时间
        uint256 expireTime;
        // 支付总金额
        uint256 amount;
        */
        return (p.serialNo, p.projectAddr, p.supportCount, p.opposeCount, p.voteRatio, p.expireTime, p.amount);
    }

    function getUserVoteNum(address _addr, uint256 _proposal) public view returns (uint256, uint256){
        return (supportVoteMap[_addr][_proposal], opposeVoteMap[_addr][_proposal]);
    }

    function getSupportVoteAmount(address _addr, uint256 _proposal, uint256 _voteCount) public view returns (uint256){
        uint256 userNum = supportVoteMap[_addr][_proposal];
        uint256 nextNum = userNum.add(_voteCount);
        uint256 amount;
        for (; userNum < nextNum; userNum++) {
            amount = amount.add(numPower(userNum).mul(ONE_VOTE_ETH));
        }
        
        return amount;
    }

    function getOpposeVoteAmount(address _addr, uint256 _proposal, uint256 _voteCount) public view returns (uint256){
        uint256 userNum = opposeVoteMap[_addr][_proposal];
        uint256 nextNum = userNum.add(_voteCount);
        uint256 amount;
        for (; userNum < nextNum; userNum++) {
            amount = amount.add(numPower(userNum).mul(ONE_VOTE_ETH));
        }
        
        return amount;
    }


    function numPower(uint256 _n) public pure returns (uint256){
        return 2 ** _n;

    }

    function hash(bytes memory _b) public pure returns (bytes32){
        return keccak256(_b);
    }

    function nonce() public view returns (uint256){
        return MetaTxLibUpgradeable.getNonce(msg.sender);
    }

        /*
    Which function is called, fallback() or receive()?

           send Ether
               |
         msg.data is empty?
              / \
            yes  no
            /     \
receive() exists?  fallback()
         /   \
        yes   no
        /      \
    receive()   fallback()
    */

    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    // Fallback function is called when msg.data is not empty
    fallback() external payable {}

}
