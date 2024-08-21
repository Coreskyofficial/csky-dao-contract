// SPDX-License-Identifier: MIT

pragma solidity ^0.8.15;


import {Events} from './Events.sol';
import {Errors} from './Errors.sol';
import {StorageLib} from './StorageLib.sol';
import {Allocation} from  "../base/Allocation.sol";

library AllocationLib {

    function createAllocation(
        uint256 _groupID,
        uint256 _roundID,
        address _target,
        address _payment,
        uint256 _nftPrice,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _voteEndTime,
        uint256 _mintEndTime,
        uint256 _totalQuantity
    ) external returns (address){
        // 创建新合约
        Allocation all = new Allocation(address(this), address(this));
        all.setRecivedPay(msg.sender);
        
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
            _payment,
            _nftPrice,
            _startTime,
            _endTime,
            _voteEndTime,
            _mintEndTime,
            _totalQuantity
        );


        emit Events.AllocationCreated(_roundID, address(all), msg.sender, block.timestamp);

        return address(all);
    }

}
