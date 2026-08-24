// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

interface ICPMMHook {
    function reserves() external view returns (uint256 reserve0, uint256 reserve1);
    function setReservesFromCoordinator(uint256 reserve0, uint256 reserve1) external;
    function creditReserveFromCoordinator(Currency currency, uint256 amount) external;
    function authorizeCoordinator() external;
}

interface IArbFoldCoordinator {
    function fold(address solver) external;
}

