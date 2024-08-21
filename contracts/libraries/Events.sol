// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0;

import {Types} from './Types.sol';

library Events {

    /**
     * @dev Emitted when a signer's nonce is used and, as a consequence, the next available nonce is updated.
     *
     * @param signer The signer whose next available nonce was updated.
     * @param nonce The next available nonce that can be used to execute a meta-tx successfully.
     * @param timestamp The UNIX timestamp of the nonce being used.
     */
    event NonceUpdated(address indexed signer, uint256 nonce, uint256 timestamp);
    
    event ApNFTCreated(uint256 indexed apNftNo, address indexed apNft, address owner, uint256 timestamp);

    event AllocationCreated(uint256 indexed roundID, address indexed allocation, address owner, uint256 timestamp);

    event ApNFTMint(address indexed apNft, address owner, uint256 preSaleNum, uint256 mintNum, uint256 timestamp);
    
    event ApplyProjectVote(uint256 indexed _groupID, address indexed _projectAddr, address indexed project, uint256 timestamp);

    event DepositIssueToken(uint256 indexed roundID, address indexed issueToken, uint256 chainId, uint256 totalNum, uint256 timestamp);
}
