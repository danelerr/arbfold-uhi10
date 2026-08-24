// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {ArbFoldCoordinator} from "../src/ArbFoldCoordinator.sol";
import {ArbFoldHook} from "../src/ArbFoldHook.sol";
import {ArbFoldRouter} from "../src/ArbFoldRouter.sol";
import {CycleMath} from "../src/CycleMath.sol";

/// @notice Read-only post-deployment verifier for local and public ARBFOLD networks.
contract VerifyArbFoldDeployment is Script {
    using CurrencyLibrary for Currency;

    uint24 private constant DYNAMIC_FEE = LPFeeLibrary.DYNAMIC_FEE_FLAG;
    int24 private constant TICK_SPACING = 60;
    uint256 private constant EIP170_RUNTIME_LIMIT = 24_576;

    error InvalidDeployment(bytes32 check);

    struct Addresses {
        IPoolManager manager;
        ArbFoldCoordinator coordinator;
        ArbFoldHook hookAB;
        ArbFoldHook hookBC;
        ArbFoldHook hookAC;
        ArbFoldRouter router;
        address tokenA;
        address tokenB;
        address tokenC;
        address solver;
    }

    function run() external view {
        Addresses memory deployed = Addresses({
            manager: IPoolManager(vm.envAddress("POOL_MANAGER")),
            coordinator: ArbFoldCoordinator(vm.envAddress("COORDINATOR")),
            hookAB: ArbFoldHook(vm.envAddress("HOOK_AB")),
            hookBC: ArbFoldHook(vm.envAddress("HOOK_BC")),
            hookAC: ArbFoldHook(vm.envAddress("HOOK_AC")),
            router: ArbFoldRouter(vm.envAddress("ROUTER")),
            tokenA: vm.envAddress("TOKEN_A"),
            tokenB: vm.envAddress("TOKEN_B"),
            tokenC: vm.envAddress("TOKEN_C"),
            solver: vm.envOr("SOLVER", address(0))
        });
        verify(deployed);
        console2.log("ARBFOLD deployment verification PASS");
    }

    function verify(Addresses memory deployed) public view {
        _hasCode(address(deployed.manager), "manager-code");
        _hasCode(address(deployed.coordinator), "coordinator-code");
        _hasCode(address(deployed.hookAB), "hook-ab-code");
        _hasCode(address(deployed.hookBC), "hook-bc-code");
        _hasCode(address(deployed.hookAC), "hook-ac-code");
        _hasCode(address(deployed.router), "router-code");
        _hasCode(deployed.tokenA, "token-a-code");
        _hasCode(deployed.tokenB, "token-b-code");
        _hasCode(deployed.tokenC, "token-c-code");

        if (
            address(deployed.coordinator.manager()) != address(deployed.manager)
                || address(deployed.router.manager()) != address(deployed.manager)
                || address(deployed.router.coordinator()) != address(deployed.coordinator)
        ) _fail("manager-binding");
        if (
            Currency.unwrap(deployed.coordinator.tokenA()) != deployed.tokenA
                || Currency.unwrap(deployed.coordinator.tokenB()) != deployed.tokenB
                || Currency.unwrap(deployed.coordinator.tokenC()) != deployed.tokenC
        ) _fail("token-binding");
        if (!deployed.coordinator.configured()) _fail("configured");
        if (
            address(deployed.coordinator.hookAB()) != address(deployed.hookAB)
                || address(deployed.coordinator.hookBC()) != address(deployed.hookBC)
                || address(deployed.coordinator.hookAC()) != address(deployed.hookAC)
        ) _fail("hook-binding");

        _verifyHook(deployed, deployed.hookAB, deployed.tokenA, deployed.tokenB, "hook-ab");
        _verifyHook(deployed, deployed.hookBC, deployed.tokenB, deployed.tokenC, "hook-bc");
        _verifyHook(deployed, deployed.hookAC, deployed.tokenA, deployed.tokenC, "hook-ac");

        CycleMath.Network memory n = deployed.coordinator.network();
        if (n.abA == 0 || n.abB == 0 || n.bcB == 0 || n.bcC == 0 || n.acA == 0 || n.acC == 0) {
            _fail("positive-reserves");
        }
        if (
            deployed.manager.balanceOf(address(deployed.hookAB), Currency.wrap(deployed.tokenA).toId()) != n.abA
                || deployed.manager.balanceOf(address(deployed.hookAB), Currency.wrap(deployed.tokenB).toId()) != n.abB
                || deployed.manager.balanceOf(address(deployed.hookBC), Currency.wrap(deployed.tokenB).toId()) != n.bcB
                || deployed.manager.balanceOf(address(deployed.hookBC), Currency.wrap(deployed.tokenC).toId()) != n.bcC
                || deployed.manager.balanceOf(address(deployed.hookAC), Currency.wrap(deployed.tokenA).toId()) != n.acA
                || deployed.manager.balanceOf(address(deployed.hookAC), Currency.wrap(deployed.tokenC).toId()) != n.acC
        ) _fail("reserve-claim-equality");

        uint256 solverClaim = deployed.solver == address(0)
            ? 0
            : deployed.manager.balanceOf(deployed.solver, Currency.wrap(deployed.tokenA).toId());
        if (IERC20(deployed.tokenA).balanceOf(address(deployed.manager)) != n.abA + n.acA + solverClaim) {
            _fail("token-a-backing");
        }
        if (IERC20(deployed.tokenB).balanceOf(address(deployed.manager)) != n.abB + n.bcB) {
            _fail("token-b-backing");
        }
        if (IERC20(deployed.tokenC).balanceOf(address(deployed.manager)) != n.bcC + n.acC) {
            _fail("token-c-backing");
        }

        deployed.coordinator.quote();
        _runtimeSize(address(deployed.coordinator), "coordinator-size");
        _runtimeSize(address(deployed.hookAB), "hook-size");
        _runtimeSize(address(deployed.router), "router-size");
    }

    function _verifyHook(
        Addresses memory deployed,
        ArbFoldHook hook,
        address expected0,
        address expected1,
        bytes32 check
    ) private view {
        if (
            hook.coordinator() != address(deployed.coordinator)
                || address(hook.poolManager()) != address(deployed.manager)
        ) {
            _fail(check);
        }
        PoolKey memory key = hook.poolKey();
        if (
            Currency.unwrap(key.currency0) != expected0 || Currency.unwrap(key.currency1) != expected1
                || address(key.hooks) != address(hook) || key.fee != DYNAMIC_FEE || key.tickSpacing != TICK_SPACING
        ) _fail(check);
        Hooks.validateHookPermissions(hook, hook.getHookPermissions());
        if (!deployed.manager.isOperator(address(hook), address(deployed.coordinator))) _fail(check);
        if (!deployed.coordinator.isHook(address(hook))) _fail(check);
    }

    function _hasCode(address target, bytes32 check) private view {
        if (target == address(0) || target.code.length == 0) _fail(check);
    }

    function _runtimeSize(address target, bytes32 check) private view {
        if (target.code.length > EIP170_RUNTIME_LIMIT) _fail(check);
    }

    function _fail(bytes32 check) private pure {
        revert InvalidDeployment(check);
    }
}
