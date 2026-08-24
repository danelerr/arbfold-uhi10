// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {ArbFoldCoordinator} from "../src/ArbFoldCoordinator.sol";
import {ArbFoldHook} from "../src/ArbFoldHook.sol";
import {ArbFoldRouter} from "../src/ArbFoldRouter.sol";
import {CycleMath} from "../src/CycleMath.sol";
import {DemoToken} from "../src/DemoToken.sol";

/// @notice Executes and checks one canonical public-demo swap against a deployed ARBFOLD network.
contract RunArbFoldDemo is Script {
    using CurrencyLibrary for Currency;

    error InvalidDemoConfiguration();
    error DemoInvariantFailed(bytes32 check);

    struct DemoConfig {
        uint256 privateKey;
        address user;
        ArbFoldRouter router;
        ArbFoldCoordinator coordinator;
        ArbFoldHook hook;
        address solver;
        bool zeroForOne;
        uint256 amountIn;
        uint256 minAmountOut;
    }

    struct DemoResult {
        CycleMath.Network beforeNetwork;
        CycleMath.Network afterNetwork;
        uint256 amountOut;
        uint256 solverReward;
        uint256 foldRounds;
        uint256 residualProfit;
    }

    function run() external returns (uint256 amountOut) {
        DemoConfig memory config;
        config.privateKey = vm.envUint("PRIVATE_KEY");
        config.user = vm.addr(config.privateKey);
        config.router = ArbFoldRouter(vm.envAddress("ROUTER"));
        config.coordinator = ArbFoldCoordinator(vm.envAddress("COORDINATOR"));
        config.hook = ArbFoldHook(vm.envAddress("ORIGIN_HOOK"));
        config.solver = vm.envOr("SOLVER", config.user);
        config.zeroForOne = vm.envOr("ZERO_FOR_ONE", false);
        config.amountIn = vm.envOr("AMOUNT_IN", uint256(100_000 ether));
        config.minAmountOut = vm.envOr("MIN_AMOUNT_OUT", uint256(0));

        if (
            config.amountIn == 0 || config.amountIn > uint256(type(int256).max) || config.solver == address(0)
                || !config.coordinator.isHook(address(config.hook))
                || address(config.router.coordinator()) != address(config.coordinator)
        ) revert InvalidDemoConfiguration();

        amountOut = _execute(config);
    }

    function _execute(DemoConfig memory config) private returns (uint256 amountOut) {
        PoolKey memory key = config.hook.poolKey();
        Currency input = config.zeroForOne ? key.currency0 : key.currency1;
        DemoResult memory result;
        result.beforeNetwork = config.coordinator.network();
        uint256 beforeSolverClaim = _solverClaim(config);
        uint256 beforeRounds = config.coordinator.totalFoldRounds();

        vm.startBroadcast(config.privateKey);
        DemoToken(Currency.unwrap(input)).mint(config.user, config.amountIn);
        DemoToken(Currency.unwrap(input)).approve(address(config.router), config.amountIn);
        amountOut = config.router
            .swapExactInput(
                config.hook,
                config.zeroForOne,
                config.amountIn,
                config.minAmountOut,
                config.solver,
                block.timestamp + 10 minutes
            );
        vm.stopBroadcast();

        result.amountOut = amountOut;
        result.afterNetwork = config.coordinator.network();
        uint256 afterSolverClaim = _solverClaim(config);
        uint256 afterRounds = config.coordinator.totalFoldRounds();
        if (afterRounds <= beforeRounds) revert DemoInvariantFailed("no-fold-round");
        if (afterSolverClaim <= beforeSolverClaim) revert DemoInvariantFailed("no-solver-reward");
        result.solverReward = afterSolverClaim - beforeSolverClaim;
        result.foldRounds = afterRounds - beforeRounds;
        result.residualProfit = config.coordinator.lastResidualProfit();
        _assertNonDecreasing(result.beforeNetwork, result.afterNetwork);
        if (result.residualProfit > config.coordinator.RESIDUAL_THRESHOLD()) {
            revert DemoInvariantFailed("residual-profit");
        }

        _logResult(config, result);
        _writeEvidenceIfRequested(config, result);
    }

    function _logResult(DemoConfig memory config, DemoResult memory result) private view {
        console2.log("ARBFOLD demo user", config.user);
        console2.log("ARBFOLD demo origin hook", address(config.hook));
        console2.log("ARBFOLD demo zeroForOne", config.zeroForOne);
        console2.log("ARBFOLD demo amount in", config.amountIn);
        console2.log("ARBFOLD demo amount out", result.amountOut);
        console2.log("ARBFOLD demo solver", config.solver);
        console2.log("ARBFOLD demo solver reward", result.solverReward);
        console2.log("ARBFOLD demo fold rounds", result.foldRounds);
        console2.log("ARBFOLD demo residual", result.residualProfit);
        console2.log("ARBFOLD demo final AB A", result.afterNetwork.abA);
        console2.log("ARBFOLD demo final AB B", result.afterNetwork.abB);
        console2.log("ARBFOLD demo final BC B", result.afterNetwork.bcB);
        console2.log("ARBFOLD demo final BC C", result.afterNetwork.bcC);
        console2.log("ARBFOLD demo final AC A", result.afterNetwork.acA);
        console2.log("ARBFOLD demo final AC C", result.afterNetwork.acC);
        console2.log("The canonical swap is the final broadcast transaction in run-latest.json");
    }

    function _writeEvidenceIfRequested(DemoConfig memory config, DemoResult memory result) private {
        if (vm.envOr("WRITE_DEMO_EVIDENCE", false)) {
            string memory path = vm.envOr("DEMO_EVIDENCE_PATH", string(""));
            if (bytes(path).length == 0) revert InvalidDemoConfiguration();
            _writeEvidence(path, config, result);
        }
    }

    function _solverClaim(DemoConfig memory config) private view returns (uint256) {
        return
            IPoolManager(address(config.router.manager())).balanceOf(config.solver, config.coordinator.tokenA().toId());
    }

    function _assertNonDecreasing(CycleMath.Network memory beforeN, CycleMath.Network memory afterN) private pure {
        if (afterN.abA * afterN.abB < beforeN.abA * beforeN.abB) revert DemoInvariantFailed("ab-invariant");
        if (afterN.bcB * afterN.bcC < beforeN.bcB * beforeN.bcC) revert DemoInvariantFailed("bc-invariant");
        if (afterN.acA * afterN.acC < beforeN.acA * beforeN.acC) revert DemoInvariantFailed("ac-invariant");
    }

    function _writeEvidence(string memory path, DemoConfig memory config, DemoResult memory result) private {
        string memory root = "arbfold-demo";
        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeAddress(root, "user", config.user);
        vm.serializeAddress(root, "originHook", address(config.hook));
        vm.serializeBool(root, "zeroForOne", config.zeroForOne);
        vm.serializeString(root, "amountIn", vm.toString(config.amountIn));
        vm.serializeString(root, "amountOut", vm.toString(result.amountOut));
        vm.serializeAddress(root, "solver", config.solver);
        vm.serializeString(root, "solverReward", vm.toString(result.solverReward));
        vm.serializeUint(root, "foldRounds", result.foldRounds);
        vm.serializeString(root, "residualProfit", vm.toString(result.residualProfit));
        vm.serializeString(root, "preAbA", vm.toString(result.beforeNetwork.abA));
        vm.serializeString(root, "preAbB", vm.toString(result.beforeNetwork.abB));
        vm.serializeString(root, "preBcB", vm.toString(result.beforeNetwork.bcB));
        vm.serializeString(root, "preBcC", vm.toString(result.beforeNetwork.bcC));
        vm.serializeString(root, "preAcA", vm.toString(result.beforeNetwork.acA));
        vm.serializeString(root, "preAcC", vm.toString(result.beforeNetwork.acC));
        vm.serializeString(root, "postAbA", vm.toString(result.afterNetwork.abA));
        vm.serializeString(root, "postAbB", vm.toString(result.afterNetwork.abB));
        vm.serializeString(root, "postBcB", vm.toString(result.afterNetwork.bcB));
        vm.serializeString(root, "postBcC", vm.toString(result.afterNetwork.bcC));
        vm.serializeString(root, "postAcA", vm.toString(result.afterNetwork.acA));
        string memory json = vm.serializeString(root, "postAcC", vm.toString(result.afterNetwork.acC));
        vm.writeJson(json, path);
        console2.log("ARBFOLD demo evidence path", path);
    }
}
