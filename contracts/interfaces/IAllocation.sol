// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IAllocation {
  
   
    ////////////////////////////////Function set//////////////////////////////////////

    /**
     * @dev Executes a function csetTotalQuantity contract. If the total number is greater than 0, oversold is allowed
     * @param _roundID project Id
     * @param _totalQuantity total number
     */
    function setTotalQuantity(uint256 _roundID, uint256 _totalQuantity) external;
    // Set project NFT mint quantity
    function setMintNum(address _user, uint256 _mintNum) external;
    // Set up automatic Mint NFT to the user's address after pre-sale of the project
    function setAutoMint(bool _autoMint) external;
    // set project nft target by the roundID.
    function setApNFTTarget(uint256 _roundID,  address _nftTarget) external; 
    // Set Project - Pre sale End Time
    function setEndTime(uint256 _roundID,  uint256 _endTime) external;
    // Set Project - Second Voting End Time
    function setVoteEndTime(uint256 _roundID,  uint256 _voteEndTime) external;
    // Set project - int end time
    function setMintEndTime(uint256 _roundID,  uint256 _mintEndTime) external;
    // Set Project - Fundraising Status
    function setFundraisingStatus(uint256 _roundID,  uint8 _fundraisingStatus) external; 
    // Set Project - Payment Acceptance Address
    function setPaymentReceipt(uint256 _roundID,  address _receipt) external; 
    // Set up project - Issue Token
    function setIssueToken(uint256 _roundID,  address _issueToken) external; 
    // Set project funding handling fees
    function setFee(uint256 _fee) external;
    // Project pause
    function pause(uint256 _roundID) external;
    // Project suspension and resumption
    function unpause(uint256 _roundID) external;
    // Refund Voting
    function refundFundraisingVote(uint256 _roundID,  address _voteUser) external; 
    // User refund
    function presaleRefund(uint256 _roundID,  address payable _Referrer, uint256 _ReferrerFee) external;
    //Distribute project fundraising amount
    function sendFundraising(uint256 _roundID,  uint256 _serialNo, uint256 _amount) external;

    ////////////////////////////////Function get//////////////////////////////////////
    // Returns project toatal quantity by the roundID.
    function getTotalQuantity(uint256 _roundID) external view returns (uint256);

    // Returns project apnft target by the _roundID.
    function getApNFTTarget(uint256 _roundID) external view returns (address);
    // Returns project preSale num by _user.
    function getPreSaleNum(address _user, uint256 _preSaleID) external view returns (uint256);    
    // Returns project preSale num by the _user and _ronudID.
    function getPreSaleNumByUser(address _user, uint256 _roundID) external view returns (uint256);
    // Returns project preSale minted num by the _user.
    function getMintNum(address _user) external view returns (uint256);
    // Returns project voteEndTime num by the _roundID.
    function getVoteEndTime(uint256 _roundID) external view returns (uint256);
    // Returns project mintEndTime num by the _roundID.
    function getMintEndTime(uint256 _roundID) external view returns (uint256);
    // Returns project Fundraising staus (Success/Fail) by the _roundID.
    function getFundraisingStatus(uint256 _roundID) external view returns (uint8);
    // Returns project vote num (Success/Fail) by the _roundID and _user.
    function getVoteNum(uint256 _roundID, address _user) external view returns (uint256);
    // Returns project totalSales by the _roundID.
    function getProjectTotalSales(uint256 _roundID) external view returns (uint256);
    // Returns project issue token by the _roundID.
    function getIssueToken(uint256 _roundID) external view returns (address);


}
