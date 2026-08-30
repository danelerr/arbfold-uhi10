// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Vm} from "forge-std/Vm.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {TransientStateLibrary} from "@uniswap/v4-core/src/libraries/TransientStateLibrary.sol";
import {ArbFoldTestBase} from "./ArbFoldTestBase.sol";
import {RawPoolManagerCaller} from "./ArbFoldNegativePaths.t.sol";
import {ArbFoldCoordinator} from "../src/ArbFoldCoordinator.sol";
import {CycleMath} from "../src/CycleMath.sol";
import {IArbFoldHook} from "../src/IArbFold.sol";

contract ArbFoldCoordinatorV01Harness is ArbFoldCoordinator {
    constructor(IPoolManager manager_, Currency tokenA_, Currency tokenB_, Currency tokenC_)
        ArbFoldCoordinator(manager_, tokenA_, tokenB_, tokenC_)
    {}

    function terminalResidual(CycleMath.Network memory state, CycleMath.Quote memory quote_, uint256 rounds)
        external
        pure
        returns (uint256)
    {
        return _terminalResidual(state, quote_, rounds);
    }
}

contract ArbFoldV01Test is ArbFoldTestBase {
    using CurrencyLibrary for Currency;
    using TransientStateLibrary for IPoolManager;

    bytes32 private constant FOLD_COMPLETED_TOPIC = keccak256("FoldCompleted(address,address,uint256,uint256)");
    bytes32 private constant TELEMETRY_SLOT = bytes32(uint256(3));

    RawPoolManagerCaller private rawCaller;

    function setUp() public override {
        super.setUp();
        rawCaller = new RawPoolManagerCaller(manager);
        tokenAContract.approve(address(rawCaller), type(uint256).max);
        tokenBContract.approve(address(rawCaller), type(uint256).max);
        tokenCContract.approve(address(rawCaller), type(uint256).max);
    }

    function test_LastResidualProfitMatchesCurrentNetworkAfterOneRound() public {
        router.swapExactInput(hookAB, false, 10_000 ether, 0, solver, block.timestamp);
        assertEq(coordinator.totalFoldRounds(), 1, "fixture must execute one round");
        _assertResidualGetter();
    }

    function test_LastResidualProfitMatchesCurrentNetworkAfterTwoRounds() public {
        router.swapExactInput(hookAB, false, 100_000 ether, 0, solver, block.timestamp);
        assertEq(coordinator.totalFoldRounds(), 2, "fixture must execute two rounds");
        _assertResidualGetter();
    }

    function test_LastResidualProfitMatchesCurrentNetworkAfterZeroRounds() public {
        vm.prank(address(hookAB));
        coordinator.fold(solver);
        assertEq(coordinator.totalFoldRounds(), 0);
        _assertResidualGetter();
    }

    function test_LastResidualProfitMatchesCurrentNetworkAfterPlainSwap() public {
        _plainSwap(25_000 ether);
        assertEq(coordinator.totalFoldCalls(), 0, "plain swap must not call fold");
        assertGt(coordinator.lastResidualProfit(), coordinator.RESIDUAL_THRESHOLD());
        _assertResidualGetter();
    }

    function test_FoldCompletedReportsExactTerminalResidual() public {
        vm.recordLogs();
        router.swapExactInput(hookAB, false, 100_000 ether, 0, solver, block.timestamp);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(coordinator) || logs[i].topics[0] != FOLD_COMPLETED_TOPIC) continue;
            (uint256 rounds, uint256 emittedResidual) = abi.decode(logs[i].data, (uint256, uint256));
            assertEq(rounds, 2);
            assertEq(emittedResidual, CycleMath.best(coordinator.network()).profitA);
            assertEq(emittedResidual, coordinator.lastResidualProfit());
            found = true;
        }
        assertTrue(found, "FoldCompleted not found");
    }

    function test_CachedRoundsMatchPureExpectedStateAndPackedTelemetry() public {
        uint256 amountIn = 100_000 ether;
        CycleMath.Network memory expected = coordinator.network();
        uint256 expectedOutput = CycleMath.swapOut(amountIn, expected.abB, expected.abA);
        expected.abB += amountIn;
        expected.abA -= expectedOutput;

        uint256 expectedRounds;
        uint256 expectedRewards;
        (expected, expectedRounds, expectedRewards,) = _simulateFold(expected);
        uint256 output = router.swapExactInput(hookAB, false, amountIn, expectedOutput, solver, block.timestamp);

        assertEq(output, expectedOutput);
        _assertNetworkEq(coordinator.network(), expected);
        assertEq(coordinator.totalFoldCalls(), 1);
        assertEq(coordinator.totalFoldRounds(), expectedRounds);
        assertEq(coordinator.totalSolverRewards(), expectedRewards);
        assertEq(manager.balanceOf(solver, tokenA.toId()), expectedRewards);

        vm.prank(address(hookAB));
        coordinator.fold(makeAddr("second-solver"));
        assertEq(coordinator.totalFoldCalls(), 2, "zero-round call not packed");
        assertEq(coordinator.totalFoldRounds(), expectedRounds, "zero-round call changed rounds");
        assertEq(coordinator.totalSolverRewards(), expectedRewards, "zero-round call changed rewards");
        _assertClaimsMatchReserves();
        _assertBacking();
        _assertPersistentDeltasZero();
    }

    function test_StateDriftRevertsAllRoundEffects() public {
        _plainSwap(100_000 ether);
        CycleMath.Network memory beforeNetwork = coordinator.network();
        uint256[7] memory beforeClaims = _claimsAndReward();
        uint256 callsBefore = coordinator.totalFoldCalls();

        vm.mockCall(
            address(hookAB), abi.encodeWithSelector(IArbFoldHook.setReservesFromCoordinator.selector), bytes("")
        );
        vm.prank(address(hookAB));
        vm.expectRevert(ArbFoldCoordinator.StateDrift.selector);
        coordinator.fold(solver);
        vm.clearMockedCalls();

        _assertNetworkEq(coordinator.network(), beforeNetwork);
        _assertClaimsEq(_claimsAndReward(), beforeClaims);
        assertEq(coordinator.totalFoldCalls(), callsBefore);
        _assertClaimsMatchReserves();
        _assertBacking();
        _assertPersistentDeltasZero();
    }

    function test_TelemetryPackedValuesAndCallOverflowCannotTruncate() public {
        _setTelemetry(type(uint64).max, type(uint64).max - 7, type(uint128).max - 11);
        assertEq(coordinator.totalFoldCalls(), type(uint64).max);
        assertEq(coordinator.totalFoldRounds(), type(uint64).max - 7);
        assertEq(coordinator.totalSolverRewards(), type(uint128).max - 11);

        vm.prank(address(hookAB));
        vm.expectRevert(ArbFoldCoordinator.TelemetryOverflow.selector);
        coordinator.fold(solver);
    }

    function test_TelemetryRoundOverflowRevertsAtomically() public {
        _plainSwap(100_000 ether);
        _setTelemetry(0, type(uint64).max, 0);
        _expectTelemetryOverflowWithoutStateChange();
    }

    function test_TelemetryRewardOverflowRevertsAtomically() public {
        _plainSwap(100_000 ether);
        _setTelemetry(0, 0, type(uint128).max);
        _expectTelemetryOverflowWithoutStateChange();
    }

    function test_ZeroRewardRecipientRevertsAtomically() public {
        _assertForbiddenRecipient(address(0));
    }

    function test_CoordinatorRewardRecipientRevertsAtomically() public {
        _assertForbiddenRecipient(address(coordinator));
    }

    function test_ManagerRewardRecipientRevertsAtomically() public {
        _assertForbiddenRecipient(address(manager));
    }

    function test_HookABRewardRecipientRevertsAtomically() public {
        _assertForbiddenRecipient(address(hookAB));
    }

    function test_HookBCRewardRecipientRevertsAtomically() public {
        _assertForbiddenRecipient(address(hookBC));
    }

    function test_HookACRewardRecipientRevertsAtomically() public {
        _assertForbiddenRecipient(address(hookAC));
    }

    function _assertForbiddenRecipient(address recipient) private {
        CycleMath.Network memory beforeNetwork = coordinator.network();
        uint256[7] memory beforeClaims = _claimsAndReward();

        vm.prank(address(hookAB));
        vm.expectRevert(ArbFoldCoordinator.InvalidSolver.selector);
        coordinator.fold(recipient);

        _assertNetworkEq(coordinator.network(), beforeNetwork);
        _assertClaimsEq(_claimsAndReward(), beforeClaims);
        assertEq(coordinator.totalFoldCalls(), 0);
        assertEq(coordinator.totalFoldRounds(), 0);
        assertEq(coordinator.totalSolverRewards(), 0);
        _assertClaimsMatchReserves();
        _assertBacking();
        _assertPersistentDeltasZero();
    }

    function test_MAX_ROUNDSBranchRecomputesResidualFromFinalState() public {
        ArbFoldCoordinatorV01Harness harness = new ArbFoldCoordinatorV01Harness(manager, tokenA, tokenB, tokenC);
        CycleMath.Network memory state = CycleMath.Network({
            abA: 1_687_608_474_413_722_029_260_800,
            abB: 1_388_704_714_677_211_648,
            bcB: 3_092_444_960_755_310_080,
            bcC: 2_758_736_457_109_301_186_527_232,
            acA: 730_375_767_745_509_443_239_936,
            acC: 1_019_069_203_305_995_264
        });
        CycleMath.Quote memory staleQuote;
        staleQuote.profitA = 123;

        assertEq(harness.terminalResidual(state, staleQuote, 7), 123, "non-terminal branch recomputed quote");
        assertEq(
            harness.terminalResidual(state, staleQuote, harness.MAX_ROUNDS()),
            CycleMath.best(state).profitA,
            "MAX_ROUNDS branch reused stale quote"
        );
    }

    function _expectTelemetryOverflowWithoutStateChange() private {
        CycleMath.Network memory beforeNetwork = coordinator.network();
        uint256[7] memory beforeClaims = _claimsAndReward();
        vm.prank(address(hookAB));
        vm.expectRevert(ArbFoldCoordinator.TelemetryOverflow.selector);
        coordinator.fold(solver);
        _assertNetworkEq(coordinator.network(), beforeNetwork);
        _assertClaimsEq(_claimsAndReward(), beforeClaims);
        _assertClaimsMatchReserves();
        _assertBacking();
        _assertPersistentDeltasZero();
    }

    function _plainSwap(uint256 amountIn) private {
        rawCaller.rawSwap(
            address(this),
            hookAB.poolKey(),
            SwapParams({
                zeroForOne: false, amountSpecified: -int256(amountIn), sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
            }),
            bytes("")
        );
    }

    function _assertResidualGetter() private view {
        assertEq(coordinator.lastResidualProfit(), CycleMath.best(coordinator.network()).profitA);
    }

    function _simulateFold(CycleMath.Network memory current)
        private
        view
        returns (CycleMath.Network memory, uint256 rounds, uint256 rewards, uint256 residual)
    {
        CycleMath.Quote memory quote_;
        for (; rounds < coordinator.MAX_ROUNDS(); ++rounds) {
            quote_ = CycleMath.best(current);
            if (quote_.profitA <= coordinator.RESIDUAL_THRESHOLD()) break;
            uint256 reward = quote_.profitA * coordinator.SOLVER_SHARE_BPS() / coordinator.BPS();
            current = _applyExpected(current, quote_, reward);
            rewards += reward;
        }
        residual = rounds == coordinator.MAX_ROUNDS() ? CycleMath.best(current).profitA : quote_.profitA;
        return (current, rounds, rewards, residual);
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

    function _setTelemetry(uint64 calls, uint64 rounds, uint128 rewards) private {
        uint256 packed = uint256(calls) | (uint256(rounds) << 64) | (uint256(rewards) << 128);
        vm.store(address(coordinator), TELEMETRY_SLOT, bytes32(packed));
    }

    function _claimsAndReward() private view returns (uint256[7] memory values) {
        values[0] = manager.balanceOf(address(hookAB), tokenA.toId());
        values[1] = manager.balanceOf(address(hookAB), tokenB.toId());
        values[2] = manager.balanceOf(address(hookBC), tokenB.toId());
        values[3] = manager.balanceOf(address(hookBC), tokenC.toId());
        values[4] = manager.balanceOf(address(hookAC), tokenA.toId());
        values[5] = manager.balanceOf(address(hookAC), tokenC.toId());
        values[6] = manager.balanceOf(solver, tokenA.toId());
    }

    function _assertPersistentDeltasZero() private view {
        address[5] memory actors =
            [address(router), address(coordinator), address(hookAB), address(hookBC), address(hookAC)];
        Currency[3] memory currencies = [tokenA, tokenB, tokenC];
        for (uint256 i; i < actors.length; ++i) {
            for (uint256 j; j < currencies.length; ++j) {
                assertEq(manager.currencyDelta(actors[i], currencies[j]), 0, "persistent currency delta");
            }
        }
    }

    function _assertNetworkEq(CycleMath.Network memory actual, CycleMath.Network memory expected) private pure {
        assertEq(actual.abA, expected.abA, "abA mismatch");
        assertEq(actual.abB, expected.abB, "abB mismatch");
        assertEq(actual.bcB, expected.bcB, "bcB mismatch");
        assertEq(actual.bcC, expected.bcC, "bcC mismatch");
        assertEq(actual.acA, expected.acA, "acA mismatch");
        assertEq(actual.acC, expected.acC, "acC mismatch");
    }

    function _assertClaimsEq(uint256[7] memory actual, uint256[7] memory expected) private pure {
        for (uint256 i; i < actual.length; ++i) {
            assertEq(actual[i], expected[i], "claim or reward changed");
        }
    }
}
