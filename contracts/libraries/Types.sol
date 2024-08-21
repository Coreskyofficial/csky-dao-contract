// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0;

/**
 * @title Types
 * @author CORESKY Protocol
 *
 * @notice A standard library of data types used throughout the CORESKY Protocol.
 */
library Types {
    /**
     * @notice A struct containing the necessary information to reconstruct an EIP-712 typed data signature.
     *
     * @param signer The address of the signer. Specially needed as a parameter to support EIP-1271.
     * @param v The signature's recovery parameter.
     * @param r The signature's r parameter.
     * @param s The signature's s parameter.
     * @param deadline The signature's deadline.
     */
    struct EIP712Signature {
        address signer;
        uint8 v;
        bytes32 r;
        bytes32 s;
        uint256 deadline;
    }

    struct Proposal{
        //Voting number
        uint256 serialNo;
        //Project address
        address projectAddr;
        //Support quantity
        uint256 supportCount;
        //Oppose quantity
        uint256 opposeCount;
        //Voting ratio
        uint256 voteRatio;
        //Expiration date
        uint256 expireTime;
        //Total payment amount
        uint256 amount;
    }

    struct Vote{
        //Oppose quantity
        uint256 voteCount;
        //Total number of votes
        uint256 totalVote;
        //Voting ratio
        uint256 voteRatio;
    }

    /**
     * @notice An enum containing the different states the protocol can be in, limiting certain actions.
     *
     * @param Unpaused The fully unpaused state.
     * @param PublishingPaused The state where only publication creation functions are paused.
     * @param Paused The fully paused state.
     */
    enum ProtocolState {
        Unpaused,
        PublishingPaused,
        Paused
    }

    struct Project {
        address target;             // nft or deposit or any contract
        address payable receipt;    // receive payment
        address payment;            // ETH or ERC20
        uint256 nftPrice;           // nft nftPrice
        uint256 totalSales;         // nft totalSales
        uint256 startTime;          // start
        uint256 endTime;            // end
        // user=> presaleID => total
        mapping(address => mapping(uint256 => uint256)) preSaleRecords;  //preSale records
    }

    struct PreSaleLog {
        uint256 preSaleID;
        address preSaleUser;  
        uint256 paymentTime; 
        uint256 preSaleNum;
    }

    struct VestingLog {
        uint256 unlockIndex;
        uint256[] unlockTime; 
        uint256[] unlockNum;
    }

    struct SendFundraisingLog {
        uint256 sendTime; 
        uint256 amount;
        uint256 receiveAmount;
    }

    struct IssueToken {
        address issueToken;
        uint256 chainId;
        uint256 nftContainNum;
    }

    enum FundraisingStatus {
        None,
        Success,
        Fail
    }

    struct AllocStatus {
        uint8 fundraisingStatus;    // 0-none;1-success;2-fail
        bool isAllowOversold;       // AllowOversold: true/false
        bool isSoldOut;             // SoldOut:true/false
        bool paused;                // paused:true/false
    }

    struct AlloctionInfo {
        address target;             // nft or deposit or any contract
        address receipt;            // receive payment
        address payment;            // ETH or ERC20
        uint256 nftPrice;           // nft nftPrice
        uint256 totalSales;         // nft totalSales
        uint256 startTime;          // presale start
        uint256 endTime;            // presale end
        uint256 totalQuantity;      // total
        uint256 voteEndTime;        // vote end
        uint256 mintEndTime;        // mint end
        address issueToken;         // issue token address
        address recivedPay;         // Recive payment address of the project fundraising
        AllocStatus status;
    }

}
