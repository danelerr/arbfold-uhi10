// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {ArbFoldHook} from "./ArbFoldHook.sol";

/// @notice Small CREATE2 factory used so hook permission bits can be mined reproducibly.
contract ArbFoldHookDeployer {
    event HookDeployed(address indexed hook, bytes32 indexed salt);

    function deploy(IPoolManager manager, address coordinator, bytes32 salt) external returns (ArbFoldHook hook) {
        hook = new ArbFoldHook{salt: salt}(manager, coordinator);
        emit HookDeployed(address(hook), salt);
    }
}

