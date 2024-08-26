// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IApNFT {

    function initialize(string memory name_,string memory symbol_,string memory baseUri_) external;

    function mint(address _to, uint256 _tokenId) external;

    function batchMint(address _to, uint256 _amount) external;

    function ownerBatchMint(address[] calldata _tos) external;
}
