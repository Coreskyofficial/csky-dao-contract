// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;


import {Types} from '../libraries/Types.sol';
import {StorageLib} from "../libraries/StorageLib.sol";

/**
 * @title CoreHubStorage
 * @author CoreHub Protocol
 *
 * @notice This is an abstract contract that ONLY contains storage for the CoreHub contract. This MUST be inherited last
 * to preserve the LensHub storage layout. Adding storage variables should be done ONLY at the bottom of this contract.
 */
abstract contract CoreHubStorage {

    // Operator role
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    // Project Role
    bytes32 public constant PROJECT_ROLE = keccak256("PROJECT_ROLE");
    // Project Operator Role
    bytes32 public constant PROJECT_OPERATOR_ROLE = keccak256("PROJECT_OPERATOR_ROLE");
    // Sign BOT Role
    bytes32 public constant ROLE_BOT = keccak256("ROLE_BOT");
    // Fund management Role
    bytes32 public constant ROLE_FUND_AMDIN = keccak256("ROLE_FUND_AMDIN");

    // Project party votes - restart after 7 days
    uint256 public constant VOTE_EXPIRE_TIME = 604800;

    uint256 public maxMintLimit;

    // signature => exsist: 0 or 1 
    mapping(bytes32 =>uint8) public signMap;

    // serialNo=>Proposal
    // mapping(uint256 =>Types.Proposal) public getProjectVote;//Slot#16
    function getProjectVote(uint256 serialNo) public view returns (Types.Proposal memory){
        return StorageLib.getProjectVote()[serialNo];
    }
    // project=> isProject
    // mapping(address => bool) public isProject;//Slot#15
    function isProject(address project) public view returns (bool){
        return StorageLib.isProject()[project];
    }
    // roundId => Allocation
    // mapping(uint256 => address) public getAllocation;//Slot#14
    function getAllocation(uint256 roundId) public view returns (address){
        return StorageLib.getAllocation()[roundId];
    }
    // Allocation => owner
    // mapping(address => address) public getAllocationOwner;//Slot#13
    function getAllocationOwner(address alloc) public view returns (address){
        return StorageLib.getAllocationOwner()[alloc];
    }
    // Allocation => apNFT
    // mapping(address => address) public getAllocationNFT;//Slot#12
    function getAllocationNFT(address alloc) public view returns (address){
        return StorageLib.getAllocationNFT()[alloc];
    }
    // apNftNo => apNFT
    // mapping(uint256 => address) public getApNFT;//Slot#11
    function getApNFT(uint256 apNftNo) public view returns (address){
        return StorageLib.getApNFT()[apNftNo];
    }
    // Allocation => IssueToken(Erc20)
    // mapping(address => Types.IssueToken) public getAllocationIssueToken;//Slot#10
    function getAllocationIssueToken(address alloc) public view returns (Types.IssueToken memory) {
        return StorageLib.getAllocationIssueToken()[alloc];
    }

    // roundId => IssueToken(Erc20)
    // mapping(uint256 => address) public getIssueToken;//Slot#9
    function getIssueToken(uint256 roundID) public view returns (address) {
        return StorageLib.getIssueToken()[roundID];
    }
    // All Allocations
    // address[] public allAllocations;//Slot#8
    function allAllocationsByIndex(uint256 index) public pure returns (address) {
        return allAllocations()[index];
    }
    function allAllocations() public pure returns (address[] memory) {
        return StorageLib.allAllocations();
    }
    // Project funding handling fee
    // uint256 public fee;//Slot#7
    function fee() public view returns (uint256) {
       return StorageLib.getFee();
    }
    // Address for receiving project party's fund handling fees
    // address public feeTo;//Slot#6
    function feeTo() public view returns (address) {
        return StorageLib.getFeeTo();
    }
    // Fund refund handling fee
    // uint256 public backFee;//Slot#5
    function backFee() public view returns (uint256) {
       return StorageLib.getBackFee();
    }
    // Address for receiving transaction fees for fund refund
    // address public backFeeTo;//Slot#4
    function backFeeTo() public view returns (address) {
        return StorageLib.getBackFeeTo();
    }
    // Asset vesting contract address
    // address public apNftVesting;//Slot#3
    function getApNftVesting() public view returns (address){
        return StorageLib.getApNftVesting();
    }
    // token airdrop contract address
    // address public coreskyAirDrop; //Slot#2
    function getCoreskyAirDrop() public view returns (address){
        return StorageLib.getCoreskyAirDrop();
    }
    // Governance token
    // address public governanceToken; //Slot#1
    function getGovernance() public view returns (address){
        return StorageLib.getGovernance();
    }
    // emergency admin
    // address public emergencyAdmin; //Slot#0
    function getEmergencyAdmin() public view returns (address){
        return StorageLib.getEmergencyAdmin();
    }
    // PlatformAllocation
    // address public platformAllocation; // Slot#19
    function getPlatformAllocation() public view returns (address) {
        return StorageLib.getPlatformAllocation();
    }
    // PlatformApNFT
    // address public platformApNFT; // Slot#20
    function getPlatformApNFT() public view returns (address) {
        return StorageLib.getPlatformApNFT();
    }


}
