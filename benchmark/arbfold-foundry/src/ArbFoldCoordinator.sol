// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {CycleMath} from "./CycleMath.sol";
import {ICPMMHook} from "./ICPMMHook.sol";

contract ArbFoldCoordinator {
    uint256 public constant SOLVER_SHARE_BPS = 1_000;
    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_ROUNDS = 8;
    uint256 public constant RESIDUAL_THRESHOLD = 1e12;

    error NotHook();
    error NotAdmin();
    error NotBackrunHarness();
    error AlreadyConfigured();
    error InvariantDecreased();

    IPoolManager public immutable manager;
    address public immutable admin;
    Currency public immutable tokenA;
    Currency public immutable tokenB;
    Currency public immutable tokenC;
    ICPMMHook public immutable hookAB;
    ICPMMHook public immutable hookBC;
    ICPMMHook public immutable hookAC;
    address public backrunHarness;

    constructor(
        IPoolManager manager_,
        Currency tokenA_,
        Currency tokenB_,
        Currency tokenC_,
        ICPMMHook hookAB_,
        ICPMMHook hookBC_,
        ICPMMHook hookAC_
    ) {
        manager = manager_;
        admin = msg.sender;
        tokenA = tokenA_;
        tokenB = tokenB_;
        tokenC = tokenC_;
        hookAB = hookAB_;
        hookBC = hookBC_;
        hookAC = hookAC_;
    }

    function setBackrunHarness(address harness) external {
        if (msg.sender != admin) revert NotAdmin();
        if (backrunHarness != address(0)) revert AlreadyConfigured();
        backrunHarness = harness;
    }

    function network() public view returns (CycleMath.Network memory n) {
        (n.abA, n.abB) = hookAB.reserves();
        (n.bcB, n.bcC) = hookBC.reserves();
        (n.acA, n.acC) = hookAC.reserves();
    }

    function quote() external view returns (CycleMath.Quote memory) {
        return CycleMath.best(network());
    }

    function fold(address solver) external {
        if (msg.sender != address(hookAB) && msg.sender != address(hookBC) && msg.sender != address(hookAC)) {
            revert NotHook();
        }
        for (uint256 round = 0; round < MAX_ROUNDS; ++round) {
            CycleMath.Network memory beforeState = network();
            CycleMath.Quote memory q = CycleMath.best(beforeState);
            if (q.profitA <= RESIDUAL_THRESHOLD) break;
            uint256 reward = q.profitA * SOLVER_SHARE_BPS / BPS;
            _applyDirect(beforeState, q, reward, solver);
        }
    }

    function recordReinjection(ICPMMHook hook, Currency currency, uint256 amount) external {
        if (msg.sender != backrunHarness) revert NotBackrunHarness();
        hook.creditReserveFromCoordinator(currency, amount);
    }

    function _applyDirect(
        CycleMath.Network memory n,
        CycleMath.Quote memory q,
        uint256 reward,
        address solver
    ) private {
        CycleMath.Network memory afterState = n;
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

        if (
            afterState.abA * afterState.abB < n.abA * n.abB
                || afterState.bcB * afterState.bcC < n.bcB * n.bcC
                || afterState.acA * afterState.acC < n.acA * n.acC
        ) revert InvariantDecreased();

        hookAB.setReservesFromCoordinator(afterState.abA, afterState.abB);
        hookBC.setReservesFromCoordinator(afterState.bcB, afterState.bcC);
        hookAC.setReservesFromCoordinator(afterState.acA, afterState.acC);
    }
}

