// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {CycleMath} from "./CycleMath.sol";
import {IArbFoldHook, IArbFoldCoordinator} from "./IArbFold.sol";

/// @notice Coordinates a specialized direct reserve transition across A/B, B/C and A/C CPMMs.
/// @dev Research-grade: fixed network, fixed fee math and no upgrade path.
contract ArbFoldCoordinator is IArbFoldCoordinator {
    using CurrencyLibrary for Currency;

    uint256 public constant SOLVER_SHARE_BPS = 1_000;
    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_ROUNDS = 8;
    uint256 public constant RESIDUAL_THRESHOLD = 1e12;

    error NotHook();
    error NotAdmin();
    error AlreadyConfigured();
    error NotConfigured();
    error InvalidHookConfiguration();
    error InvalidSolver();
    error StateDrift();
    error TelemetryOverflow();
    error InvariantDecreased();
    error NoInvariantIncrease();
    error ConservationFailed(uint8 tokenIndex, uint256 beforeTotal, uint256 afterTotal);

    IPoolManager public immutable manager;
    address public immutable admin;
    Currency public immutable tokenA;
    Currency public immutable tokenB;
    Currency public immutable tokenC;

    IArbFoldHook public hookAB;
    IArbFoldHook public hookBC;
    IArbFoldHook public hookAC;
    bool public configured;

    struct Telemetry {
        uint64 foldCalls;
        uint64 foldRounds;
        uint128 solverRewards;
    }

    Telemetry private _telemetry;

    event HooksConfigured(address indexed hookAB, address indexed hookBC, address indexed hookAC);
    event FoldRound(
        address indexed originHook,
        address indexed solver,
        uint256 indexed round,
        bool reverse,
        uint256 threatenedProfit,
        uint256 solverReward
    );
    event FoldCompleted(address indexed originHook, address indexed solver, uint256 rounds, uint256 residualProfit);

    constructor(IPoolManager manager_, Currency tokenA_, Currency tokenB_, Currency tokenC_) {
        if (
            address(manager_) == address(0) || Currency.unwrap(tokenA_) == address(0)
                || Currency.unwrap(tokenB_) == address(0) || Currency.unwrap(tokenC_) == address(0)
        ) revert InvalidHookConfiguration();
        manager = manager_;
        admin = msg.sender;
        tokenA = tokenA_;
        tokenB = tokenB_;
        tokenC = tokenC_;
    }

    /// @notice One-time binding that breaks the coordinator/hook deployment cycle.
    function configureHooks(IArbFoldHook hookAB_, IArbFoldHook hookBC_, IArbFoldHook hookAC_) external {
        if (msg.sender != admin) revert NotAdmin();
        if (configured) revert AlreadyConfigured();
        if (
            address(hookAB_) == address(0) || address(hookBC_) == address(0) || address(hookAC_) == address(0)
                || address(hookAB_) == address(hookBC_) || address(hookAB_) == address(hookAC_)
                || address(hookBC_) == address(hookAC_)
        ) revert InvalidHookConfiguration();

        _validateHook(hookAB_, tokenA, tokenB);
        _validateHook(hookBC_, tokenB, tokenC);
        _validateHook(hookAC_, tokenA, tokenC);

        hookAB = hookAB_;
        hookBC = hookBC_;
        hookAC = hookAC_;
        configured = true;
        emit HooksConfigured(address(hookAB_), address(hookBC_), address(hookAC_));
    }

    function isHook(address candidate) public view override returns (bool) {
        return
            configured && (candidate == address(hookAB) || candidate == address(hookBC) || candidate == address(hookAC));
    }

    function network() public view returns (CycleMath.Network memory n) {
        if (!configured) revert NotConfigured();
        (n.abA, n.abB) = hookAB.reserves();
        (n.bcB, n.bcC) = hookBC.reserves();
        (n.acA, n.acC) = hookAC.reserves();
    }

    function quote() external view returns (CycleMath.Quote memory) {
        return CycleMath.best(network());
    }

    function totalFoldCalls() public view returns (uint256) {
        return uint256(_telemetry.foldCalls);
    }

    function totalFoldRounds() public view returns (uint256) {
        return uint256(_telemetry.foldRounds);
    }

    function totalSolverRewards() public view returns (uint256) {
        return uint256(_telemetry.solverRewards);
    }

    /// @notice Returns the exact cyclic profit available in the current network state.
    /// @dev Computed on demand so fold execution does not persist a residual telemetry slot.
    function lastResidualProfit() public view returns (uint256) {
        return CycleMath.best(network()).profitA;
    }

    /// @notice Folds the post-swap cycle by moving backed ERC-6909 claims directly among hooks.
    function fold(address solver) external override {
        if (!isHook(msg.sender)) revert NotHook();
        if (solver == address(0) || solver == address(this) || solver == address(manager) || isHook(solver)) {
            revert InvalidSolver();
        }

        CycleMath.Network memory initialState = network();
        CycleMath.Network memory currentState = initialState;
        CycleMath.Quote memory q = CycleMath.Quote({
            reverse: false, amountAIn: 0, intermediateFirst: 0, intermediateSecond: 0, amountAOut: 0, profitA: 0
        });
        uint256 rounds = 0;
        uint256 rewards;
        for (; rounds < MAX_ROUNDS; ++rounds) {
            q = CycleMath.best(currentState);
            if (q.profitA <= RESIDUAL_THRESHOLD) break;
            uint256 reward = q.profitA * SOLVER_SHARE_BPS / BPS;
            currentState = _applyDirect(currentState, q, reward, solver);
            rewards += reward;
            emit FoldRound(msg.sender, solver, rounds, q.reverse, q.profitA, reward);
        }

        uint256 residualProfit = _terminalResidual(currentState, q, rounds);
        CycleMath.Network memory finalState = network();
        if (!_sameNetwork(currentState, finalState)) revert StateDrift();
        if (rounds != 0 && !_anyInvariantIncreased(initialState, finalState)) revert NoInvariantIncrease();
        _recordTelemetry(rounds, rewards);
        emit FoldCompleted(msg.sender, solver, rounds, residualProfit);
    }

    function _validateHook(IArbFoldHook hook, Currency expected0, Currency expected1) private view {
        if (address(hook).code.length == 0) revert InvalidHookConfiguration();
        if (hook.coordinator() != address(this) || address(hook.poolManager()) != address(manager)) {
            revert InvalidHookConfiguration();
        }
        PoolKey memory key = hook.poolKey();
        if (
            address(key.hooks) != address(hook) || Currency.unwrap(key.currency0) != Currency.unwrap(expected0)
                || Currency.unwrap(key.currency1) != Currency.unwrap(expected1)
        ) {
            revert InvalidHookConfiguration();
        }
    }

    function _applyDirect(CycleMath.Network memory n, CycleMath.Quote memory q, uint256 reward, address solver)
        private
        returns (CycleMath.Network memory afterState)
    {
        // Memory-to-memory assignment aliases dynamic memory. Copy every field so the
        // pre-transition snapshot remains independent for the safety checks below.
        afterState = CycleMath.Network({abA: n.abA, abB: n.abB, bcB: n.bcB, bcC: n.bcC, acA: n.acA, acC: n.acC});
        if (!q.reverse) {
            manager.transferFrom(address(hookAC), address(hookAB), tokenA.toId(), q.amountAIn);
            manager.transferFrom(address(hookAC), solver, tokenA.toId(), reward);
            manager.transferFrom(address(hookAB), address(hookBC), tokenB.toId(), q.intermediateFirst);
            manager.transferFrom(address(hookBC), address(hookAC), tokenC.toId(), q.intermediateSecond);

            afterState.abA += q.amountAIn;
            afterState.abB -= q.intermediateFirst;
            afterState.bcB += q.intermediateFirst;
            afterState.bcC -= q.intermediateSecond;
            afterState.acC += q.intermediateSecond;
            afterState.acA -= q.amountAIn + reward;
        } else {
            manager.transferFrom(address(hookAB), address(hookAC), tokenA.toId(), q.amountAIn);
            manager.transferFrom(address(hookAB), solver, tokenA.toId(), reward);
            manager.transferFrom(address(hookAC), address(hookBC), tokenC.toId(), q.intermediateFirst);
            manager.transferFrom(address(hookBC), address(hookAB), tokenB.toId(), q.intermediateSecond);

            afterState.acA += q.amountAIn;
            afterState.acC -= q.intermediateFirst;
            afterState.bcC += q.intermediateFirst;
            afterState.bcB -= q.intermediateSecond;
            afterState.abB += q.intermediateSecond;
            afterState.abA -= q.amountAIn + reward;
        }

        _assertNonDecreasing(n, afterState);
        _assertConservation(n, afterState, reward);

        hookAB.setReservesFromCoordinator(afterState.abA, afterState.abB);
        hookBC.setReservesFromCoordinator(afterState.bcB, afterState.bcC);
        hookAC.setReservesFromCoordinator(afterState.acA, afterState.acC);
    }

    function _recordTelemetry(uint256 rounds, uint256 rewards) private {
        Telemetry memory telemetry = _telemetry;
        if (telemetry.foldCalls == type(uint64).max) revert TelemetryOverflow();
        if (rounds > type(uint64).max - telemetry.foldRounds) revert TelemetryOverflow();
        if (rewards > type(uint128).max - telemetry.solverRewards) revert TelemetryOverflow();

        _telemetry = Telemetry({
            foldCalls: telemetry.foldCalls + 1,
            foldRounds: telemetry.foldRounds + SafeCast.toUint64(rounds),
            solverRewards: telemetry.solverRewards + SafeCast.toUint128(rewards)
        });
    }

    function _sameNetwork(CycleMath.Network memory expected, CycleMath.Network memory actual)
        private
        pure
        returns (bool)
    {
        return expected.abA == actual.abA && expected.abB == actual.abB && expected.bcB == actual.bcB
            && expected.bcC == actual.bcC && expected.acA == actual.acA && expected.acC == actual.acC;
    }

    function _terminalResidual(CycleMath.Network memory currentState, CycleMath.Quote memory q, uint256 rounds)
        internal
        pure
        returns (uint256)
    {
        return rounds == MAX_ROUNDS ? CycleMath.best(currentState).profitA : q.profitA;
    }

    function _anyInvariantIncreased(CycleMath.Network memory beforeState, CycleMath.Network memory afterState)
        internal
        pure
        returns (bool)
    {
        return afterState.abA * afterState.abB > beforeState.abA * beforeState.abB
            || afterState.bcB * afterState.bcC > beforeState.bcB * beforeState.bcC
            || afterState.acA * afterState.acC > beforeState.acA * beforeState.acC;
    }

    function _assertNonDecreasing(CycleMath.Network memory beforeState, CycleMath.Network memory afterState)
        internal
        pure
    {
        if (
            afterState.abA * afterState.abB < beforeState.abA * beforeState.abB
                || afterState.bcB * afterState.bcC < beforeState.bcB * beforeState.bcC
                || afterState.acA * afterState.acC < beforeState.acA * beforeState.acC
        ) revert InvariantDecreased();
    }

    function _assertConservation(
        CycleMath.Network memory beforeState,
        CycleMath.Network memory afterState,
        uint256 reward
    ) internal pure {
        uint256 beforeTotal = beforeState.abA + beforeState.acA;
        uint256 afterTotal = afterState.abA + afterState.acA + reward;
        if (afterTotal != beforeTotal) revert ConservationFailed(0, beforeTotal, afterTotal);
        beforeTotal = beforeState.abB + beforeState.bcB;
        afterTotal = afterState.abB + afterState.bcB;
        if (afterTotal != beforeTotal) revert ConservationFailed(1, beforeTotal, afterTotal);
        beforeTotal = beforeState.bcC + beforeState.acC;
        afterTotal = afterState.bcC + afterState.acC;
        if (afterTotal != beforeTotal) revert ConservationFailed(2, beforeTotal, afterTotal);
    }
}
