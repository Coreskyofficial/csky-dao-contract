// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0;

library Typehash {

    bytes32 constant EIP712_DOMAIN = keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');

    bytes32 constant ADD_PROPOSAL = keccak256('addProposal(uint256 serialNo,address projectAddr,uint256 supportCount,uint256 opposeCount,uint256 voteRatio,uint256 expireTime,uint256 nonce,uint256 deadline)');

    bytes32 constant VOTE_SUPPORT_PROPOSAL = keccak256('voteSupport(uint256 serialNo,address voteAddr,uint256 voteCount,uint256 nonce,uint256 deadline)');

    bytes32 constant VOTE_OPPOSE_PROPOSAL = keccak256('voteOppose(uint256 serialNo,address voteAddr,uint256 voteCount,uint256 nonce,uint256 deadline)');

    bytes32 constant VOTE_REFUND_ALLOCATION = keccak256('refundFundraisingVote(uint256 roundID,uint256 serialNo,address voteAddr,uint256 voteCount,uint256 nonce,uint256 deadline)');

    bytes32 constant APNFT_MINT_ALLOCATION = keccak256('apNftMint(uint256 roundID,address allocationAddr,uint256 mintNum,uint256 nonce,uint256 deadline)');

    bytes32 constant SET_APNFT_METADATA_URI = keccak256('setApNFTMetadataURI(uint256 serialNo,string metadataURI,uint256 nonce,uint256 deadline)');

    bytes32 constant BOT_SIGN_PROJECT_VOTE = keccak256('projectVoting(uint256 serialNo,address projectAddr,uint256 supportCount,uint256 opposeCount,uint256 voteRatio,uint256 expireTime,uint256 nonce,uint256 deadline)');

    bytes32 constant BOT_SIGN_DEPLOY_APNFT = keccak256('deployApNFT(uint256 apNftNo,string name,string symbol,string baseUri,uint256 deadline)');
}