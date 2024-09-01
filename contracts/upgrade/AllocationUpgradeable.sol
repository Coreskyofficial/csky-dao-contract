// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "../interfaces/IApNFT.sol";
import "../libraries/Types.sol";

import "hardhat/console.sol";

contract AllocationUpgradeable is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable {

    using SafeMath for uint256;
    using Address for address;
    using SafeERC20 for IERC20;

    // BASE PERCENT
    uint public constant BASE_PERCENT = 100;
    // Inverse basis point
    uint public constant INVERSE_BASIS_POINT = 10000;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ASSET_ROLE = keccak256("ASSET_ROLE");
    bytes32 public constant ALLOCATION_ASSET_ROLE = keccak256("ALLOCATION_ASSET_ROLE");

    bool private _initialized;
    // true or false auto mint apNFT
    bool public autoMintApNFT;

    // Allocation max create limit
    uint8 public maxAlloctionLimit;
    // Allcotion roundIDs
    uint256[] public roundIDs;
    // groupId => uint256[]
    mapping (uint256 =>  uint256[])  public groupRoundIDs;

    // roundId => Recive payment address of the project
    mapping(uint256 => address) public recivedPay;
    // RoundID=> serialNo => times
    mapping(uint256 => mapping(uint256 => uint256)) public recivePayTimes;
    // RoundID=>SendFundraisingLog[]
    mapping(uint256 => Types.SendFundraisingLog[]) public sendFundraisings;
    // Project fee
    uint256 public fee;
    // Project fee recive address
    address public feeTo;
    
    // roundId => issueToken
    mapping(uint256 => address) public issueToken;


    // roundID => voteEndTime
    mapping(uint256 => uint256) private voteEndTime;
    // roundID => mintEndTime
    mapping(uint256 => uint256) private mintEndTime;

    // roundID => Project
    mapping(uint256 => Types.Project) private round;
    // roundID => UserInfo[]
    mapping(uint256 => Types.PreSaleLog[]) private preSaleLog;
    // roundID => total Quantity (total Quantity )
    mapping(uint256 => uint256) private totalQuantity;

    // roundID => Allow oversold
    // If the total number is greater than 0, oversold is allowed
    mapping(uint256 => bool) private allowOversold;

    // roundID => Lp paused
    mapping(uint256 => bool) private _paused;


    //////////////////// vote use///////////////////////////////
    // userVote roundID => (user => userVoteNum)
    mapping(uint256 => mapping(address=>uint256)) private userVoteNum;
    // userPreSaleNum roundID => (user => userPreSaleNum)
    mapping(uint256 => mapping(address=>uint256)) private userPreSaleNum;
    // roundID => Types.Vote
    mapping(uint256 => Types.Vote) private refundVote;

    /// Mint use
    // userPreSaleNum roundID => (user => mintNum)
    mapping(uint256 => mapping(address=>uint256)) private mintedNum;
    // user=> (presaleID => presaleNum)
    mapping(address => mapping(uint256 => uint256)) private preSaledNum;
    // roundID=> FundraisingStatus:(true/false)
    mapping(uint256 => Types.FundraisingStatus) private fundraisingStatus;

    
    // Refund roundID=> index
    mapping(uint256 => uint256) private refundIndex;

    // withdrawal
    // roundID => to => amount
    mapping(uint256=> mapping(address => uint256)) public withdrawalAllocationTo;
    // roundID => WithdrawalAllocationTotalAmount
    mapping(uint256=> uint256) public withdrawalAllocationTotalAmount;


    event WithdrawalAllocation(uint256 indexed _roundID, address indexed _to, uint256 indexed _amount);

    event Withdraw(address indexed _token, address indexed _to, uint256 indexed _amount);
        
    event PreSaleClaimed(uint256 indexed roundID, address indexed sender, uint256 indexed preSaleID, uint256 preSaleNum, uint256 timestamp);

    event ApNFTMint(uint256 indexed roundID, uint256 indexed apNftNo, address indexed apNft, address owner, uint256 mintNum, uint256 timestamp);

    event Refund(uint256 indexed roundID, address indexed recipient, uint256 amount, uint256 timestamp);

    event SendFundraising(uint256 indexed roundID, uint256 indexed serialNo, address indexed recipient, uint256 amount, uint256 fee, uint256 timestamp);

    event HardtopQuantity(uint256 indexed roundID, uint256 quantity);

    event Paused(uint256 indexed roundID);

    event Unpaused(uint256 indexed roundID);

    event RefundFundraisingVote(uint256 roundID, address voteUser, uint256 timestamp);

    event PresaleRefund(uint256 roundID);
    
    /**
     * @dev initialize the contract by setting a `admin_` and a `operator_` to the Alloction.
     */
    function initialize(address admin_, address operator_) external initializer{
        console.log("initialize admin_: %s, operator_: %s", admin_, operator_ );
        require(!_initialized, "Initialized");

        __ReentrancyGuard_init();
        _setupRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(OPERATOR_ROLE, operator_);
        _initialized = true;
        maxAlloctionLimit = 2;
    }
    
    receive() external payable {}

    /**
     * @dev Modifier to make a function callable only when the lp is not paused.
     *
     * Requirements:
     *
     * - The lp must not be paused.
     */
    modifier whenNotPaused(uint256 _roundID) {
        _requireNotPaused(_roundID);
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the lp is paused.
     *
     * Requirements:
     *
     * - The lp must be paused.
     */
    modifier whenPaused(uint256 _roundID) {
        _requirePaused(_roundID);
        _;
    }

    /**
     * @dev Initializes a new presale round by project.
     * This function sets up the details for a new launchpad project with a specified ID. 
     * It requires several parameters:
     * - The target address of the presale.
     * - The receipt address where funds will be sent.
     * - The address of the ERC20 token to be used for payments (if any).
     * - The price of each NFT in the presale.
     * - The start and end times for the presale round.
     * - Maximum number of create alloctoin by the project.
     *
     * Note: This function can only be called by an account with the `OPERATOR_ROLE`.
     *
     * @param _groupID The ID of the presale group to set up.
     * @param _roundID The ID of the presale round to set up.
     * @param _target The target address of the presale.
     * @param _receipt The receipt address where funds will be sent.
     * @param _payment The address of the ERC20 token to be used for payments (if any).
     * @param _nftPrice The price of each NFT in the presale.
     * @param _startTime The start time for the presale round.
     * @param _endTime The end time for the presale round.
     * @param _voteEndTime The vote end time for the presale round.
     * @param _mintEndTime The mint end time for the presale round.
     * @param _totalQuantity The total quantity for the presale round.
     */
    function allocation(uint256 _groupID, uint256 _roundID, address _target, address _receipt, address _payment, uint256 _nftPrice, uint256 _startTime, uint256 _endTime, uint256 _voteEndTime, uint256 _mintEndTime, uint256 _totalQuantity) public onlyRole(OPERATOR_ROLE) {

        require(maxAlloctionLimit >= groupRoundIDs[_groupID].length, "Project limit of 2");
        require(_endTime > block.timestamp, "Invalid time");
        require(_target != address(0), "Invalid target");
        require(_receipt != address(0), "Invalid receipt");
        require(_nftPrice > 0, "nftPrice > 0");

        // create allocation
        Types.Project storage project = round[_roundID];
        require(project.target == address(0), "Already setting");

        project.target = _target;
        project.receipt = payable(this);
        project.payment = _payment;
        project.nftPrice = _nftPrice;
        project.startTime = _startTime;
        project.endTime = _endTime;

        groupRoundIDs[_groupID].push(_roundID);
        roundIDs.push(_roundID);
        // roundID => voteEndTime
        voteEndTime[_roundID] = _voteEndTime;
        // roundID => mintEndTime
        mintEndTime[_roundID] = _mintEndTime;
        totalQuantity[_roundID] = _totalQuantity;
        allowOversold[_roundID] = (_totalQuantity > 0);
        
        // roundId => Recive payment address of the project
        recivedPay[_roundID] = _receipt;
        
        fundraisingStatus[_roundID] = Types.FundraisingStatus.Success;
        emit HardtopQuantity(_roundID, _totalQuantity);
    }

    /**
     * @dev Initializes a new presale round by manager.
     * This function sets up the details for a new launchpad project with a specified ID. It requires several parameters:
     * - The target address of the presale.
     * - The receipt address where funds will be sent.
     * - The address of the ERC20 token to be used for payments (if any).
     * - The price of each NFT in the presale.
     * - The start and end times for the presale round.
     *
     * Note: This function can only be called by an account with the `OPERATOR_ROLE`.
     *
     * @param _roundID The ID of the presale round to set up.
     * @param _target The target address of the presale.
     * @param _receipt The receipt address where funds will be sent.
     * @param _payment The address of the ERC20 token to be used for payments (if any).
     * @param _nftPrice The price of each NFT in the presale.
     * @param _startTime The start time for the presale round.
     * @param _endTime The end time for the presale round.
     * @param _voteEndTime The end time for the presale round.
     * @param _mintEndTime The end time for the presale round.
     */
    function launchpad(uint256 _roundID, address _target, address payable _receipt, address _payment, uint256 _nftPrice, uint256 _startTime, uint256 _endTime, uint256 _voteEndTime, uint256 _mintEndTime) public onlyRole(OPERATOR_ROLE) {
        
        require(_endTime > block.timestamp, "Invalid time");
        require(_target != address(0), "Invalid target");
        require(_receipt != address(0), "Invalid receipt");
        require(_nftPrice > 0, "nftPrice > 0");

        Types.Project storage project = round[_roundID];
        require(project.target == address(0), "Already setting");

        project.target = _target;        
        project.receipt = payable(this);
        project.payment = _payment;
        project.nftPrice = _nftPrice;
        project.startTime = _startTime;
        project.endTime = _endTime;
        
        roundIDs.push(_roundID);
        // roundID => voteEndTime
        voteEndTime[_roundID] = _voteEndTime;
        // roundID => mintEndTime
        mintEndTime[_roundID] = _mintEndTime;
        
        fundraisingStatus[_roundID] = Types.FundraisingStatus.Success;
        
        // roundId => Recive payment address of the project
        recivedPay[_roundID] = _receipt;
        

    }

    /**
     * @dev Executes a presale transaction.
     * This function allows a user to participate in a presale round by purchasing a specific amount of tokens.
      * The function performs several checks to validate the transaction:
     * - Checks that the current time is within the project's start and end times.
     * - Verifies that the `preSaleID` has not been used before by the sender.
     * - Checks that the `preSaleNum` is greater than 0.
     * - If the project's payment address is the zero address, it checks that the value sent with the transaction is
     *   greater or equal to the total cost of the tokens. Any excess value is refunded to the sender.
     * - If the project's payment address is not the zero address, it checks that no ether was sent with the transaction,
     *   and transfers the total cost of tokens from the sender to the project's receipt address using an ERC20 token transfer.
     *
     * After the checks and transfers, the function increments the project's total sales by `preSaleNum`,
     * and records the total payment for the `preSaleID` of the sender.
     *
     * Finally, it emits a `PreSaleClaimed` event.
     *
     * @param roundID The ID of the Project.
     * @param preSaleID The ID of the presale.
     * @param preSaleNum The number of tokens to purchase in the presale.
     * @param voteNum  Latest number of platform coins held by users, converted votes number.
     */
    function preSale(uint256 roundID, uint256 preSaleID, uint256 preSaleNum, uint256 voteNum) public payable whenNotPaused(roundID) nonReentrant {
        Types.Project storage project = round[roundID];

        // Verify time
        require(project.startTime <= block.timestamp, "The LaunchPad activity has not started");
        require(project.endTime >= block.timestamp, "The LaunchPad activity has ended");

        // If the total number is greater than 0, oversold is allowed
        if(allowOversold[roundID]){
            require(project.totalSales + preSaleNum <= totalQuantity[roundID], "The LaunchPad activity has sold out");
        }

        // Verify preSaleID and preSaleNum
        require(project.preSaleRecords[msg.sender][preSaleID] == 0, "Duplicate preSaleID");
        require(preSaleNum > 0, "preSaleNum>0");
        // Receipt token && Refund token
        uint256 total = project.nftPrice * preSaleNum;
        
        if (project.payment == address(0)) {
            require(msg.value >= total, "Insufficient token");
            uint256 _refund = msg.value - total;
            if (_refund > 0) {
                // Refund the excess token
                payable(msg.sender).transfer(_refund);
            }

            // Transfer the total payment to the project receipt address
            project.receipt.transfer(total);
        } else {
            require(msg.value == 0, "Needn't pay mainnet token");

            // Transfer the total payment from the sender to the project receipt address
            IERC20(project.payment).safeTransferFrom(msg.sender, project.receipt, total);
        }

        // Increment the total sales for the project
        unchecked{
            project.totalSales += preSaleNum;
        }

        // Record the total payment for the preSaleID of the sender
        project.preSaleRecords[msg.sender][preSaleID] = total;
        preSaledNum[msg.sender][preSaleID] = preSaleNum;


        // User secondary voting
        uint256 userPreSaleTotalNum = userPreSaleNum[roundID][msg.sender] + preSaleNum; 
        uint256 beforeVoteNum = userVoteNum[roundID][msg.sender];
        uint256 lastVoteNum;
        if(voteNum > userPreSaleTotalNum){
            lastVoteNum = userPreSaleTotalNum;
        }else{
            lastVoteNum = voteNum;
        }

        // total vote number
        refundVote[roundID].totalVote = refundVote[roundID].totalVote.add(lastVoteNum).sub(beforeVoteNum);
        // user latest vote number
        userVoteNum[roundID][msg.sender] = lastVoteNum;
        // user pre sale total number
        userPreSaleNum[roundID][msg.sender] = userPreSaleTotalNum;

        
        // roundID => PreSaleLog[](preSaleID,preSaleUser,paymentTime,preSaleNum)
        preSaleLog[roundID].push(Types.PreSaleLog(preSaleID,msg.sender,block.timestamp,preSaleNum));


        if(autoMintApNFT && project.target != address(0)){
            apNftMint(roundID, project.target, preSaleID);
        }

        emit PreSaleClaimed(roundID, msg.sender, preSaleID, preSaleNum, block.timestamp);
    }

    /**
     * @dev Fundraising refund voting. 
     * If successful, the funds will be disbursed; if unsuccessful, a refund will be issued.
     *
     *
     * @param roundID The ID of the presale round.
     * @param voteUser The voteuser of the presale user.
     */

    function refundFundraisingVote(uint256 roundID, address voteUser) public nonReentrant onlyRole(OPERATOR_ROLE){

        require(roundID > 0, "project is empty");
        Types.Project storage project = round[roundID];

        console.log(" block.time:%s",block.timestamp);
        console.log("  startTime:%s",project.startTime);
        console.log("    endTime:%s",project.endTime);
        console.log("voteEndTime:%s",voteEndTime[roundID]);
        // Verify time
        require(project.startTime <= block.timestamp, "Activity has not started");
        require(project.endTime <= block.timestamp, "Fundraising Vote has not started");
        require(voteEndTime[roundID] > block.timestamp, "Fundraising Vote has ended");

        Types.Vote storage vote = refundVote[roundID];
        uint256 voteNum = userVoteNum[roundID][voteUser];
        require(voteNum > 0, "vote num is 0");
        // Number of dissenting votes
        vote.voteCount += voteNum;
        vote.voteRatio = SafeMath.div(SafeMath.mul(vote.voteCount, BASE_PERCENT), vote.totalVote);

        // If the number of dissenting votes is greater than 50%, the fundraising has failed.
        if(vote.voteRatio > 50){
            fundraisingStatus[roundID] = Types.FundraisingStatus.Fail;
        } else {
            //  If the number of dissenting votes is less than 50%, the fundraising is successful.
            fundraisingStatus[roundID] = Types.FundraisingStatus.Success;
        }

        // voteEvent
        emit RefundFundraisingVote(roundID, voteUser, block.timestamp);
    }

    function apNftMint(uint256 roundID, address target, uint256 preSaleID) internal virtual {
        address user = msg.sender;
        uint256 preSaleNum =  getPreSaleNum(user,preSaleID);
        require(preSaleNum > 0, "Pre sale quantity is 0");
        require(target != address(0), "The project does not exist");

        // function batchMint(address _to, uint256 _amount) external;
        IApNFT(target).batchMint(user, preSaleNum);
        
        mintedNum[roundID][user] = mintedNum[roundID][user] + preSaleNum;

        emit ApNFTMint(roundID, preSaleID, target, msg.sender, preSaleNum, block.timestamp);
        
    }

    /**
     * @dev Initiates refunds for a special project.
     * This function allows the project owner to refund amounts to multiple recipients.
     * It requires the round ID, the source address of the funds, an array of recipient addresses and an array of amounts.
     *
     * The function performs several checks to validate the parameters:
     * - Verifies that the length of the recipients array is equal to the length of the amounts array.
     *
     * After the checks, it retrieves the ERC20 token used for payments in the presale round,
     * and for each recipient in the array, it transfers the corresponding amount from the source address to the recipient.
     * It then emits a `Refund` event for each transfer.
     *
     * Note: This function can only be called by an account with appropriate permissions (typically the contract owner).
     *
     * @param roundID The ID of the presale round.
     * @param _Referrer An array of addresses to refund.
     * @param _ReferrerFee An array of _ReferrerFee to refund to each recipient.
     */
    function presaleRefund(uint256 roundID, address payable _Referrer, uint256 _ReferrerFee) public payable nonReentrant onlyRole(OPERATOR_ROLE){

        require(roundID > 0, "project is empty");
        // Verify time
        if(fundraisingStatus[roundID] != Types.FundraisingStatus.Fail){
            console.log("presaleRefund return.");
            return;
        }

        // Get the project associated with the given roundID
        Types.Project storage project = round[roundID];
        Types.PreSaleLog[] memory _logs = preSaleLog[roundID];

        uint256 limit = 1000;
        if(limit > _logs.length){
            limit = _logs.length;
        }
        
        console.log("limit:%s",limit);
        uint256 total = project.nftPrice * project.totalSales;
        if (project.payment == address(0)) {
             console.log("project.eth:%s",project.payment);
            require(address(this).balance >= total, "Insufficient amount token");
            // Iterate over each recipient and transfer the corresponding amount of tokens
            uint256 i;
            for (; i < limit; i++) {
                Types.PreSaleLog memory _log = _logs[refundIndex[roundID]];
                // Record the total payment for the preSaleID of the sender
                uint256 totalPayment = project.preSaleRecords[_log.preSaleUser][_log.preSaleID];
                _refundEth(roundID, _Referrer,_ReferrerFee,_log.preSaleUser,totalPayment);

                refundIndex[roundID]++;
            }
        } else {
            console.log("project.token:%s",project.payment);
            require(msg.value == 0, "Needn't pay mainnet token");
            // Iterate over each recipient and transfer the corresponding amount of tokens
            IERC20 _token = IERC20(project.payment);
            require(_token.balanceOf(address(this)) >= total, "Insufficient amount token");
            uint256 i;
            for (; i < limit; i++) {
                 Types.PreSaleLog memory _log = _logs[refundIndex[roundID]];
                // Record the total payment for the preSaleID of the sender
                uint256 totalPayment = project.preSaleRecords[_log.preSaleUser][_log.preSaleID];
                _refundTT(roundID, _Referrer, _ReferrerFee, project.payment, _log.preSaleUser, totalPayment);
                
                refundIndex[roundID]++;
                
            }
        }

        withdrawalAllocationTotalAmount[roundID] = total;
    }

    function _refundEth(uint256 roundID, address payable _Referrer, uint256 _ReferrerFee, address receiver, uint256 totalPayment) internal virtual{
        /* Amount that will be received by user (for Ether). */
        uint256 receiveAmount = totalPayment;
        // Referrer Fee
        if (_Referrer!=address(0) && _ReferrerFee > 0) {
            uint256 referrerFee = SafeMath.div(SafeMath.mul(_ReferrerFee, totalPayment), INVERSE_BASIS_POINT);
            receiveAmount = SafeMath.sub(receiveAmount, referrerFee);
            TransferETH(payable(_Referrer), referrerFee);
        }

        TransferETH(payable(receiver), receiveAmount);
    
        emit Refund(roundID, receiver, receiveAmount, block.timestamp);
    }

    function _refundTT(uint256 roundID, address payable _Referrer, uint256 _ReferrerFee, address token, address receiver, uint256 totalPayment) internal virtual{
        /* Amount that will be received by user (for Token). */
        uint256 receiveAmount = totalPayment;
        // Referrer Fee
        if (_Referrer!=address(0) && _ReferrerFee > 0) {
            uint256 referrerFee = SafeMath.div(SafeMath.mul(_ReferrerFee, totalPayment), INVERSE_BASIS_POINT);
            receiveAmount = SafeMath.sub(receiveAmount, referrerFee);
            TT(token, payable(_Referrer), referrerFee);
        }

        TT(token, payable(receiver), receiveAmount);
    
        emit Refund(roundID, receiver, receiveAmount, block.timestamp);
    }

  /**
     * @dev The project party releases the fundraising funds
     *
     * @param roundID The ID of the alloction round.
     * @param _serialNo release serial no.
     * @param _amount release amount.
     */
    function sendFundraising(uint256 roundID, uint256 _serialNo, uint256 _amount) public payable nonReentrant onlyRole(OPERATOR_ROLE){

        require(roundID > 0, "project is empty");
        require(_serialNo > 0, "serialNo is empty");
        require(_amount > 0, "The amount must be greater than 0");
        require(recivedPay[roundID] != address(0), "project pay address is empty");
        // Verify time
        if(fundraisingStatus[roundID] != Types.FundraisingStatus.Success){
            return;
        }

        require(recivePayTimes[roundID][_serialNo] == 0, "Repeated sending of current amount");
        
        // Get the project associated with the given roundID
        Types.Project storage project = round[roundID];
                  
        uint256 totalAmount = project.nftPrice * project.totalSales;
        withdrawalAllocationTotalAmount[roundID] += _amount;
        require(totalAmount >= withdrawalAllocationTotalAmount[roundID], "Exceeding the maximum withdrawal amount");
        
        /* Amount that will be received by user (for Ether). */
        uint256 receiveAmount = _amount;
        uint256 referrerFee;
        if (project.payment == address(0)) {
            require(address(this).balance >= _amount, "Insufficient amount token");
            // Referrer Fee
            if (feeTo!=address(0) && fee > 0) {
                referrerFee = SafeMath.div(SafeMath.mul(fee, _amount), INVERSE_BASIS_POINT);
                receiveAmount = SafeMath.sub(receiveAmount, referrerFee);
                TransferETH(payable(feeTo), referrerFee);
            }
            TransferETH(payable(recivedPay[roundID]), receiveAmount);
        } else {
            require(msg.value == 0, "Needn't pay mainnet token");
            // Iterate over each recipient and transfer the corresponding amount of tokens
            IERC20 _token = IERC20(project.payment);
            require(_token.balanceOf(address(this)) >= _amount, "Insufficient amount token");
            // Referrer Fee
            if (feeTo!=address(0) && fee > 0) {
                referrerFee = SafeMath.div(SafeMath.mul(fee, _amount), INVERSE_BASIS_POINT);
                receiveAmount = SafeMath.sub(receiveAmount, referrerFee);
                TT(project.payment, payable(feeTo), referrerFee);
            }
            TT(project.payment, payable(recivedPay[roundID]), receiveAmount);
        }

        sendFundraisings[roundID].push(Types.SendFundraisingLog(block.timestamp, _amount, receiveAmount));
        recivePayTimes[roundID][_serialNo] = sendFundraisings[roundID].length;

        emit SendFundraising(roundID, _serialNo, recivedPay[roundID], receiveAmount, referrerFee, block.timestamp);
    }

    function getFundraisingLength(uint256 roundID) public view returns (uint256){
        return sendFundraisings[roundID].length;
    }

    function getFundraisingByNo(uint256 roundID, uint256 serialNo) public view returns (uint256, uint256,uint256,uint256){
        uint256 index = recivePayTimes[roundID][serialNo];
        if(index > 0){
            index -= 1;
        }
        Types.SendFundraisingLog storage log = sendFundraisings[roundID][index];
        return (index, log.sendTime, log.amount, log.receiveAmount);
    }

    function getFundraisingByIndex(uint256 roundID, uint256 index) public view returns (uint256, uint256,uint256,uint256){
        Types.SendFundraisingLog storage log = sendFundraisings[roundID][index];
        return (index, log.sendTime, log.amount, log.receiveAmount);
    }


    // Returns project details by the roundID.
    function getProject(uint256 roundID) external view returns (address, address, address, uint256, uint256, uint256, uint256){
        Types.Project storage project = round[roundID];
        return (project.target, project.receipt, project.payment, project.nftPrice, project.totalSales, project.startTime, project.endTime);
    }

    // Returns project totalSales by the roundID.
    function getProjectTotalSales(uint256 roundID) external view returns (uint256){
        Types.Project storage project = round[roundID];
        return project.totalSales;
    }

    // Returns project preSaleRecords by the roundID.
    function getProjectPreSale(uint256 roundID, address user, uint256 preSaleID) external view returns (uint256){
        Types.Project storage project = round[roundID];
        return project.preSaleRecords[user][preSaleID];
    }

    // Returns project vote Records by the roundID.
    function getProjectVote(uint256 roundID) external view returns (uint256, uint256, uint256){
        Types.Vote storage vote = refundVote[roundID];
        
        // (Oppose votes, total votes, vote ratio)
        return (vote.voteCount, vote.totalVote, vote.voteRatio);
    }


    // Returns project details by the roundID.
    function getAlloctionInfo(uint256 _roundID) external view returns (Types.AlloctionInfo memory info){
        Types.Project storage project = round[_roundID];
    
        info = Types.AlloctionInfo(
            project.target, 
            project.receipt, 
            project.payment, 
            project.nftPrice, 
            project.totalSales, 
            project.startTime, 
            project.endTime,
            totalQuantity[_roundID],
            voteEndTime[_roundID],
            mintEndTime[_roundID],
            issueToken[_roundID],
            recivedPay[_roundID],
            Types.AllocStatus(
                uint8(fundraisingStatus[_roundID]),
                isAllowOversold(_roundID),
                isSoldOut(_roundID),
                _paused[_roundID]
            )
        );
        return info;
    }

    //  set project nft target by the roundID.
    function setApNFTTarget(uint256 roundID, address _nftTarget) public onlyRole(OPERATOR_ROLE){
        require(_nftTarget != address(0), "Invalid nft target");
        Types.Project storage project = round[roundID];
        project.target = _nftTarget;
    }

    //  Returns project target by the roundID.
    function getApNFTTarget(uint256 roundID) public view returns (address){
        Types.Project storage project = round[roundID];
        return project.target;
    }
    // Returns project preSale num by the preSaleID and user.
    function getPreSaleNum(address user, uint256 preSaleID) public view returns (uint256){
        return preSaledNum[user][preSaleID];
    }

    // Returns project preSale num by the user and ronudID.
    function getPreSaleNumByUser(address user, uint256 roundID) public view returns (uint256){
        return userPreSaleNum[roundID][user];
    }

    // Returns project preSale minted num by the user.
    function getMintNum(address user, uint256 roundID) public view returns (uint256){
        return mintedNum[roundID][user];
    }

    // Returns project preSale minted num by the user.
    function getMintInfo(address user, uint256 roundID) public view returns (uint256 preSaleNum, uint256 mintNum){
        return (userPreSaleNum[roundID][user], mintedNum[roundID][user]);
    }

    /**
     * @dev Executes a function call on another contract.
     * @param dest The address of the contract to call.
     * @param value The amount of ether/matic/mainnet token to send with the call.
     * @param func The function signature and parameters to call.
     */
    function execute(address dest, uint256 value, bytes calldata func) external onlyRole(OPERATOR_ROLE) {
        _call(dest, value, func);
    }

    /**
     * @dev Executes a batch of function calls on multiple contracts.
     * This function allows this contract to execute a batch of function calls on multiple contracts by specifying
     * an array of destination addresses, an array of values to send with each call, and an array of function signatures
     * and parameters for each call.
     * @param dest An array of addresses of the contracts to call.
     * @param value An array of amounts of ether/matic/mainnet token to send with each call.
     * @param func An array of function signatures and parameters to call for each destination.
     */
    function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external onlyRole(OPERATOR_ROLE) {
        require(dest.length == func.length && (value.length == 0 || value.length == func.length), "Wrong array lengths");
        if (value.length == 0) {
            for (uint256 i = 0; i < dest.length; i++) {
                _call(dest[i], 0, func[i]);
            }
        } else {
            for (uint256 i = 0; i < dest.length; i++) {
                _call(dest[i], value[i], func[i]);
            }
        }
    }

    /**
     * @dev Executes a low-level call to another contract.
     * This internal function allows the contract to execute a low-level call to another contract,
     * by specifying the target address, the value to send with the call, and the data to send.
     *
     * It performs the call and checks if it was successful. If not, it reverts the transaction and returns
     * the error message from the failed call.
     *
     * Note: Use this function with caution as low-level calls can be dangerous.
     *
     * @param target The address of the contract to call.
     * @param value The amount of ether/mainnet token to send with the call.
     * @param data The data to send with the call.
     */
    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /**
     * @dev Set the total pre-sale quantity. 
     * If the total number is greater than 0, oversold is allowed
     * @param _roundID project Id
     * @param _totalQuantity total number
     */
    function setTotalQuantity(uint256 _roundID, uint256 _totalQuantity) public onlyRole(OPERATOR_ROLE) {
        Types.Project storage project = round[_roundID];
        require(project.target != address(0), "Project does not exist");
        require(project.totalSales <= _totalQuantity, "Project total quantity needs to be greater than the total pre-sale amount");
        totalQuantity[_roundID] = _totalQuantity;
        allowOversold[_roundID] = (_totalQuantity > 0);
        console.log("Project [%s], _totalQuantity: %s", _roundID,totalQuantity[_roundID]);
        
        emit HardtopQuantity(_roundID, _totalQuantity);
    }

    // Returns project TotalQuantity by the roundID.
    function getTotalQuantity(uint256 _roundID) external view returns (uint256){
        return totalQuantity[_roundID];
    }

    // Returns project allowOversold by the roundID.
    function isAllowOversold(uint256 _roundID) public view returns (bool){
        return allowOversold[_roundID];
    }

    // Returns project SoldOut status by the roundID.
    function isSoldOut(uint256 _roundID) public view returns (bool){
        return totalQuantity[_roundID] > 0 && round[_roundID].totalSales == totalQuantity[_roundID];
    }

    // Returns project PreSaleLog[] by the roundID.
    function getPreSaleLog(uint256 _roundID) external view returns (Types.PreSaleLog[] memory){
        return preSaleLog[_roundID];
    }

    // Returns project status(totalSales,totalQuantity,allowOversold,SoldOut,paused) by the roundID.
    function getLpStatus(uint256 _roundID) external view returns (uint256, uint256, bool, bool, bool){
        bool soldOut = totalQuantity[_roundID] > 0 && round[_roundID].totalSales == totalQuantity[_roundID];
        return (round[_roundID].totalSales, totalQuantity[_roundID], allowOversold[_roundID], soldOut, _paused[_roundID]);
    }

    /**
     * @dev Triggers stopped state.
     *
     * Requirements:
     *
     * - The lp must not be paused.
     */
    function pause(uint256 _roundID) public whenNotPaused(_roundID) onlyRole(OPERATOR_ROLE)  {
        _paused[_roundID] = true;
        emit Paused(_roundID);
    }
    /**
     * @dev Returns to normal state.
     *
     * Requirements:
     *
     * - The lp must be paused.
     */
    
    function unpause(uint256 _roundID) public whenPaused(_roundID) onlyRole(OPERATOR_ROLE)  {
        _paused[_roundID] = false;
        emit Unpaused(_roundID);
    }

    
    /**
     * @dev Returns true if the lp is paused, and false otherwise.
     */
    function paused(uint256 _roundID) public view virtual returns (bool) {
        return _paused[_roundID];
    }

    /**
     * @dev Throws if the contract is paused.
     */
    function _requireNotPaused(uint256 _roundID) internal view virtual {
        console.log("Pausable: paused: %s", paused(_roundID));
        require(!paused(_roundID), "Pausable: paused");
    }

    /**
     * @dev Throws if the contract is not paused.
     */
    function _requirePaused(uint256 _roundID) internal view virtual {
        require(paused(_roundID), "Pausable: not paused");
    }
    

    // Set the address for receiving transaction fees, and set this address to enable transaction fees
    function setFeeTo(address _feeTo) external onlyRole(OPERATOR_ROLE) {
        feeTo = _feeTo;
    }

    // Set project funding handling fees
    function setFee(uint256 _fee) external onlyRole(OPERATOR_ROLE) {
        fee = _fee;
    }

    // Set up automatic Mint NFT to the user's address after pre-sale of the project
    function setAutoMint(bool _autoMint) public onlyRole(OPERATOR_ROLE) {
        autoMintApNFT = _autoMint;
    }

    // Set project NFT mint quantity
    function setMintNum(uint256 _roundID,address user, uint256 preSaleNum) public onlyRole(OPERATOR_ROLE) {
        mintedNum[_roundID][user] = preSaleNum;
    }
    
    // Set Project - Payment Acceptance Address
    function setPaymentReceipt(uint256 _roundID, address _receipt) public onlyRole(OPERATOR_ROLE) { 
        Types.Project storage project = round[_roundID];
        require(project.target != address(0), "Project does not exist");
        require(_receipt != address(0), "Receipt address is empty");
        project.receipt = payable(_receipt);
    }

    // Set Project - Pre sale End Time
    function setEndTime(uint256 _roundID, uint256 _endTime) public onlyRole(OPERATOR_ROLE) { 
        Types.Project storage project = round[_roundID];
        require(project.target != address(0), "Project does not exist");
        project.endTime = _endTime;
    }

    // Set Project - Second Voting End Time
    function setVoteEndTime(uint256 _roundID, uint256 _voteEndTime) public onlyRole(OPERATOR_ROLE) {
        Types.Project storage project = round[_roundID];
        require(project.target != address(0), "Project does not exist");
        voteEndTime[_roundID] = _voteEndTime;
    }

    // Set project - mint end time
    function setMintEndTime(uint256 _roundID, uint256 _mintEndTime) public onlyRole(OPERATOR_ROLE) {
        Types.Project storage project = round[_roundID];
        require(project.target != address(0), "Project does not exist");
        mintEndTime[_roundID] = _mintEndTime;
    }

    // Set project - issue token
    function setIssueToken(uint256 _roundID, address _issueToken) public onlyRole(OPERATOR_ROLE) {
        Types.Project storage project = round[_roundID];
        require(project.target != address(0), "Project does not exist");
        issueToken[_roundID] = _issueToken;
    }

    // get project - issue token
    function getIssueToken(uint256 _roundID) public view returns (address) {
       return issueToken[_roundID];
    }

    // Returns project voteEndTime num by the _roundID.
    function getVoteEndTime(uint256 _roundID) public view returns (uint256){
        return voteEndTime[_roundID];
    }
    // Returns project mintEndTime num by the _roundID.
    function getMintEndTime(uint256 _roundID) public view returns (uint256){
        return mintEndTime[_roundID];
    }

    // Returns project fundraisingStatus num by the _roundID.
    function getFundraisingStatus(uint256 _roundID) public view returns (uint8){
        return uint8(fundraisingStatus[_roundID]);
    }

    // Set project - fundraising status
    function setFundraisingStatus(uint256 _roundID, uint8 _fundraisingStatus) public onlyRole(OPERATOR_ROLE) {
        fundraisingStatus[_roundID] = Types.FundraisingStatus(_fundraisingStatus);
    }

    // get project - vote num
    function getVoteNum(uint256 _roundID, address user) public view returns (uint256) {
        return userVoteNum[_roundID][user];
    }

    // Set project - recived pay address
    function setRecivedPay(uint256 _roundID, address _newRecivedPay) public onlyRole(OPERATOR_ROLE) {
        recivedPay[_roundID] = _newRecivedPay;
    }

    function TransferETH(address payable _receiver, uint256 _Amount) internal {
        console.log("TransferETH:%s, _Amount:%s",_receiver, _Amount);
        assert(payable(_receiver).send(_Amount));
        console.log("TransferETH:%s, balance:%s, Total:%s",_receiver, _receiver.balance, address(this).balance);
    }

    function TT(address _tokenAddress, address payable _receiver, uint256 _Amount) internal {
        console.log("TransferTT:%s, _Amount:%s",_receiver, _Amount);
        IERC20(_tokenAddress).safeTransfer(_receiver, _Amount);
        console.log("TransferTT:%s, balanceOf:%s, Total:%s",_receiver, IERC20(_tokenAddress).balanceOf(_receiver), IERC20(_tokenAddress).balanceOf(address(this)));
    }


    // withdraw eth
    function withdraw(address payable _to) public onlyRole(ASSET_ROLE) {
        uint256 balance = address(this).balance;
        _to.transfer(balance);
        emit Withdraw(address(0), _to, balance);
    }


    function thisBalance() public view returns (uint256){
        return address(this).balance;
    }

    /**
     * @dev Returns the amount of tokens that can be withdrawn by the owner.
     * @return the amount of tokens
     */
    function getWithdrawableAmount(address _token) public view returns (uint256) {
        return IERC20(_token).balanceOf(address(this));
    }

    // withdraw token
    function withdrawToken(address _token, address _to) public onlyRole(ASSET_ROLE) {
        uint256 balance = getWithdrawableAmount(_token);
        IERC20(_token).transfer(_to, balance);
        emit Withdraw(_token, _to, balance);
    }


    // withdraw allocation eth
    function withdrawalAllocation(uint256 _roundID, address payable _to, uint256 _amount) public onlyRole(ALLOCATION_ASSET_ROLE) {
        require(_roundID > 0, "Params roundID is empty");
        require(_to != address(0), "Params to is empty");
        require(_amount > 0, "Params amount is empty");
        Types.Project storage project = round[_roundID];
        
        // total pre-sale amount
        uint256 totalAmount = SafeMath.mul(project.nftPrice, project.totalSales);
        require(totalAmount > 0, "No total pre-sale amount");
        withdrawalAllocationTotalAmount[_roundID] += _amount;
        require(totalAmount >= withdrawalAllocationTotalAmount[_roundID], "Exceeding the maximum withdrawal amount");

        if(project.payment == address(0)){
            uint256 balance = address(this).balance;
            require(balance >= _amount, "The withdrawal amount for this allocation is insufficient");
            _to.transfer(_amount);
        } else {
            uint256 balance = IERC20(project.payment).balanceOf(address(this));
            console.log("balance %s, amount %s", balance, _amount);
            require(balance >= _amount, "The withdrawal token amount for this allocation is insufficient");
            IERC20(project.payment).safeTransfer(_to, _amount);
        }
        withdrawalAllocationTo[_roundID][_to] = _amount;
        emit WithdrawalAllocation(_roundID, _to, _amount);
    }


    /**
     * @dev Returns the allocation amount of tokens that can be withdrawn by the owner.
     * @return the amount of tokens
     */
    function getAllocationWithdrawableAmount(uint256 _roundID) public view returns (uint256) {
        Types.Project storage project = round[_roundID];
        // total pre-sale amount
        uint256 totalAmount = SafeMath.mul(project.nftPrice, project.totalSales);
        return totalAmount.sub(withdrawalAllocationTotalAmount[_roundID]);
    }

    // Set the maximum number of projects created by the project team
    function setMaxAlloctionLimit(uint8 _limit) public onlyRole(OPERATOR_ROLE) {
        maxAlloctionLimit =_limit;
    }
}
