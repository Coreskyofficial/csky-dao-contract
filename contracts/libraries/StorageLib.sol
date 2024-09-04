// SPDX-License-Identifier: MIT

pragma solidity ^0.8.15;

import {Types} from './Types.sol';

library StorageLib {
    // emergency admin
    uint256 constant EMERGENCY_ADMIN_SLOT = 0;
    //  Governance token
    uint256 constant GOVERNANCE_SLOT = 1;
    // token airdrop contract address
    uint256 constant CORESKY_AIRDROP_SLOT = 2;
    // Asset vesting contract address
    uint256 constant APNFT_VESTING_SLOT = 3;
    // Address for receiving transaction fees for fund refund
    uint256 constant BACKFEETO_SLOT = 4;
    // Fund refund handling fee
    uint256 constant BACKFEE_SLOT = 5;
    // Address for receiving project party's fund handling fees
    uint256 constant FEETO_SLOT = 6;
    // Fund refund handling fee
    uint256 constant FEE_SLOT = 7;
    // All Allocations
    uint256 constant ALL_ALLOCATIONS_SLOT = 8;
    uint256 constant GET_ISSUE_TOKEN_MAPPING_SLOT = 9;
    uint256 constant GET_ALLOCATION_ISSUE_TOKEN_MAPPING_SLOT = 10;
    uint256 constant GET_APNFT_MAPPING_SLOT = 11;
    uint256 constant GET_ALLOCATION_NFT_MAPPING_SLOT = 12;
    uint256 constant GET_ALLOCATION_OWNER_MAPPING_SLOT = 13;
    uint256 constant GET_ALLOCATION_MAPPING_SLOT = 14;
    uint256 constant IS_PROJECT_MAPPING_SLOT = 15;
    uint256 constant GET_PROJECT_VOTE_MAPPING_SLOT = 16;

    uint256 constant SIG_NONCES_MAPPING_SLOT = 17;
    uint256 constant LAST_INITIALIZED_REVISION_SLOT = 18; 

    
    uint256 constant PLATFORM_ALLOCATION_SLOT = 19;
    uint256 constant PLATFORM_APNFT_SLOT = 20; 

    uint256 constant MAX_ALLOCATION_LIMIT_SLOT = 21; 
    uint256 constant GROUP_ALLOCATIONS_MAPPING_SLOT = 22; 

    
    // groupId => address[]    
    function groupAllocations() internal pure returns (mapping(uint256 => address[]) storage _groupAllocations) {
        assembly {
            _groupAllocations.slot := GROUP_ALLOCATIONS_MAPPING_SLOT
        }
    }

    function getMaxAllocationLimit() internal view returns (uint256 _maxAllocationLimit) {
        assembly {
            _maxAllocationLimit := sload(MAX_ALLOCATION_LIMIT_SLOT)
        }
    }

    function setMaxAllocationLimit(uint256 newmaxAllocationLimit) internal {
        assembly {
            sstore(MAX_ALLOCATION_LIMIT_SLOT, newmaxAllocationLimit)
        }
    }


    function getPlatformApNFT() internal view returns (address _platformApNFT) {
        assembly {
            _platformApNFT := sload(PLATFORM_APNFT_SLOT)
        }
    }

    function setPlatformApNFT(address newPlatformApNFT) internal {
        assembly {
            sstore(PLATFORM_APNFT_SLOT, newPlatformApNFT)
        }
    }

    function getPlatformAllocation() internal view returns (address _platformAllocation) {
        assembly {
            _platformAllocation := sload(PLATFORM_ALLOCATION_SLOT)
        }
    }

    function setPlatformAllocation(address newPlatformAllocation) internal {
        assembly {
            sstore(PLATFORM_ALLOCATION_SLOT, newPlatformAllocation)
        }
    }

    function getGovernance() internal view returns (address _governance) {
        assembly {
            _governance := sload(GOVERNANCE_SLOT)
        }
    }

    function setGovernance(address newGovernance) internal {
        assembly {
            sstore(GOVERNANCE_SLOT, newGovernance)
        }
    }

    function getEmergencyAdmin() internal view returns (address _emergencyAdmin) {
        assembly {
            _emergencyAdmin := sload(EMERGENCY_ADMIN_SLOT)
        }
    }

    function setEmergencyAdmin(address newEmergencyAdmin) internal {
        assembly {
            sstore(EMERGENCY_ADMIN_SLOT, newEmergencyAdmin)
        }
    }


    function getCoreskyAirDrop() internal view returns (address _coreskyAirDrop) {
        assembly {
            _coreskyAirDrop := sload(CORESKY_AIRDROP_SLOT)
        }
    }

    function setCoreskyAirDrop(address coreskyAirDrop) internal {
        assembly {
            sstore(CORESKY_AIRDROP_SLOT, coreskyAirDrop)
        }
    }

    function getApNftVesting() internal view returns (address _apNftVesting) {
        assembly {
            _apNftVesting := sload(APNFT_VESTING_SLOT)
        }
    }

    function setApNftVesting(address apNftVesting) internal {
        assembly {
            sstore(APNFT_VESTING_SLOT, apNftVesting)
        }
    }

    function getBackFeeTo() internal view returns (address _backFeeTo) {
        assembly {
            _backFeeTo := sload(BACKFEETO_SLOT)
        }
    }

    function setBackFeeTo(address backFeeTo) internal {
        assembly {
            sstore(BACKFEETO_SLOT, backFeeTo)
        }
    }

    function getBackFee() internal view returns (uint256 _backFee) {
        assembly {
            _backFee := sload(BACKFEE_SLOT)
        }
    }

    function setBackFee(uint256 backFee) internal {
        assembly {
            sstore(BACKFEE_SLOT, backFee)
        }
    }

    function getFeeTo() internal view returns (address _feeTo) {
        assembly {
            _feeTo := sload(FEETO_SLOT)
        }
    }

    function setFeeTo(address feeTo) internal {
        assembly {
            sstore(FEETO_SLOT, feeTo)
        }
    }

    function getFee() internal view returns (uint256 _fee) {
        assembly {
            _fee := sload(FEE_SLOT)
        }
    }

    function setFee(uint256 fee) internal {
        assembly {
            sstore(FEE_SLOT, fee)
        }
    }

    function allAllocations() internal pure returns (address[] storage _allAllocations) {
        assembly {
            _allAllocations.slot := ALL_ALLOCATIONS_SLOT
        }
    }


    function getIssueToken() internal pure returns (mapping(uint256 => address) storage _getIssueToken) {
        assembly {
            _getIssueToken.slot := GET_ISSUE_TOKEN_MAPPING_SLOT
        }
    }

        function getAllocationIssueToken() internal pure returns (mapping(address => Types.IssueToken) storage _getAllocationIssueToken) {
        assembly {
            _getAllocationIssueToken.slot := GET_ALLOCATION_ISSUE_TOKEN_MAPPING_SLOT
        }
    }

        function getApNFT() internal pure returns (mapping(uint256 => address) storage _getApNFT) {
        assembly {
            _getApNFT.slot := GET_APNFT_MAPPING_SLOT
        }
    }

        function getAllocationNFT() internal pure returns (mapping(address => address) storage _getAllocationNFT) {
        assembly {
            _getAllocationNFT.slot := GET_ALLOCATION_NFT_MAPPING_SLOT
        }
    }

        function getAllocationOwner() internal pure returns (mapping(address => address) storage _getAllocationOwner) {
        assembly {
            _getAllocationOwner.slot := GET_ALLOCATION_OWNER_MAPPING_SLOT
        }
    }

        function getAllocation() internal pure returns (mapping(uint256 => address) storage _getAllocation) {
        assembly {
            _getAllocation.slot := GET_ALLOCATION_MAPPING_SLOT
        }
    }

        function isProject() internal pure returns (mapping(address => bool) storage _isProject) {
        assembly {
            _isProject.slot := IS_PROJECT_MAPPING_SLOT
        }
    }

        function getProjectVote() internal pure returns (mapping(uint256 => Types.Proposal) storage _getProjectVote) {
        assembly {
            _getProjectVote.slot := GET_PROJECT_VOTE_MAPPING_SLOT
        }
    }


    function nonces() internal pure returns (mapping(address => uint256) storage _nonces) {
        assembly {
            _nonces.slot := SIG_NONCES_MAPPING_SLOT
        }
    }

    function getLastInitializedRevision() internal view returns (uint256 _lastInitializedRevision) {
        assembly {
            _lastInitializedRevision := sload(LAST_INITIALIZED_REVISION_SLOT)
        }
    }

    function setLastInitializedRevision(uint256 newLastInitializedRevision) internal {
        assembly {
            sstore(LAST_INITIALIZED_REVISION_SLOT, newLastInitializedRevision)
        }
    }

}
