// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./AllocationUpgradeable.sol";
import "../base/CoreHubStorage.sol";
import "../interfaces/IAllocation.sol";
import "../interfaces/IApNFT.sol";
import "../interfaces/ICoreskyAirDrop.sol";
import "../libraries/Errors.sol";
import "../libraries/Events.sol";
import "../libraries/Types.sol";
import "../libraries/MetaTxLibUpgradeable.sol";
import "../libraries/StorageLib.sol";
contract CoreskyHubUpgradeable is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable, CoreHubStorage {
    
    using SafeMath for uint256;
    using Address for address;
    using SafeERC20 for IERC20;
    using Strings for uint256;
    using ECDSA for bytes32;
    using ECDSA for bytes;

    /**
     * @dev Initializes the contract by setting `admin_`, `operator_`, `bot_` to the Alloction.
     */
    function __CoreskyHub_init(
        address allocationImpl, 
        address apNFTImpl,
        address admin_, 
        address operator_, 
        address bot_) internal onlyInitializing {
             __CoreskyHub_init_unchained( allocationImpl, apNFTImpl, admin_, operator_, bot_);
    }

    function __CoreskyHub_init_unchained(
        address allocationImpl, 
        address apNFTImpl,
        address admin_, 
        address operator_, 
        address bot_) internal onlyInitializing {
        _setupRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(OPERATOR_ROLE, operator_);
        _grantRole(PROJECT_OPERATOR_ROLE, operator_);
        _setupRole(ROLE_BOT, bot_);

        StorageLib.setPlatformAllocation(allocationImpl);
        StorageLib.getAllocationOwner()[allocationImpl] = msg.sender;
        StorageLib.allAllocations().push(allocationImpl);

        StorageLib.setPlatformApNFT(apNFTImpl);
        StorageLib.setMaxAllocationLimit(2);
        maxMintLimit = 50;
    }
    receive() external payable {}


    /**
     * @dev Modifier to make a function callable only project.
     *
     * Requirements:
     *
     * - Only the project party can operate it.
     */
    modifier onlyProject(uint256 _groupID) {
        _checkRole(PROJECT_ROLE, project(_groupID, msg.sender));
        _;
    }

    /// Current chain identifier
    function chain() public view virtual returns (uint256) {
        return block.chainid;
    }

    /// Project group and project party combination address
    function project(uint256 _groupID, address pro) public view virtual returns (address) {
        return address(uint160(uint(keccak256(abi.encodePacked(_groupID, pro)))));
    }

    // Check if the project exists
    function __checkAlloction(address targetAllocation) internal pure{
        if(targetAllocation == address(0)){
            require(false, "AllocationDoesNotExist");
            // revert Errors.AllocationDoesNotExist();
        }
    }

    /**
     * @dev Deployment method of asset package contract.
     *
     * @param apNftNo  Unique Number.
     * @param _name Asset package name.
     * @param _symbol Asset package symbol.
     * @param _baseUri Asset package base uri is used for metadata display.
     * @param deadline Validity period of signature service.
     * @param botSignature Signature Service of signature.
     */
    function deployApNFT(
        uint256 apNftNo,
        string memory _name,
        string memory _symbol,
        string memory _baseUri,
        uint256 deadline,
        bytes memory botSignature
    ) public onlyRole(PROJECT_OPERATOR_ROLE){
        if (apNftNo == 0) {
            require(false, "ApNftDoesNotExist");
            // revert Errors.ApNftDoesNotExist();
        }
        if (StorageLib.getApNFT()[apNftNo] != address(0)) {
            require(false, "ApNftExist");
            // revert Errors.ApNftExist();
        }
        // sign verify
        bytes32 signHash = keccak256(botSignature);
        if(signMap[signHash] > 0){
            require(false, "ApplyProjectVoteAlreadyExists");
            // revert Errors.ApplyProjectVoteAlreadyExists();
        }
        address recoveredSigner = MetaTxLibUpgradeable.recoveredSigner(
                apNftNo,
                _name,
                _symbol,
                _baseUri,
                deadline, 
                botSignature);
        
        if(recoveredSigner == address(0) || !hasRole(ROLE_BOT, recoveredSigner)){
            require(false, "BotSignatureInvalid");
            // revert Errors.BotSignatureInvalid();
        }
        
        signMap[signHash] = 1;

        address apNFT = Clones.clone(getPlatformApNFT());
        IApNFT(apNFT).initialize(_name, _symbol, _baseUri);

        StorageLib.getApNFT()[apNftNo] = apNFT;

        emit Events.ApNFTCreated(apNftNo,  apNFT, msg.sender, block.timestamp);
    }

    /// get Total Allocation
    function allAllocationsLength() public view returns (uint) {
        return StorageLib.allAllocations().length;
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
    function createAllocation(
        uint256 _groupID,
        uint256 _roundID,
        address _target,
        address _receipt,
        address _payment,
        uint256 _nftPrice,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _voteEndTime,
        uint256 _mintEndTime,
        uint256 _totalQuantity
    ) external onlyProject(_groupID) returns (address allocation) {
        if(StorageLib.getAllocation()[_roundID] != address(0)){
            require(false, "AllocationExist");
            // revert Errors.AllocationExist();
        }

        if(groupAllocations(_groupID).length >= getMaxAllocationLimit() && !hasRole(OPERATOR_ROLE, msg.sender)){
            require(false, "ExceedMaxAllocationLimit");
        }

        // 创建新合约
        allocation = Clones.clone(getPlatformAllocation());
        AllocationUpgradeable all = AllocationUpgradeable(payable(allocation));
        all.initialize(address(this), address(this));
        uint256 _fee = StorageLib.getFee();
        address _feeTo = StorageLib.getFeeTo();

        if (_fee > 0 && _feeTo != address(0)) {
            all.setFee(_fee);
            all.setFeeTo(_feeTo);
        }

        // create alloction
        all.allocation(
            _groupID,
            _roundID,
            _target,
            _receipt,
            _payment,
            _nftPrice,
            _startTime,
            _endTime,
            _voteEndTime,
            _mintEndTime,
            _totalQuantity
        );


        emit Events.AllocationCreated(_roundID, allocation, msg.sender, block.timestamp);

        StorageLib.getAllocation()[_roundID] = allocation;
        StorageLib.getAllocationOwner()[allocation] = msg.sender;
        StorageLib.allAllocations().push(allocation);
        StorageLib.groupAllocations()[_groupID].push(allocation);
        StorageLib.getAllocationNFT()[allocation] = _target;
    }

    function _allocation(uint256 _roundID) internal view returns (address){
        address targetAllocation = getAllocation(_roundID);
        if(targetAllocation == address(0)){
            targetAllocation = getPlatformAllocation();
        }
        return targetAllocation;
    }

    /**
     * @dev Issuing tokens and depositing them
     *
     * Note: This function can only be called by an account with the `PROJECT_OPERATOR_ROLE`.
     *
     * @param roundID The ID of the presale round to set up.
     * @param issueToken Token issued by the project party.
     * @param chainId Token issuing chain ID.
     * @param nftContainNum Each NFT contains the number of tokens.
     */
    function depositIssueToken(
        uint256 roundID,
        address issueToken,
        uint256 chainId,
        uint256 nftContainNum
    ) external onlyRole(PROJECT_OPERATOR_ROLE) {
        address targetAllocation = _allocation(roundID);
        __checkAlloction(targetAllocation);

        if(!issueToken.isContract()){
            require(false, "IssutTokenDoesNotExist");
            // revert Errors.IssutTokenDoesNotExist();
        }
        if(chainId != block.chainid){
            require(false, "NotSupportingCurrentChain");
            // revert Errors.NotSupportingCurrentChain();
        }
        if(getCoreskyAirDrop() == address(0)){
            require(false, "CoreskyAirDropDoesNotExist");
            // revert Errors.CoreskyAirDropDoesNotExist();
        }
        
        require(nftContainNum > 0, "nft contain num must be getter 0");
        uint8 status=IAllocation(targetAllocation).getFundraisingStatus(roundID);
        require(status == 1, "Fundraising failed");

        Types.IssueToken memory token = Types.IssueToken(issueToken, chainId, nftContainNum);
        StorageLib.getAllocationIssueToken()[targetAllocation] = token;
        StorageLib.getIssueToken()[roundID]=issueToken;
        
        IAllocation(targetAllocation).setIssueToken(roundID,issueToken);

        uint256  totalSales = IAllocation(targetAllocation).getProjectTotalSales(roundID);
        uint256 total = totalSales * nftContainNum;
        // Transfer the total payment from the sender to the project receipt address
        IERC20(issueToken).safeTransferFrom(msg.sender, getCoreskyAirDrop(), total);

        emit Events.DepositIssueToken(roundID, issueToken, chainId, total, block.timestamp);
    }

    /**
     * @dev Set the allocation fundraising fee address.
     *
     * @param _feeTo The new allocation fundraising fee address to set.
     */
    function setFeeTo(address _feeTo) external onlyRole(OPERATOR_ROLE) {
        StorageLib.setFeeTo(_feeTo);
    }
    /**
     * @dev Set the allocation fundraising fee.
     *
     * @param _fee The new allocation fundraising fee to set.
     */
    function setFee(uint256 _fee) external onlyRole(OPERATOR_ROLE) {
        StorageLib.setFee(_fee);
    }
    /**
     * @dev Set the allocation refund fee address.
     *
     * @param _feeTo The new allocation refund fee address to set.
     */
    function setBackFeeTo(address _feeTo) external onlyRole(OPERATOR_ROLE) {
        StorageLib.setBackFeeTo(_feeTo);
    }
    /**
     * @dev Set the allocation refund fee.
     *
     * @param _fee The new allocation refund fee to set.
     */
    function setBackFee(uint256 _fee) external onlyRole(OPERATOR_ROLE) {
        StorageLib.setBackFee(_fee);
    }

     /**
     * @dev Set the allocation pause.
     *
     * @param _roundID The ID of the presale round.
     */
    function pause(uint256 _roundID) public onlyRole(OPERATOR_ROLE)  {
        address targetAllocation = _allocation(_roundID);
        __checkAlloction(targetAllocation);
        IAllocation(targetAllocation).pause(_roundID);
    }

     /**
     * @dev Set the allocation unpause.
     *
     * @param _roundID The ID of the presale round.
     */
    function unpause(uint256 _roundID) public onlyRole(OPERATOR_ROLE)  {
        address targetAllocation = _allocation(_roundID);
        __checkAlloction(targetAllocation);
        IAllocation(targetAllocation).unpause(_roundID);
    }

    /**
     * @dev Set the allocation fundraising reception address.
     *
     * @param _roundID The ID of the presale round.
     * @param _receipt fundraising reception address.
     */
    function setPaymentReceipt(uint256 _roundID, address _receipt) public onlyRole(OPERATOR_ROLE) { 
        address targetAllocation = _allocation(_roundID);
        __checkAlloction(targetAllocation);
        if(_receipt == address(0)){
            require(false, "InvalidReceipt");
            // revert Errors.InvalidReceipt();
        }
        IAllocation(targetAllocation).setPaymentReceipt(_roundID,_receipt);
    }

    /**
     * @dev Set the allocation fundraising reception address.
     *
     * @param _roundID The ID of the presale round.
     * @param _receipt fundraising reception address.
     */
    function setFundraisingReceiptPay(uint256 _roundID, address _receipt) public onlyRole(OPERATOR_ROLE) { 
        address targetAllocation = _allocation(_roundID);
        __checkAlloction(targetAllocation);
        if(_receipt == address(0)){
            require(false, "InvalidReceipt");
            // revert Errors.InvalidReceipt();
        }
        IAllocation(targetAllocation).setRecivedPay(_roundID,_receipt);
    }
    
    /**
     * @dev Set the allocation pre-sale limit.
     *
     * @param _roundID The ID of the presale round.
     * @param _totalQuantity The total quantity of pre-sale limit.
     */
    function setTotalQuantity(uint256 _roundID, uint256 _totalQuantity) public onlyRole(OPERATOR_ROLE) {
        address targetAllocation = _allocation(_roundID);
        __checkAlloction(targetAllocation);
        IAllocation(targetAllocation).setTotalQuantity(_roundID,_totalQuantity);
    }

    // search the allocation pre-sale limit
    function getTotalQuantity(uint256 _roundID) public view returns (uint256) {
       return IAllocation(getAllocation(_roundID)).getTotalQuantity(_roundID);
    }

    /**
     * @dev The voting results for the fundraising application of the project party have been uploaded to the blockchain
     *
     * note After successful voting, projects can be created
     * @param signature The signature of the sign data.
     * @param projectVote Voting result data (
                        proposal.serialNo,
                        proposal.projectAddr,
                        proposal.supportCount,
                        proposal.opposeCount,
                        proposal.voteRatio,
                        proposal.expireTime)
     */
    function applyProjectVote(Types.EIP712Signature calldata signature, Types.Proposal calldata projectVote, bytes memory botSignature) public nonReentrant {
  
        if(projectVote.serialNo == 0){
            require(false, "InvalidSerialNoEmpty");
            // revert Errors.InvalidSerialNoEmpty();
        }
        if(projectVote.projectAddr == address(0)){
            require(false, "InvalidProjectAddrEmpty");
            // revert Errors.InvalidProjectAddrEmpty();
        }
        // sign verify
        bytes32 signHash = keccak256(botSignature);
        if(signMap[signHash] > 0){
            require(false, "ApplyProjectVoteAlreadyExists");
            // revert Errors.ApplyProjectVoteAlreadyExists();
        }
        Types.Proposal storage _pv = StorageLib.getProjectVote()[projectVote.serialNo];
        // check expire time
        if(_pv.expireTime > 0 && _pv.expireTime >= block.timestamp){
            require(false, "ResetAfterTimeExpires");
            // revert Errors.ResetAfterTimeExpires();
        }
        MetaTxLibUpgradeable.validateAddProposalSignature(signature, projectVote);
        address recoveredSigner = MetaTxLibUpgradeable.recoveredSigner(projectVote, signature.deadline, botSignature);
        
        if(recoveredSigner == address(0) || !hasRole(ROLE_BOT, recoveredSigner)){
            require(false, "BotSignatureInvalid");
            // revert Errors.BotSignatureInvalid();
        }
        
        signMap[signHash] = 1;
        StorageLib.getProjectVote()[projectVote.serialNo] = projectVote;

        address _projectAddr = project(projectVote.serialNo, projectVote.projectAddr);

        // If the vote is greater than or equal to 50%, the application is successful
        if(projectVote.voteRatio >= 5000){
            StorageLib.isProject()[_projectAddr] = true;
            _grantRole(PROJECT_ROLE, _projectAddr);
            _grantRole(PROJECT_OPERATOR_ROLE, projectVote.projectAddr);
        } else {
            StorageLib.isProject()[_projectAddr] = false;
            _revokeRole(PROJECT_ROLE, _projectAddr);
            _revokeRole(PROJECT_OPERATOR_ROLE, projectVote.projectAddr);
        }
        // ApplyProjectVote
        emit Events.ApplyProjectVote(projectVote.serialNo, projectVote.projectAddr, _projectAddr, block.timestamp);

    }

    /**
     * @dev the alloction project second vote 
     * After the pre-sale ends, users who have successfully purchased can vote again
     *
     * @param signature The signature of the sign data.
     * @param roundID The ID of the presale round.
     * @param serialNo The serialNo of operate no.
     */
    function refundFundraisingVote(Types.EIP712Signature calldata signature, uint256 roundID, uint256 serialNo) public nonReentrant{
        address targetAllocation = _allocation(roundID);
        __checkAlloction(targetAllocation);
        uint256 voteCount = IAllocation(targetAllocation).getVoteNum(roundID, msg.sender);
        MetaTxLibUpgradeable.validateVoteRefundSignature(signature, roundID, serialNo, targetAllocation, voteCount);
        IAllocation(targetAllocation).refundFundraisingVote(roundID, msg.sender);
    }


    /**
     * @dev Refund of pre-sale amount
     * 
     * note Refunds can be issued after fundraising failure
   
     * @param roundID The ID of the presale round.
     */
    function presaleRefund(uint256 roundID) public payable nonReentrant onlyRole(ROLE_BOT) {
        address targetAllocation = _allocation(roundID);
        __checkAlloction(targetAllocation);
        IAllocation(targetAllocation).presaleRefund(roundID, payable(backFeeTo()), backFee());
    }

    /**
     * @dev Release of funds raised by the project party
   
     * @param roundID The ID of the presale round.
     * @param _serialNo Fundraising amount release serial no.
     * @param _amount Fundraising amount release amount.
     * @param _fee Fundraising amount release fee.
     */
    function sendFundraising(uint256 roundID, uint256 _serialNo, uint256 _amount, uint256 _fee) public payable nonReentrant onlyRole(ROLE_BOT) {
        address targetAllocation = _allocation(roundID);
        __checkAlloction(targetAllocation);
        // if(getIssueToken(roundID) == address(0)){
        //     require(false, "InvalidSerialNoEmpty");
        //     // revert Errors.IssutTokenDoesNotExist();
        // }
        IAllocation(targetAllocation).setFee(_fee);
        IAllocation(targetAllocation).sendFundraising(roundID, _serialNo, _amount);
    }

    /**
     * @dev mint nft
     * Mint apNFT after the user completes the pre-sale purchase and successfully raises funds
     *
     * @param signature The signature of the sign data.
     * @param roundID The ID of the presale round.
     */
    function apNftMint(Types.EIP712Signature calldata signature, uint256 roundID) public nonReentrant {
        address targetAllocation = _allocation(roundID);
        if(targetAllocation == address(0)){
            targetAllocation = getPlatformAllocation();
        }
        __checkAlloction(targetAllocation);
        
        address apnft = IAllocation(targetAllocation).getApNFTTarget(roundID);
        
        if(apnft == address(0)) {
            require(false, "ApNftDoesNotExist");
            // revert Errors.ApNftDoesNotExist();
        }
        
        uint256 voteEndTime =  IAllocation(targetAllocation).getVoteEndTime(roundID);

        if(voteEndTime > 0 && voteEndTime >= block.timestamp){
            require(false, "MinNotStarted");
            // revert Errors.MinNotStarted();
        }
        uint256 mintEndTime =  IAllocation(targetAllocation).getMintEndTime(roundID);

        if(mintEndTime > 0 && mintEndTime <= block.timestamp){
            require(false, "MintHasEnded");
            // revert Errors.MintHasEnded();
        }
        
        address user = msg.sender;
        uint256 totalPreSaleNum = IAllocation(targetAllocation).getPreSaleNumByUser(user, roundID);
        
        if(totalPreSaleNum == 0) {
            require(false, "PreSaleDataDoseNotExist");
            // revert Errors.PreSaleDataDoseNotExist();
        }
        uint256 lastMintNum;
        uint256 mintNum = IAllocation(targetAllocation).getMintNum(user, roundID);

        if(totalPreSaleNum > mintNum){
            lastMintNum = totalPreSaleNum.sub(mintNum);
        } else {
            lastMintNum = totalPreSaleNum;
        }   
        if(lastMintNum > maxMintLimit) {
            lastMintNum = maxMintLimit;
        }

        // valide sign
        MetaTxLibUpgradeable.validateApNftMintSignature(signature, roundID, targetAllocation, lastMintNum);
        // function batchMint(address _to, uint256 _amount) external;
        IApNFT(apnft).batchMint(user, lastMintNum);
        // set NFT-mint num
        mintNum = mintNum.add(lastMintNum);
        IAllocation(targetAllocation).setMintNum(roundID, user, mintNum); 
        emit Events.ApNFTMint(roundID, apnft, user, totalPreSaleNum, mintNum, block.timestamp);      

    }

    /**
     * @dev Set whether to automatically mint status
     *
     * @param targetAllocation The target of the alloction address to set up.
     * @param _autoMint set status is true or false. default:false.
     */
    function setAutoMint(address targetAllocation, bool _autoMint) public onlyRole(OPERATOR_ROLE) {
        IAllocation(targetAllocation).setAutoMint(_autoMint);
    }

    /**
     * @dev Set project -apnft target contract
     *
     * @param _roundID The ID of the alloction round to set up.
     * @param _nftTarget Set the apfnt target contract of the alloction project.
     */
    function setApNFTTarget(uint256 _roundID, address _nftTarget) public onlyRole(OPERATOR_ROLE) {
        address targetAllocation = _allocation(_roundID);
        __checkAlloction(targetAllocation);
        IAllocation(targetAllocation).setApNFTTarget(_roundID,_nftTarget);
    }

    /**
     * @dev Set project -second vote end time
     *
     * @param _roundID The ID of the alloction round to set up.
     * @param _voteEndTime Set the second vote end time of the alloction project.
     */
    function setVoteEndTime(uint256 _roundID, uint256 _voteEndTime) public onlyRole(OPERATOR_ROLE) {
        address targetAllocation = _allocation(_roundID);
        __checkAlloction(targetAllocation);
        IAllocation(targetAllocation).setVoteEndTime(_roundID, _voteEndTime);
    }

    /**
     * @dev Set project - presale end time
     *
     * @param _roundID The ID of the alloction round to set up.
     * @param _endTime Set the presale end time of the alloction project.
     */
    function setEndTime(uint256 _roundID, uint256 _endTime) public onlyRole(OPERATOR_ROLE) {  
        address targetAllocation = _allocation(_roundID);
        __checkAlloction(targetAllocation);
        IAllocation(targetAllocation).setEndTime(_roundID, _endTime);
    }

    /**
     * @dev Set project - mint end time
     *
     * @param _roundID The ID of the alloction round to set up.
     * @param _mintEndTime Set the mint end time of the alloction project.
     */
    function setMintEndTime(uint256 _roundID, uint256 _mintEndTime) public onlyRole(OPERATOR_ROLE) {
        address targetAllocation = _allocation(_roundID);
        __checkAlloction(targetAllocation);
       IAllocation(targetAllocation).setMintEndTime(_roundID, _mintEndTime);
    }

    /**
     * @dev Set project - fundraising status
     *
     * @param _roundID The ID of the alloction round to set up.
     * @param _fundraisingStatus fundraising status (success or fail) to set up.
     */
    function setFundraisingStatus(uint256 _roundID, uint8 _fundraisingStatus) public onlyRole(OPERATOR_ROLE) {
        address targetAllocation = _allocation(_roundID);
        __checkAlloction(targetAllocation);
        IAllocation(targetAllocation).setFundraisingStatus(_roundID,_fundraisingStatus);  
    }

    /**
     * @dev Set apnft contract operation permissions.
     * 
     *
     * @param targetContract The apnft contract.
     * @param role  role permission.
     * @param account user address.
     */
    function setContractRole(address targetContract, bytes32 role, address account) public onlyRole(DEFAULT_ADMIN_ROLE) {
       //  function grantRole(bytes32 role, address account) 
       AccessControlUpgradeable(targetContract).grantRole(role, account);
    }
    /**
     * @dev Set the apnft vesting contract address.
     *
     * @param _apNftVesting The apnft vesting contract set.
     */
    function setApNftVesting(address _apNftVesting) public onlyRole(DEFAULT_ADMIN_ROLE) {
        StorageLib.setApNftVesting(_apNftVesting);
    }

    /**
     * @dev Set the coresky airdrop contract address.
     *
     * @param _coreskyAirDrop The coresky airdrop contract address set.
     */
    function setCoreskyAirDrop(address _coreskyAirDrop) public onlyRole(DEFAULT_ADMIN_ROLE) {
        StorageLib.setCoreskyAirDrop(_coreskyAirDrop);
    }

    /**
     * @dev Set the governance address.
     *
     * @param newGovernance The new governance address to set.
     */
    function setGovernance(address newGovernance) external onlyRole(DEFAULT_ADMIN_ROLE){
        StorageLib.setGovernance(newGovernance);
    }


    /**
     * @dev Set the emergency admin address.
     *
     * @param newEmergencyAdmin The new governance address to set.
     */
    function setEmergencyAdmin(address newEmergencyAdmin) external onlyRole(DEFAULT_ADMIN_ROLE){
        StorageLib.setEmergencyAdmin(newEmergencyAdmin);
    }

    /**
     * @dev Set the allocation admin address.
     *
     * @param newAllocation The new allocation address to set.
     */
    function setPlatformAllocation(address newAllocation) public onlyRole(DEFAULT_ADMIN_ROLE){
        StorageLib.setPlatformAllocation(newAllocation);
        StorageLib.getAllocationOwner()[newAllocation] = msg.sender;
        StorageLib.allAllocations().push(newAllocation);
    }

    /**
     * @dev Set the allocation admin address.
     *
     * @param newApNFT The new allocation address to set.
     */
    function setPlatformApNFT(address newApNFT) public onlyRole(DEFAULT_ADMIN_ROLE){
        StorageLib.setPlatformApNFT(newApNFT);
    }


    /**
     * @dev Set the allocation max mint limit.
     *
     * @param _maxMintlimit Max mint limit
     */
    function setMaxMintLimit(uint256 _maxMintlimit) public onlyRole(OPERATOR_ROLE){
        maxMintLimit = _maxMintlimit;
    }

    function getDomainSeparator() external view virtual returns (bytes32) {
        return MetaTxLibUpgradeable.calculateDomainSeparator();
    }

    
    function incrementNonce(uint8 increment) external {
        MetaTxLibUpgradeable.incrementNonce(increment);
    }

    function nonce() public view returns (uint256){
        return MetaTxLibUpgradeable.getNonce(msg.sender);
    }

    /**
     * @dev Set the allocation max limit.
     *
     * @param limit max allocation limit.
     */
    function setMaxAllocationLimit(uint256 limit) public onlyRole(OPERATOR_ROLE){
        StorageLib.setMaxAllocationLimit(limit);
    }

}
