// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {Errors} from '../libraries/Errors.sol';
import {StorageLib} from '../libraries/StorageLib.sol';

/**
 * @title VersionedInitializable
 *
 * @dev Helper contract to implement initializer functions. To use it, replace
 * the constructor with a function that has the `initializer` modifier.
 * WARNING: Unlike constructors, initializer functions must be manually
 * invoked. This applies both to deploying an Initializable contract, as well
 * as extending an Initializable contract via inheritance.
 * WARNING: When used with inheritance, manual care must be taken to not invoke
 * a parent initializer twice, or ensure that all initializers are idempotent,
 * because this is not dealt with automatically as with constructors.
 *
 * @author Coresky Protocol, inspired by Aave's implementation, which is in turn inspired by OpenZeppelin's
 * Initializable contract
 */
abstract contract VersionedInitializable {
    ///@custom:oz-upgrades-unsafe-allow state-variable-immutable
    address private immutable originalImpl;

    /**
     * @dev Modifier to use in the initializer function of a contract.
     */
    modifier versionInit() {
        if (address(this) == originalImpl) {
            revert Errors.CannotInitImplementation();
        }
        if (getRevision() <= StorageLib.getLastInitializedRevision()) {
            revert Errors.Initialized();
        }
        StorageLib.setLastInitializedRevision(getRevision());
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        originalImpl = address(this);
    }

    /**
     * @dev returns the revision number of the contract
     * Needs to be defined in the inherited class as a constant.
     **/
    function getRevision() public pure virtual returns (uint256);
}
