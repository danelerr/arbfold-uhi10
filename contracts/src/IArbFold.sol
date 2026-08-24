// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

interface IArbFoldHook {
    function coordinator() external view returns (address);
    function poolManager() external view returns (IPoolManager);
    function poolKey() external view returns (PoolKey memory);
    function reserves() external view returns (uint256 reserve0, uint256 reserve1);
    function setReservesFromCoordinator(uint256 reserve0, uint256 reserve1) external;
    function authorizeCoordinator() external;
}

interface IArbFoldCoordinator {
    function fold(address solver) external;
    function isHook(address candidate) external view returns (bool);
}
