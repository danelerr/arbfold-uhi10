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

    struct Environment {
        IPoolManager manager;
        CleanCoreReferenceCoordinator coordinator;
        ArbFoldHook hookAB;
        ArbFoldHook hookBC;
        ArbFoldHook hookAC;
        ArbFoldRouter directRouter;
        CleanCoreAtomicBackrunRouter backrunRouter;
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
