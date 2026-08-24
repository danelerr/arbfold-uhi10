// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {CycleMath} from "./CycleMath.sol";
import {IArbFoldHook} from "./IArbFold.sol";

/// @notice Coordinates a specialized direct reserve transition across A/B, B/C and A/C CPMMs.
/// @dev Research-grade: fixed network, fixed fee math and no upgrade path.
contract ArbFoldCoordinator {
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
    uint256 public totalFoldCalls;
    uint256 public totalFoldRounds;
    uint256 public totalSolverRewards;
    uint256 public lastResidualProfit;

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

    function isHook(address candidate) public view returns (bool) {
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

    /// @notice Folds the post-swap cycle by moving backed ERC-6909 claims directly among hooks.
    function fold(address solver) external {
        if (!isHook(msg.sender)) revert NotHook();
        if (solver == address(0)) revert InvalidSolver();

        CycleMath.Network memory initialState = network();
        uint256 rounds;
        for (; rounds < MAX_ROUNDS; ++rounds) {
            CycleMath.Network memory beforeState = network();
            CycleMath.Quote memory q = CycleMath.best(beforeState);
            if (q.profitA <= RESIDUAL_THRESHOLD) break;
            uint256 reward = q.profitA * SOLVER_SHARE_BPS / BPS;
            _applyDirect(beforeState, q, reward, solver);
            totalSolverRewards += reward;
            emit FoldRound(msg.sender, solver, rounds, q.reverse, q.profitA, reward);
        }

        CycleMath.Network memory finalState = network();
        if (rounds != 0 && !_anyInvariantIncreased(initialState, finalState)) revert NoInvariantIncrease();
        lastResidualProfit = CycleMath.best(finalState).profitA;
        ++totalFoldCalls;
        totalFoldRounds += rounds;
        emit FoldCompleted(msg.sender, solver, rounds, lastResidualProfit);
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
    {
        // Memory-to-memory assignment aliases dynamic memory. Copy every field so the
        // pre-transition snapshot remains independent for the safety checks below.
        CycleMath.Network memory afterState =
            CycleMath.Network({abA: n.abA, abB: n.abB, bcB: n.bcB, bcC: n.bcC, acA: n.acA, acC: n.acC});
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

        uint256 beforeAB = n.abA * n.abB;
        uint256 beforeBC = n.bcB * n.bcC;
        uint256 beforeAC = n.acA * n.acC;
        uint256 afterAB = afterState.abA * afterState.abB;
        uint256 afterBC = afterState.bcB * afterState.bcC;
        uint256 afterAC = afterState.acA * afterState.acC;

        if (afterAB < beforeAB || afterBC < beforeBC || afterAC < beforeAC) revert InvariantDecreased();
        _assertConservation(n, afterState, reward);

        hookAB.setReservesFromCoordinator(afterState.abA, afterState.abB);
        hookBC.setReservesFromCoordinator(afterState.bcB, afterState.bcC);
        hookAC.setReservesFromCoordinator(afterState.acA, afterState.acC);
    }

    function _anyInvariantIncreased(CycleMath.Network memory beforeState, CycleMath.Network memory afterState)
        private
        pure
        returns (bool)
    {
        return afterState.abA * afterState.abB > beforeState.abA * beforeState.abB
            || afterState.bcB * afterState.bcC > beforeState.bcB * beforeState.bcC
            || afterState.acA * afterState.acC > beforeState.acA * beforeState.acC;
    }

    function _assertConservation(
        CycleMath.Network memory beforeState,
        CycleMath.Network memory afterState,
        uint256 reward
    ) private pure {
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
