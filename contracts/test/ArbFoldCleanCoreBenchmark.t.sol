// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BaseCustomAccounting} from "@openzeppelin/uniswap-hooks/base/BaseCustomAccounting.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {ArbFoldHook} from "../src/ArbFoldHook.sol";
import {ArbFoldHookDeployer} from "../src/ArbFoldHookDeployer.sol";
import {ArbFoldRouter} from "../src/ArbFoldRouter.sol";
import {CycleMath} from "../src/CycleMath.sol";
import {DemoToken} from "../src/DemoToken.sol";
import {IArbFoldHook, IArbFoldCoordinator} from "../src/IArbFold.sol";
import {CleanCoreAtomicBackrunRouter, CleanCoreReferenceCoordinator} from "./CleanCoreBenchmarkHarnesses.sol";

contract ArbFoldCleanCoreBenchmarkTest is Test {
    using CurrencyLibrary for Currency;

    uint160 private constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint24 private constant DYNAMIC_FEE = LPFeeLibrary.DYNAMIC_FEE_FLAG;
    int24 private constant TICK_SPACING = 60;
    uint256 private constant A_RESERVE = 333_333333333333333333;
    uint256 private constant QUOTE_RESERVE = 1_000_000 ether;
    int24 private constant MIN_TICK = -887220;
    int24 private constant MAX_TICK = 887220;
    uint256 private constant INTRINSIC_GAS = 21_000;
    bytes32 private constant TELEMETRY_SLOT = bytes32(uint256(3));

    struct Environment {
        IPoolManager manager;
        CleanCoreReferenceCoordinator coordinator;
        ArbFoldHook hookAB;
        ArbFoldHook hookBC;
        ArbFoldHook hookAC;
        ArbFoldRouter directRouter;
        CleanCoreAtomicBackrunRouter backrunRouter;
    }

    struct ScenarioResult {
        uint256 input;
        uint256 referenceRounds;
        uint256 directRounds;
        uint256 referenceExecutionGas;
        uint256 directExecutionGas;
        uint256 referenceCalldataGas;
        uint256 directCalldataGas;
        uint256 referenceUserOutput;
        uint256 directUserOutput;
        uint256 referenceRecipientReward;
        uint256 directRecipientReward;
        uint256 referenceResidual;
        uint256 directResidual;
        CycleMath.Network referenceFinal;
        CycleMath.Network directFinal;
    }

    DemoToken private tokenAContract;
    DemoToken private tokenBContract;
    DemoToken private tokenCContract;
    Currency private tokenA;
    Currency private tokenB;
    Currency private tokenC;
    address private solver;
    Environment private env;

    function setUp() public {
        solver = makeAddr("clean-core-solver");
        _deploySortedTokens();
        tokenAContract.mint(address(this), 20_000_000 ether);
        tokenBContract.mint(address(this), 40_000_000 ether);
        tokenCContract.mint(address(this), 40_000_000 ether);
        env = _deployEnvironment();
    }

    function test_CleanCoreGridMechanicalEquivalence() public {
        uint256[5] memory sizes = _sizes();
        uint256 snapshot = vm.snapshotState();
        for (uint256 i = 0; i < sizes.length; ++i) {
            _assertScenario(sizes[i]);
            assertTrue(vm.revertToState(snapshot));
        }
    }

    function test_ReportCleanCoreGasGrid() public {
        uint256[5] memory sizes = _sizes();
        uint256 snapshot = vm.snapshotState();
        for (uint256 i = 0; i < sizes.length; ++i) {
            uint256 size = sizes[i];
            bytes memory backrunCalldata = abi.encodeCall(
                CleanCoreAtomicBackrunRouter.swapExactInput, (env.hookAB, false, size, 0, solver, block.timestamp)
            );
            _cool(env, address(env.backrunRouter));
            uint256 start = gasleft();
            env.backrunRouter.swapExactInput(env.hookAB, false, size, 0, solver, block.timestamp);
            uint256 backrunExecution = start - gasleft();
            assertTrue(vm.revertToState(snapshot));

            bytes memory directCalldata =
                abi.encodeCall(ArbFoldRouter.swapExactInput, (env.hookAB, false, size, 0, solver, block.timestamp));
            _cool(env, address(env.directRouter));
            start = gasleft();
            env.directRouter.swapExactInput(env.hookAB, false, size, 0, solver, block.timestamp);
            uint256 directExecution = start - gasleft();
            assertTrue(vm.revertToState(snapshot));

            uint256 backrunTotal = INTRINSIC_GAS + _calldataGas(backrunCalldata) + backrunExecution;
            uint256 directTotal = INTRINSIC_GAS + _calldataGas(directCalldata) + directExecution;
            console2.log("CLEAN_CORE_SIZE", size);
            console2.log("CLEAN_CORE_BACKRUN_TOTAL", backrunTotal);
            console2.log("CLEAN_CORE_DIRECT_TOTAL", directTotal);
            console2.log("CLEAN_CORE_GAS_RATIO_BPS", directTotal * 10_000 / backrunTotal);
        }
    }

    function test_ReportCleanCoreCanonicalState() public {
        uint256 size = 100_000 ether;
        uint256 snapshot = vm.snapshotState();

        uint256 backrunOutput = env.backrunRouter.swapExactInput(env.hookAB, false, size, 0, solver, block.timestamp);
        uint256 backrunReward = env.manager.balanceOf(solver, tokenA.toId());
        CycleMath.Network memory backrunFinal = env.coordinator.network();
        assertTrue(vm.revertToState(snapshot));

        uint256 directOutput = env.directRouter.swapExactInput(env.hookAB, false, size, 0, solver, block.timestamp);
        uint256 directReward = env.manager.balanceOf(solver, tokenA.toId());
        CycleMath.Network memory directFinal = env.coordinator.network();

        assertEq(directOutput, backrunOutput, "canonical output mismatch");
        assertEq(directReward, backrunReward, "canonical reward mismatch");
        _assertNetworkApproxEq(directFinal, backrunFinal, 1);

        console2.log("CLEAN_CORE_CANONICAL_USER_OUTPUT_A", directOutput);
        console2.log("CLEAN_CORE_CANONICAL_SOLVER_REWARD_A", directReward);
        console2.log("CLEAN_CORE_CANONICAL_AB_A", directFinal.abA);
        console2.log("CLEAN_CORE_CANONICAL_AB_B", directFinal.abB);
        console2.log("CLEAN_CORE_CANONICAL_BC_B", directFinal.bcB);
        console2.log("CLEAN_CORE_CANONICAL_BC_C", directFinal.bcC);
        console2.log("CLEAN_CORE_CANONICAL_AC_A", directFinal.acA);
        console2.log("CLEAN_CORE_CANONICAL_AC_C", directFinal.acC);
        console2.log("CLEAN_CORE_CANONICAL_RESIDUAL_A", env.coordinator.lastResidualProfit());
    }

    function test_ReportV01FrozenGrid() public {
        uint256[5] memory sizes = _sizes();
        for (uint256 i; i < sizes.length; ++i) {
            _logScenario("grid", 1, _measureScenario(env.hookAB, false, sizes[i]));
        }
    }

    function test_ReportV01DenseSweep() public {
        uint256 snapshot = vm.snapshotState();
        for (uint256 size = 1_000 ether; size <= 200_000 ether; size += 1_000 ether) {
            bytes memory referenceCalldata = abi.encodeCall(
                CleanCoreAtomicBackrunRouter.swapExactInput, (env.hookAB, false, size, 0, solver, block.timestamp)
            );
            _cool(env, address(env.backrunRouter));
            uint256 start = gasleft();
            env.backrunRouter.swapExactInput(env.hookAB, false, size, 0, solver, block.timestamp);
            uint256 referenceExecution = start - gasleft();
            assertTrue(vm.revertToState(snapshot));

            bytes memory directCalldata =
                abi.encodeCall(ArbFoldRouter.swapExactInput, (env.hookAB, false, size, 0, solver, block.timestamp));
            _cool(env, address(env.directRouter));
            start = gasleft();
            env.directRouter.swapExactInput(env.hookAB, false, size, 0, solver, block.timestamp);
            uint256 directExecution = start - gasleft();
            uint256 rounds = env.coordinator.totalFoldRounds();
            assertTrue(vm.revertToState(snapshot));

            console2.log("V01_SWEEP_INPUT", size);
            console2.log(
                "V01_SWEEP_REFERENCE_TOTAL", INTRINSIC_GAS + _calldataGas(referenceCalldata) + referenceExecution
            );
            console2.log("V01_SWEEP_DIRECT_TOTAL", INTRINSIC_GAS + _calldataGas(directCalldata) + directExecution);
            console2.log("V01_SWEEP_ROUNDS", rounds);
        }
    }

    function test_ReportV01SixPathMatrix() public {
        for (uint8 path; path < 6; ++path) {
            (ArbFoldHook origin, bool zeroForOne) = _path(path);
            uint256 amountIn = path == 0 || path == 4 ? 2 ether : 5_000 ether;
            _logScenario("path", path, _measureScenario(origin, zeroForOne, amountIn));
        }
    }

    function _assertScenario(uint256 size) private {
        CycleMath.Network memory initial = env.coordinator.network();
        uint256 expectedOutput = CycleMath.swapOut(size, initial.abB, initial.abA);
        CycleMath.Network memory postUser = initial;
        postUser.abB += size;
        postUser.abA -= expectedOutput;
        uint256 snapshot = vm.snapshotState();

        uint256 backrunOutput =
            env.backrunRouter.swapExactInput(env.hookAB, false, size, expectedOutput, solver, block.timestamp);
        assertEq(backrunOutput, expectedOutput, "backrun changed user output");
        CycleMath.Network memory backrunFinal = env.coordinator.network();
        uint256 backrunReward = env.manager.balanceOf(solver, tokenA.toId());
        _assertClaimsMatchReserves(env);
        _assertBacking(env);
        _assertNonDecreasing(postUser, backrunFinal);
        assertLe(CycleMath.best(backrunFinal).profitA, 1e12, "material backrun residual");
        assertTrue(vm.revertToState(snapshot));

        uint256 directOutput =
            env.directRouter.swapExactInput(env.hookAB, false, size, expectedOutput, solver, block.timestamp);
        assertEq(directOutput, expectedOutput, "direct fold changed user output");
        CycleMath.Network memory directFinal = env.coordinator.network();
        uint256 directReward = env.manager.balanceOf(solver, tokenA.toId());
        _assertNetworkApproxEq(backrunFinal, directFinal, 1);
        _assertClaimsMatchReserves(env);
        _assertBacking(env);
        _assertNonDecreasing(postUser, directFinal);
        assertEq(backrunReward, directReward, "solver reward mismatch");
        assertLe(CycleMath.best(directFinal).profitA, 1e12, "material direct residual");
    }

    function _measureScenario(ArbFoldHook origin, bool zeroForOne, uint256 size)
        private
        returns (ScenarioResult memory result)
    {
        result.input = size;
        uint256 snapshot = vm.snapshotState();

        bytes memory referenceCalldata = abi.encodeCall(
            CleanCoreAtomicBackrunRouter.swapExactInput, (origin, zeroForOne, size, 0, solver, block.timestamp)
        );
        result.referenceCalldataGas = _calldataGas(referenceCalldata);
        _cool(env, address(env.backrunRouter));
        uint256 start = gasleft();
        result.referenceUserOutput =
            env.backrunRouter.swapExactInput(origin, zeroForOne, size, 0, solver, block.timestamp);
        result.referenceExecutionGas = start - gasleft();
        result.referenceFinal = env.coordinator.network();
        result.referenceRecipientReward = env.manager.balanceOf(solver, tokenA.toId());
        result.referenceResidual = CycleMath.best(result.referenceFinal).profitA;
        _assertClaimsMatchReserves(env);
        _assertBacking(env);
        assertTrue(vm.revertToState(snapshot));

        bytes memory directCalldata =
            abi.encodeCall(ArbFoldRouter.swapExactInput, (origin, zeroForOne, size, 0, solver, block.timestamp));
        result.directCalldataGas = _calldataGas(directCalldata);
        _cool(env, address(env.directRouter));
        start = gasleft();
        result.directUserOutput = env.directRouter.swapExactInput(origin, zeroForOne, size, 0, solver, block.timestamp);
        result.directExecutionGas = start - gasleft();
        result.directRounds = env.coordinator.totalFoldRounds();
        result.directFinal = env.coordinator.network();
        result.directResidual = env.coordinator.lastResidualProfit();
        result.directRecipientReward = env.manager.balanceOf(solver, tokenA.toId());

        assertEq(result.directUserOutput, result.referenceUserOutput, "direct user output mismatch");
        assertEq(result.directRecipientReward, result.referenceRecipientReward, "recipient reward mismatch");
        _assertNetworkApproxEq(result.referenceFinal, result.directFinal, 1);
        _assertClaimsMatchReserves(env);
        _assertBacking(env);
        assertTrue(vm.revertToState(snapshot));

        CycleMath.Network memory initial = env.coordinator.network();
        (uint256 expectedOutput, CycleMath.Network memory postUser) = _postUser(initial, origin, zeroForOne, size);
        (result.referenceRounds,) = _simulateRounds(postUser);
        assertEq(result.directUserOutput, expectedOutput, "modeled user output mismatch");
        assertEq(result.referenceUserOutput, expectedOutput, "reference modeled user output mismatch");
        assertEq(result.directRounds, result.referenceRounds, "round count mismatch");
        assertTrue(vm.revertToState(snapshot));
    }

    function _postUser(CycleMath.Network memory initial, ArbFoldHook origin, bool zeroForOne, uint256 amountIn)
        private
        view
        returns (uint256 amountOut, CycleMath.Network memory postUser)
    {
        postUser = CycleMath.Network({
            abA: initial.abA, abB: initial.abB, bcB: initial.bcB, bcC: initial.bcC, acA: initial.acA, acC: initial.acC
        });
        if (origin == env.hookAB) {
            if (zeroForOne) {
                amountOut = CycleMath.swapOut(amountIn, initial.abA, initial.abB);
                postUser.abA += amountIn;
                postUser.abB -= amountOut;
            } else {
                amountOut = CycleMath.swapOut(amountIn, initial.abB, initial.abA);
                postUser.abB += amountIn;
                postUser.abA -= amountOut;
            }
        } else if (origin == env.hookBC) {
            if (zeroForOne) {
                amountOut = CycleMath.swapOut(amountIn, initial.bcB, initial.bcC);
                postUser.bcB += amountIn;
                postUser.bcC -= amountOut;
            } else {
                amountOut = CycleMath.swapOut(amountIn, initial.bcC, initial.bcB);
                postUser.bcC += amountIn;
                postUser.bcB -= amountOut;
            }
        } else if (zeroForOne) {
            amountOut = CycleMath.swapOut(amountIn, initial.acA, initial.acC);
            postUser.acA += amountIn;
            postUser.acC -= amountOut;
        } else {
            amountOut = CycleMath.swapOut(amountIn, initial.acC, initial.acA);
            postUser.acC += amountIn;
            postUser.acA -= amountOut;
        }
    }

    function _simulateRounds(CycleMath.Network memory current) private view returns (uint256 rounds, uint256 rewards) {
        for (; rounds < env.coordinator.MAX_ROUNDS(); ++rounds) {
            CycleMath.Quote memory q = CycleMath.best(current);
            if (q.profitA <= env.coordinator.RESIDUAL_THRESHOLD()) break;
            uint256 reward = q.profitA * env.coordinator.SOLVER_SHARE_BPS() / env.coordinator.BPS();
            current = _applyExpected(current, q, reward);
            rewards += reward;
        }
    }

    function _applyExpected(CycleMath.Network memory n, CycleMath.Quote memory q, uint256 reward)
        private
        pure
        returns (CycleMath.Network memory afterState)
    {
        afterState = CycleMath.Network({abA: n.abA, abB: n.abB, bcB: n.bcB, bcC: n.bcC, acA: n.acA, acC: n.acC});
        if (!q.reverse) {
            afterState.abA += q.amountAIn;
            afterState.abB -= q.intermediateFirst;
            afterState.bcB += q.intermediateFirst;
            afterState.bcC -= q.intermediateSecond;
            afterState.acC += q.intermediateSecond;
            afterState.acA -= q.amountAIn + reward;
        } else {
            afterState.acA += q.amountAIn;
            afterState.acC -= q.intermediateFirst;
            afterState.bcC += q.intermediateFirst;
            afterState.bcB -= q.intermediateSecond;
            afterState.abB += q.intermediateSecond;
            afterState.abA -= q.amountAIn + reward;
        }
    }

    function _logScenario(string memory kind, uint256 path, ScenarioResult memory result) private view {
        uint256 referenceTotal = INTRINSIC_GAS + result.referenceCalldataGas + result.referenceExecutionGas;
        uint256 directTotal = INTRINSIC_GAS + result.directCalldataGas + result.directExecutionGas;
        uint256 tolerance = _networkTolerance(result.referenceFinal, result.directFinal);
        console2.log("V01_ROW_KIND", kind);
        console2.log("V01_PATH", path);
        console2.log("V01_INPUT", result.input);
        console2.log("V01_REFERENCE_ROUNDS", result.referenceRounds);
        console2.log("V01_DIRECT_ROUNDS", result.directRounds);
        console2.log("V01_REFERENCE_ARBITRAGE_SWAPS", result.referenceRounds * 3);
        console2.log("V01_REFERENCE_REINJECTIONS", result.referenceRounds);
        console2.log("V01_DIRECT_FOLD_CALLS", uint256(1));
        console2.log("V01_REFERENCE_EXECUTION_GAS", result.referenceExecutionGas);
        console2.log("V01_DIRECT_EXECUTION_GAS", result.directExecutionGas);
        console2.log("V01_REFERENCE_CALLDATA_GAS", result.referenceCalldataGas);
        console2.log("V01_DIRECT_CALLDATA_GAS", result.directCalldataGas);
        console2.log("V01_REFERENCE_TOTAL_GAS", referenceTotal);
        console2.log("V01_DIRECT_TOTAL_GAS", directTotal);
        console2.log("V01_ABSOLUTE_GAS_SAVED", int256(referenceTotal) - int256(directTotal));
        console2.log("V01_DIRECT_TO_REFERENCE_BPS", directTotal * 10_000 / referenceTotal);
        console2.log("V01_REFERENCE_USER_OUTPUT", result.referenceUserOutput);
        console2.log("V01_DIRECT_USER_OUTPUT", result.directUserOutput);
        console2.log("V01_REFERENCE_EXTERNAL_RECIPIENT_REWARD", result.referenceRecipientReward);
        console2.log("V01_DIRECT_EXTERNAL_RECIPIENT_REWARD", result.directRecipientReward);
        console2.log("V01_REFERENCE_RESIDUAL", result.referenceResidual);
        console2.log("V01_DIRECT_RESIDUAL", result.directResidual);
        console2.log("V01_REFERENCE_AB_A", result.referenceFinal.abA);
        console2.log("V01_REFERENCE_AB_B", result.referenceFinal.abB);
        console2.log("V01_REFERENCE_BC_B", result.referenceFinal.bcB);
        console2.log("V01_REFERENCE_BC_C", result.referenceFinal.bcC);
        console2.log("V01_REFERENCE_AC_A", result.referenceFinal.acA);
        console2.log("V01_REFERENCE_AC_C", result.referenceFinal.acC);
        console2.log("V01_DIRECT_AB_A", result.directFinal.abA);
        console2.log("V01_DIRECT_AB_B", result.directFinal.abB);
        console2.log("V01_DIRECT_BC_B", result.directFinal.bcB);
        console2.log("V01_DIRECT_BC_C", result.directFinal.bcC);
        console2.log("V01_DIRECT_AC_A", result.directFinal.acA);
        console2.log("V01_DIRECT_AC_C", result.directFinal.acC);
        console2.log("V01_EQUIVALENCE_TOLERANCE", tolerance);
        console2.log("V01_ROW_END", uint256(1));
    }

    function _networkTolerance(CycleMath.Network memory a, CycleMath.Network memory b)
        private
        pure
        returns (uint256 maximum)
    {
        maximum = _max(maximum, _absDiff(a.abA, b.abA));
        maximum = _max(maximum, _absDiff(a.abB, b.abB));
        maximum = _max(maximum, _absDiff(a.bcB, b.bcB));
        maximum = _max(maximum, _absDiff(a.bcC, b.bcC));
        maximum = _max(maximum, _absDiff(a.acA, b.acA));
        maximum = _max(maximum, _absDiff(a.acC, b.acC));
    }

    function _path(uint8 path) private view returns (ArbFoldHook hook, bool zeroForOne) {
        if (path == 0) return (env.hookAB, true);
        if (path == 1) return (env.hookAB, false);
        if (path == 2) return (env.hookBC, true);
        if (path == 3) return (env.hookBC, false);
        if (path == 4) return (env.hookAC, true);
        return (env.hookAC, false);
    }

    function _max(uint256 a, uint256 b) private pure returns (uint256) {
        return a > b ? a : b;
    }

    function _absDiff(uint256 a, uint256 b) private pure returns (uint256) {
        return a > b ? a - b : b - a;
    }

    function _deployEnvironment() private returns (Environment memory deployed) {
        deployed.manager = IPoolManager(address(new PoolManager(address(this))));
        deployed.coordinator = new CleanCoreReferenceCoordinator(deployed.manager, tokenA, tokenB, tokenC);
        ArbFoldHookDeployer deployer = new ArbFoldHookDeployer();
        deployed.hookAB = _mineAndDeploy(deployed.manager, deployed.coordinator, deployer);
        deployed.hookBC = _mineAndDeploy(deployed.manager, deployed.coordinator, deployer);
        deployed.hookAC = _mineAndDeploy(deployed.manager, deployed.coordinator, deployer);

        _initialize(deployed, deployed.hookAB, tokenA, tokenB, A_RESERVE, QUOTE_RESERVE);
        _initialize(deployed, deployed.hookBC, tokenB, tokenC, QUOTE_RESERVE, QUOTE_RESERVE);
        _initialize(deployed, deployed.hookAC, tokenA, tokenC, A_RESERVE, QUOTE_RESERVE);
        deployed.coordinator
            .configureHooks(
                IArbFoldHook(address(deployed.hookAB)),
                IArbFoldHook(address(deployed.hookBC)),
                IArbFoldHook(address(deployed.hookAC))
            );

        deployed.directRouter = new ArbFoldRouter(deployed.manager, IArbFoldCoordinator(address(deployed.coordinator)));
        deployed.backrunRouter = new CleanCoreAtomicBackrunRouter(deployed.manager, deployed.coordinator);
        deployed.coordinator.setReferenceExecutor(address(deployed.backrunRouter));
        tokenAContract.approve(address(deployed.directRouter), type(uint256).max);
        tokenBContract.approve(address(deployed.directRouter), type(uint256).max);
        tokenCContract.approve(address(deployed.directRouter), type(uint256).max);
        tokenAContract.approve(address(deployed.backrunRouter), type(uint256).max);
        tokenBContract.approve(address(deployed.backrunRouter), type(uint256).max);
        tokenCContract.approve(address(deployed.backrunRouter), type(uint256).max);
    }

    function _mineAndDeploy(
        IPoolManager manager,
        CleanCoreReferenceCoordinator coordinator,
        ArbFoldHookDeployer deployer
    ) private returns (ArbFoldHook hook) {
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        bytes memory constructorArgs = abi.encode(manager, address(coordinator));
        // Hook-address mining is performed offchain and excluded from both
        // benchmark paths. Keep its variable CREATE2 search cost out of setup.
        vm.pauseGasMetering();
        (address expected, bytes32 salt) =
            HookMiner.find(address(deployer), flags, type(ArbFoldHook).creationCode, constructorArgs);
        vm.resumeGasMetering();
        hook = deployer.deploy(manager, address(coordinator), salt);
        assertEq(address(hook), expected, "mined hook address mismatch");
        Hooks.validateHookPermissions(hook, hook.getHookPermissions());
    }

    function _initialize(
        Environment memory deployed,
        ArbFoldHook hook,
        Currency currency0,
        Currency currency1,
        uint256 reserve0,
        uint256 reserve1
    ) private {
        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: DYNAMIC_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(hook))
        });
        deployed.manager.initialize(key, SQRT_PRICE_1_1);
        DemoToken(Currency.unwrap(currency0)).approve(address(hook), type(uint256).max);
        DemoToken(Currency.unwrap(currency1)).approve(address(hook), type(uint256).max);
        hook.addLiquidity(
            BaseCustomAccounting.AddLiquidityParams({
                amount0Desired: reserve0,
                amount1Desired: reserve1,
                amount0Min: reserve0,
                amount1Min: reserve1,
                deadline: type(uint256).max,
                tickLower: MIN_TICK,
                tickUpper: MAX_TICK,
                userInputSalt: bytes32(0)
            })
        );
        hook.authorizeCoordinator();
    }

    function _deploySortedTokens() private {
        DemoToken x = new DemoToken("Token X", "X");
        DemoToken y = new DemoToken("Token Y", "Y");
        DemoToken z = new DemoToken("Token Z", "Z");
        address[3] memory values = [address(x), address(y), address(z)];
        if (values[0] > values[1]) (values[0], values[1]) = (values[1], values[0]);
        if (values[1] > values[2]) (values[1], values[2]) = (values[2], values[1]);
        if (values[0] > values[1]) (values[0], values[1]) = (values[1], values[0]);
        tokenAContract = DemoToken(values[0]);
        tokenBContract = DemoToken(values[1]);
        tokenCContract = DemoToken(values[2]);
        tokenA = Currency.wrap(values[0]);
        tokenB = Currency.wrap(values[1]);
        tokenC = Currency.wrap(values[2]);
    }

    function _assertClaimsMatchReserves(Environment memory deployed) private view {
        CycleMath.Network memory n = deployed.coordinator.network();
        assertEq(deployed.manager.balanceOf(address(deployed.hookAB), tokenA.toId()), n.abA, "AB A claim drift");
        assertEq(deployed.manager.balanceOf(address(deployed.hookAB), tokenB.toId()), n.abB, "AB B claim drift");
        assertEq(deployed.manager.balanceOf(address(deployed.hookBC), tokenB.toId()), n.bcB, "BC B claim drift");
        assertEq(deployed.manager.balanceOf(address(deployed.hookBC), tokenC.toId()), n.bcC, "BC C claim drift");
        assertEq(deployed.manager.balanceOf(address(deployed.hookAC), tokenA.toId()), n.acA, "AC A claim drift");
        assertEq(deployed.manager.balanceOf(address(deployed.hookAC), tokenC.toId()), n.acC, "AC C claim drift");
    }

    function _assertBacking(Environment memory deployed) private view {
        CycleMath.Network memory n = deployed.coordinator.network();
        uint256 solverA = deployed.manager.balanceOf(solver, tokenA.toId());
        assertEq(tokenAContract.balanceOf(address(deployed.manager)), n.abA + n.acA + solverA, "A backing drift");
        assertEq(tokenBContract.balanceOf(address(deployed.manager)), n.abB + n.bcB, "B backing drift");
        assertEq(tokenCContract.balanceOf(address(deployed.manager)), n.bcC + n.acC, "C backing drift");
    }

    function _assertNetworkApproxEq(CycleMath.Network memory a, CycleMath.Network memory b, uint256 tolerance)
        private
        pure
    {
        assertApproxEqAbs(a.abA, b.abA, tolerance, "abA mismatch");
        assertApproxEqAbs(a.abB, b.abB, tolerance, "abB mismatch");
        assertApproxEqAbs(a.bcB, b.bcB, tolerance, "bcB mismatch");
        assertApproxEqAbs(a.bcC, b.bcC, tolerance, "bcC mismatch");
        assertApproxEqAbs(a.acA, b.acA, tolerance, "acA mismatch");
        assertApproxEqAbs(a.acC, b.acC, tolerance, "acC mismatch");
    }

    function _assertNonDecreasing(CycleMath.Network memory beforeN, CycleMath.Network memory afterN) private pure {
        assertGe(afterN.abA * afterN.abB, beforeN.abA * beforeN.abB, "AB invariant decreased");
        assertGe(afterN.bcB * afterN.bcC, beforeN.bcB * beforeN.bcC, "BC invariant decreased");
        assertGe(afterN.acA * afterN.acC, beforeN.acA * beforeN.acC, "AC invariant decreased");
    }

    function _cool(Environment memory deployed, address route) private {
        vm.cool(address(deployed.manager));
        vm.cool(address(deployed.coordinator));
        vm.coolSlot(address(deployed.coordinator), TELEMETRY_SLOT);
        vm.cool(address(deployed.hookAB));
        vm.cool(address(deployed.hookBC));
        vm.cool(address(deployed.hookAC));
        vm.cool(route);
        vm.cool(address(tokenAContract));
        vm.cool(address(tokenBContract));
        vm.cool(address(tokenCContract));
        vm.cool(address(this));
        vm.cool(solver);
    }

    function _calldataGas(bytes memory data) private pure returns (uint256 gasCost) {
        for (uint256 i = 0; i < data.length; ++i) {
            gasCost += data[i] == 0 ? 4 : 16;
        }
    }

    function _sizes() private pure returns (uint256[5] memory) {
        return [uint256(10_000 ether), 25_000 ether, 50_000 ether, 100_000 ether, 200_000 ether];
    }
}
