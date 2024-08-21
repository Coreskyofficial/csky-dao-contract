// SPDX-License-Identifier: MIT

pragma solidity ^0.8.15;


import {Events} from './Events.sol';
import {Errors} from './Errors.sol';
import {StorageLib} from './StorageLib.sol';
import {AssetPackagedNFT} from "../base/AssetPackagedNFT.sol";

library ApNftLib {
  
    function deployApNFT(
        uint256 apNftNo,
        string memory _name,
        string memory _symbol,
        string memory _baseUri
    ) external {
        if (apNftNo == 0) {
            revert Errors.ApNftDoesNotExist();
        }

        if (StorageLib.getApNFT()[apNftNo] != address(0)) {
            revert Errors.ApNftExist();
        }

        AssetPackagedNFT nft = new AssetPackagedNFT(_name, _symbol, _baseUri);
        StorageLib.getApNFT()[apNftNo] = address(nft);

        emit Events.ApNFTCreated(apNftNo,  address(nft), msg.sender, block.timestamp);
    }
}
