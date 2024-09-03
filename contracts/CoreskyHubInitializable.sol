// SPDX-License-Identifier: MIT

pragma solidity ^0.8.15;

import {CoreskyHubUpgradeable} from './upgrade/CoreskyHubUpgradeable.sol';
import {Types} from './libraries/Types.sol';
import {VersionedInitializable} from './upgrade/VersionedInitializable.sol';
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";


/**
 * @title CoreskyHubInitializable
 * @author Coresky Protocol
 *
 * @notice Extension of CoreskyHub contract that includes initialization for fresh deployments.
 *
 * @custom:upgradeable Transparent upgradeable proxy.
 * See `../CoreskyHubUpgradeable.sol` for the version without initalizer.
 */
contract CoreskyHubInitializable is Initializable, VersionedInitializable, CoreskyHubUpgradeable {
    // Constant for upgradeability purposes, see VersionedInitializable.
    // Do not confuse it with the EIP-712 version number.
    uint256 internal constant REVISION = 1;
    
    function initialize(
        address allocationImpl, 
        address apNFTImpl,
        address admin_, address operator_, address bot_) external initializer versionInit{
        __CoreskyHub_init(allocationImpl, apNFTImpl, admin_, operator_, bot_);
    }

    function getRevision() public pure virtual override returns (uint256) {
        return REVISION;
    }
}
