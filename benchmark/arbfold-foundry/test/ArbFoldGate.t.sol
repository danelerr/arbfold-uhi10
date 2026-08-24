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
import {BenchmarkToken} from "../src/BenchmarkToken.sol";
import {CycleMath} from "../src/CycleMath.sol";
import {CPMMHook} from "../src/CPMMHook.sol";
import {ICPMMHook} from "../src/ICPMMHook.sol";
import {ArbFoldCoordinator} from "../src/ArbFoldCoordinator.sol";
import {
    AtomicBackrunHarness,
    DirectFoldHarness,
    OriginOnlyHarness
} from "../src/BenchmarkHarnesses.sol";

contract ArbFoldGateTest is Test {
    using CurrencyLibrary for Currency;

    uint160 private constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint24 private constant DYNAMIC_FEE = LPFeeLibrary.DYNAMIC_FEE_FLAG;
    int24 private constant TICK_SPACING = 60;
    uint256 private constant WETH_RESERVE = 333_333333333333333333;
    uint256 private constant QUOTE_RESERVE = 1_000_000 ether;
    uint256 private constant MAX_DEADLINE = type(uint256).max;
    int24 private constant MIN_TICK = -887220;
    int24 private constant MAX_TICK = 887220;
    uint256 private constant INTRINSIC_GAS = 21_000;

    struct Environment {
        IPoolManager manager;
        ArbFoldCoordinator coordinator;
        CPMMHook hookAB;
        CPMMHook hookBC;
        CPMMHook hookAC;
        AtomicBackrunHarness backrun;
        DirectFoldHarness direct;
        OriginOnlyHarness origin;
    }

    BenchmarkToken private tokenAContract;
    BenchmarkToken private tokenBContract;
    BenchmarkToken private tokenCContract;
    Currency private tokenA;
    Currency private tokenB;
    Currency private tokenC;
    address private solver;

    Environment private backrunEnv;
    Environment private directEnv;
    Environment private originEnv;

    function setUp() public {
        solver = makeAddr("solver");
        _deploySortedTokens();

        tokenAContract.mint(address(this), 10_000_000 ether);
        tokenBContract.mint(address(this), 20_000_000 ether);
        tokenCContract.mint(address(this), 20_000_000 ether);

        backrunEnv = _deployEnvironment(1, 2, 3, 1);
        directEnv = _deployEnvironment(4, 5, 6, 2);
        originEnv = _deployEnvironment(7, 8, 9, 3);

        backrunEnv.backrun = new AtomicBackrunHarness(backrunEnv.manager, backrunEnv.coordinator);
        backrunEnv.coordinator.setBackrunHarness(address(backrunEnv.backrun));
        directEnv.direct = new DirectFoldHarness(directEnv.manager, directEnv.coordinator);
        originEnv.origin = new OriginOnlyHarness(originEnv.manager, originEnv.coordinator);

        tokenBContract.approve(address(backrunEnv.backrun), type(uint256).max);
        tokenBContract.approve(address(directEnv.direct), type(uint256).max);
        tokenBContract.approve(address(originEnv.origin), type(uint256).max);
    }

    function test_FrozenGrid_MechanicalEquivalence() public {
        uint256[5] memory sizes = _sizes();
        for (uint256 i = 0; i < sizes.length; ++i) {
            uint256 snapshot = vm.snapshotState();
            _assertScenario(sizes[i]);
            assertTrue(vm.revertToState(snapshot));
        }
    }

    function test_UnauthorizedDirectTransitionReverts() public {
        vm.expectRevert(ArbFoldCoordinator.NotHook.selector);
        directEnv.coordinator.fold(solver);
    }

    function test_ClosedFormIsLocallyMaximalOnFrozenState() public {
        originEnv.origin.execute(100_000 ether, solver);
        CycleMath.Network memory n = originEnv.coordinator.network();
        CycleMath.Quote memory q = CycleMath.best(n);
        assertGt(q.amountAIn, 0);

        uint256 lower = q.amountAIn * 9_999 / 10_000;
        uint256 upper = q.amountAIn * 10_001 / 10_000;
        uint256 optimumProfit = q.profitA;
        assertGe(optimumProfit, _forwardProfit(n, lower));
        assertGe(optimumProfit, _forwardProfit(n, upper));
    }

    function test_ReportFrozenGasGrid() public {
        uint256[5] memory sizes = _sizes();
        uint256 snapshot = vm.snapshotState();

        for (uint256 i = 0; i < sizes.length; ++i) {
            uint256 size = sizes[i];
            _cool(backrunEnv, address(backrunEnv.backrun));
            uint256 start = gasleft();
            backrunEnv.backrun.execute(size, solver);
            uint256 backrunExecution = start - gasleft();
            assertTrue(vm.revertToState(snapshot));

            _cool(directEnv, address(directEnv.direct));
            start = gasleft();
            directEnv.direct.execute(size, solver);
            uint256 directExecution = start - gasleft();
            assertTrue(vm.revertToState(snapshot));

            _cool(originEnv, address(originEnv.origin));
            start = gasleft();
            originEnv.origin.execute(size, solver);
            uint256 originExecution = start - gasleft();
            assertTrue(vm.revertToState(snapshot));

            uint256 calldataGas =
                _calldataGas(abi.encodeWithSelector(bytes4(keccak256("execute(uint256,address)")), size, solver));
            uint256 backrunTotal = INTRINSIC_GAS + calldataGas + backrunExecution;
            uint256 directTotal = INTRINSIC_GAS + calldataGas + directExecution;
            uint256 originTotal = INTRINSIC_GAS + calldataGas + originExecution;

            console2.log("ARBFOLD_RESULT_SIZE", size);
            console2.log("ARBFOLD_RESULT_BACKRUN_TOTAL", backrunTotal);
            console2.log("ARBFOLD_RESULT_DIRECT_TOTAL", directTotal);
            console2.log("ARBFOLD_RESULT_ORIGIN_TOTAL", originTotal);
            console2.log("ARBFOLD_RESULT_GAS_RATIO_BPS", directTotal * 10_000 / backrunTotal);
            console2.log("ARBFOLD_RESULT_BACKRUN_INCREMENTAL", backrunTotal - originTotal);
            console2.log("ARBFOLD_RESULT_DIRECT_INCREMENTAL", directTotal - originTotal);
        }
    }

    function test_ReportFrozenGrossSurplusGrid() public {
        uint256[5] memory sizes = _sizes();
        uint256 snapshot = vm.snapshotState();
        for (uint256 i = 0; i < sizes.length; ++i) {
            originEnv.origin.execute(sizes[i], solver);
            (uint256 gross, uint256 fixedReward, uint256 rounds, uint256 residual) =
                _previewTotals(originEnv.coordinator.network());
            console2.log("ARBFOLD_SURPLUS_SIZE", sizes[i]);
            console2.log("ARBFOLD_SURPLUS_GROSS_WEI", gross);
            console2.log("ARBFOLD_SURPLUS_FIXED_REWARD_WEI", fixedReward);
            console2.log("ARBFOLD_SURPLUS_ROUNDS", rounds);
            console2.log("ARBFOLD_SURPLUS_RESIDUAL_WEI", residual);
            assertTrue(vm.revertToState(snapshot));
        }
    }

    function _assertScenario(uint256 size) private {
        uint256 originOutput = originEnv.origin.execute(size, solver);
        CycleMath.Network memory postUser = originEnv.coordinator.network();

        uint256 backrunOutput = backrunEnv.backrun.execute(size, solver);
        uint256 directOutput = directEnv.direct.execute(size, solver);
        assertEq(backrunOutput, originOutput, "backrun changed user output");
        assertEq(directOutput, originOutput, "direct fold changed user output");

        CycleMath.Network memory backrunFinal = backrunEnv.coordinator.network();
        CycleMath.Network memory directFinal = directEnv.coordinator.network();
        _assertNetworkApproxEq(backrunFinal, directFinal, 1);
        _assertClaimsMatchReserves(backrunEnv);
        _assertClaimsMatchReserves(directEnv);
        _assertTokenBacking(backrunEnv);
        _assertTokenBacking(directEnv);
        _assertNonDecreasing(postUser, backrunFinal);
        _assertNonDecreasing(postUser, directFinal);

        assertEq(
            backrunEnv.manager.balanceOf(solver, tokenA.toId()),
            directEnv.manager.balanceOf(solver, tokenA.toId()),
            "solver reward mismatch"
        );

        CycleMath.Quote memory residualBackrun = CycleMath.best(backrunFinal);
        CycleMath.Quote memory residualDirect = CycleMath.best(directFinal);
        assertLe(residualBackrun.profitA, 1e12, "material backrun residual");
        assertLe(residualDirect.profitA, 1e12, "material direct residual");
    }

    function _deploySortedTokens() private {
        BenchmarkToken x = new BenchmarkToken();
        BenchmarkToken y = new BenchmarkToken();
        BenchmarkToken z = new BenchmarkToken();
        address[3] memory values = [address(x), address(y), address(z)];
        if (values[0] > values[1]) (values[0], values[1]) = (values[1], values[0]);
        if (values[1] > values[2]) (values[1], values[2]) = (values[2], values[1]);
        if (values[0] > values[1]) (values[0], values[1]) = (values[1], values[0]);
        tokenAContract = BenchmarkToken(values[0]);
        tokenBContract = BenchmarkToken(values[1]);
        tokenCContract = BenchmarkToken(values[2]);
        tokenA = Currency.wrap(values[0]);
        tokenB = Currency.wrap(values[1]);
        tokenC = Currency.wrap(values[2]);
    }

    function _deployEnvironment(uint256 abSlot, uint256 bcSlot, uint256 acSlot, uint256 managerSalt)
        private
        returns (Environment memory env)
    {
        env.manager = IPoolManager(address(new PoolManager(address(this))));
        address hookABAddress = _hookAddress(abSlot);
        address hookBCAddress = _hookAddress(bcSlot);
        address hookACAddress = _hookAddress(acSlot);
        env.coordinator = new ArbFoldCoordinator(
            env.manager,
            tokenA,
            tokenB,
            tokenC,
            ICPMMHook(hookABAddress),
            ICPMMHook(hookBCAddress),
            ICPMMHook(hookACAddress)
        );

        managerSalt; // keeps the frozen deployment helper signature explicit
        deployCodeTo(
            "src/CPMMHook.sol:CPMMHook",
            abi.encode(env.manager, address(env.coordinator)),
            hookABAddress
        );
        deployCodeTo(
            "src/CPMMHook.sol:CPMMHook",
            abi.encode(env.manager, address(env.coordinator)),
            hookBCAddress
        );
        deployCodeTo(
            "src/CPMMHook.sol:CPMMHook",
            abi.encode(env.manager, address(env.coordinator)),
            hookACAddress
        );
        env.hookAB = CPMMHook(hookABAddress);
        env.hookBC = CPMMHook(hookBCAddress);
        env.hookAC = CPMMHook(hookACAddress);

        _initializePool(env.manager, env.hookAB, tokenA, tokenB, WETH_RESERVE, QUOTE_RESERVE);
        _initializePool(env.manager, env.hookBC, tokenB, tokenC, QUOTE_RESERVE, QUOTE_RESERVE);
        _initializePool(env.manager, env.hookAC, tokenA, tokenC, WETH_RESERVE, QUOTE_RESERVE);
    }

    function _initializePool(
        IPoolManager manager,
        CPMMHook hook,
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
        manager.initialize(key, SQRT_PRICE_1_1);
        BenchmarkToken(Currency.unwrap(currency0)).approve(address(hook), type(uint256).max);
        BenchmarkToken(Currency.unwrap(currency1)).approve(address(hook), type(uint256).max);
        hook.addLiquidity(
            BaseCustomAccounting.AddLiquidityParams({
                amount0Desired: reserve0,
                amount1Desired: reserve1,
                amount0Min: reserve0,
                amount1Min: reserve1,
                deadline: MAX_DEADLINE,
                tickLower: MIN_TICK,
                tickUpper: MAX_TICK,
                userInputSalt: bytes32(0)
            })
        );
        hook.authorizeCoordinator();
    }

    function _hookAddress(uint256 slot) private pure returns (address) {
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        return address((uint160(slot) << 152) | flags);
    }

    function _assertClaimsMatchReserves(Environment memory env) private view {
        CycleMath.Network memory n = env.coordinator.network();
        assertEq(env.manager.balanceOf(address(env.hookAB), tokenA.toId()), n.abA, "AB A claim drift");
        assertEq(env.manager.balanceOf(address(env.hookAB), tokenB.toId()), n.abB, "AB B claim drift");
        assertEq(env.manager.balanceOf(address(env.hookBC), tokenB.toId()), n.bcB, "BC B claim drift");
        assertEq(env.manager.balanceOf(address(env.hookBC), tokenC.toId()), n.bcC, "BC C claim drift");
        assertEq(env.manager.balanceOf(address(env.hookAC), tokenA.toId()), n.acA, "AC A claim drift");
        assertEq(env.manager.balanceOf(address(env.hookAC), tokenC.toId()), n.acC, "AC C claim drift");
    }

    function _assertTokenBacking(Environment memory env) private view {
        CycleMath.Network memory n = env.coordinator.network();
        uint256 solverA = env.manager.balanceOf(solver, tokenA.toId());
        assertEq(tokenAContract.balanceOf(address(env.manager)), n.abA + n.acA + solverA, "A backing drift");
        assertEq(tokenBContract.balanceOf(address(env.manager)), n.abB + n.bcB, "B backing drift");
        assertEq(tokenCContract.balanceOf(address(env.manager)), n.bcC + n.acC, "C backing drift");
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

    function _forwardProfit(CycleMath.Network memory n, uint256 amountA) private pure returns (uint256) {
        uint256 b = CycleMath.swapOut(amountA, n.abA, n.abB);
        uint256 c = CycleMath.swapOut(b, n.bcB, n.bcC);
        uint256 a = CycleMath.swapOut(c, n.acC, n.acA);
        return a > amountA ? a - amountA : 0;
    }

    function _previewTotals(CycleMath.Network memory n)
        private
        pure
        returns (uint256 gross, uint256 fixedReward, uint256 rounds, uint256 residual)
    {
        for (uint256 round = 0; round < 8; ++round) {
            CycleMath.Quote memory q = CycleMath.best(n);
            if (q.profitA <= 1e12) {
                residual = q.profitA;
                return (gross, fixedReward, rounds, residual);
            }
            uint256 reward = q.profitA / 10;
            gross += q.profitA;
            fixedReward += reward;
            ++rounds;
            if (!q.reverse) {
                n.abA += q.amountAIn;
                n.abB -= q.intermediateFirst;
                n.bcB += q.intermediateFirst;
                n.bcC -= q.intermediateSecond;
                n.acC += q.intermediateSecond;
                n.acA -= q.amountAIn + reward;
            } else {
                n.acA += q.amountAIn;
                n.acC -= q.intermediateFirst;
                n.bcC += q.intermediateFirst;
                n.bcB -= q.intermediateSecond;
                n.abB += q.intermediateSecond;
                n.abA -= q.amountAIn + reward;
            }
        }
        residual = CycleMath.best(n).profitA;
    }

    function _calldataGas(bytes memory data) private pure returns (uint256 gasCost) {
        for (uint256 i = 0; i < data.length; ++i) gasCost += data[i] == 0 ? 4 : 16;
    }

    function _cool(Environment memory env, address harness) private {
        vm.cool(address(env.manager));
        vm.cool(address(env.coordinator));
        vm.cool(address(env.hookAB));
        vm.cool(address(env.hookBC));
        vm.cool(address(env.hookAC));
        vm.cool(harness);
        vm.cool(address(tokenAContract));
        vm.cool(address(tokenBContract));
        vm.cool(address(tokenCContract));
        vm.cool(address(this));
        vm.cool(solver);
    }

    function _sizes() private pure returns (uint256[5] memory) {
        return [uint256(10_000 ether), 25_000 ether, 50_000 ether, 100_000 ether, 200_000 ether];
    }
}
