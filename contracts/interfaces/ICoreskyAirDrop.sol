// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface ICoreskyAirDrop {
  
    /**
     * batch transfer erc20 token
     */
    function sendERC20(
        uint256 _batchNo,
        address _tokenAddress,
        address[] calldata _to,
        uint256[] calldata _value,
        uint256[] calldata _serialNo
    ) external returns (bool _success);

    function getApNFTDrop(uint256 _serialNo)
        external
        view
        returns (uint256, address, address, uint256, uint256);

    function getBatchSerialNo(uint256 _batchNo)
        external
        view
        returns (uint256[] memory);
}
