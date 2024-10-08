// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0;

/**
 * @title ICoreskyHub
 * @author Coresky Protocol
 *
 * @notice This is the interface for the CoreskyHub contract, the main entry point for the Coresky Protocol.
 * You'll find all the events and external functions, as well as the reasoning behind them here.
 */
interface ICoreskyHubInitializable {
    /**
     * @notice Initializes the CoreskyHub, setting the initial governance address, the name and symbol of the profiles
     * in the CoreskyNFTBase contract, and Protocol State (Paused).
     * @dev This is assuming a proxy pattern is implemented.
     * @custom:permissions Callable once.
     *
     */
    function initialize(address admin_, address operator_, address bot_) external;
}
