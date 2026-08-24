// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {TransientStateLibrary} from "@uniswap/v4-core/src/libraries/TransientStateLibrary.sol";
import {CurrencySettler} from "@openzeppelin/uniswap-hooks/utils/CurrencySettler.sol";
import {ArbFoldCoordinator} from "../src/ArbFoldCoordinator.sol";
import {ArbFoldHook} from "../src/ArbFoldHook.sol";
import {CycleMath} from "../src/CycleMath.sol";
import {IArbFoldHook} from "../src/IArbFold.sol";

/// @dev Test-only extension. Both clean-core environments deploy this exact coordinator
/// bytecode; the reference path alone uses `recordReferenceReinjection` after real swaps.
contract CleanCoreReferenceCoordinator is ArbFoldCoordinator {
    error NotReferenceExecutor();
    error ReferenceExecutorAlreadySet();
    error InvalidReferenceHook();

    address public referenceExecutor;

    constructor(IPoolManager manager_, Currency tokenA_, Currency tokenB_, Currency tokenC_)
        ArbFoldCoordinator(manager_, tokenA_, tokenB_, tokenC_)
    {}

    function setReferenceExecutor(address executor) external {
        if (msg.sender != admin) revert NotAdmin();
        if (referenceExecutor != address(0)) revert ReferenceExecutorAlreadySet();
        if (executor == address(0)) revert NotReferenceExecutor();
        referenceExecutor = executor;
    }

    function recordReferenceReinjection(IArbFoldHook finalHook, uint256 retained) external {
        if (msg.sender != referenceExecutor) revert NotReferenceExecutor();
        if (address(finalHook) != address(hookAB) && address(finalHook) != address(hookAC)) {
            revert InvalidReferenceHook();
        }
        (uint256 reserve0, uint256 reserve1) = finalHook.reserves();
        finalHook.setReservesFromCoordinator(reserve0 + retained, reserve1);
    }
}

/// @dev Best-case atomic three-leg reference using the published clean hook and math.
/// It intentionally has the same external swap signature as `ArbFoldRouter`.
contract CleanCoreAtomicBackrunRouter is IUnlockCallback {
    using BalanceDeltaLibrary for BalanceDelta;
    using CurrencyLibrary for Currency;
    using CurrencySettler for Currency;
    using TransientStateLibrary for IPoolManager;

    error NotPoolManager();
    error DeadlineExpired();
    error InvalidAmount();
    error InvalidSolver();
    error UnregisteredHook();
    error TooLittleReceived(uint256 minimum, uint256 actual);
    error ReferenceOutputMismatch(uint256 expected, uint256 actual);

    struct Request {
        address payer;
        ArbFoldHook hook;
        bool zeroForOne;
        uint256 amountIn;
        uint256 minAmountOut;
        address solver;
    }

    IPoolManager public immutable manager;
    CleanCoreReferenceCoordinator public immutable coordinator;
    Currency public immutable tokenA;
    Currency public immutable tokenB;
    Currency public immutable tokenC;
    PoolKey private _keyAB;
    PoolKey private _keyBC;
    PoolKey private _keyAC;

    constructor(IPoolManager manager_, CleanCoreReferenceCoordinator coordinator_) {
        manager = manager_;
        coordinator = coordinator_;
        tokenA = coordinator_.tokenA();
        tokenB = coordinator_.tokenB();
        tokenC = coordinator_.tokenC();
        _keyAB = coordinator_.hookAB().poolKey();
        _keyBC = coordinator_.hookBC().poolKey();
        _keyAC = coordinator_.hookAC().poolKey();
    }

    function swapExactInput(
        ArbFoldHook hook,
        bool zeroForOne,
        uint256 amountIn,
        uint256 minAmountOut,
        address solver,
        uint256 deadline
    ) external returns (uint256 amountOut) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (amountIn == 0 || amountIn > uint256(type(int256).max)) revert InvalidAmount();
        if (solver == address(0)) revert InvalidSolver();
        if (!coordinator.isHook(address(hook))) revert UnregisteredHook();

        BalanceDelta delta = abi.decode(
            manager.unlock(abi.encode(Request(msg.sender, hook, zeroForOne, amountIn, minAmountOut, solver))),
            (BalanceDelta)
        );
        int128 outputDelta = zeroForOne ? delta.amount1() : delta.amount0();
        if (outputDelta <= 0) revert InvalidAmount();
        amountOut = uint128(outputDelta);
        if (amountOut < minAmountOut) revert TooLittleReceived(minAmountOut, amountOut);
    }

    function unlockCallback(bytes calldata rawData) external returns (bytes memory) {
        if (msg.sender != address(manager)) revert NotPoolManager();
        Request memory request = abi.decode(rawData, (Request));
        BalanceDelta originDelta =
            _swap(request.hook.poolKey(), request.zeroForOne, request.amountIn, request.zeroForOne, 0);

        for (uint256 round = 0; round < coordinator.MAX_ROUNDS(); ++round) {
            CycleMath.Quote memory q = coordinator.quote();
            if (q.profitA <= coordinator.RESIDUAL_THRESHOLD()) break;

            if (!q.reverse) {
                _swap(_keyAB, true, q.amountAIn, true, q.intermediateFirst);
                _swap(_keyBC, true, q.intermediateFirst, true, q.intermediateSecond);
                _swap(_keyAC, false, q.intermediateSecond, false, q.amountAOut);
            } else {
                _swap(_keyAC, true, q.amountAIn, true, q.intermediateFirst);
                _swap(_keyBC, false, q.intermediateFirst, false, q.intermediateSecond);
                _swap(_keyAB, false, q.intermediateSecond, false, q.amountAOut);
            }

            uint256 reward = q.profitA * coordinator.SOLVER_SHARE_BPS() / coordinator.BPS();
            uint256 retained = q.profitA - reward;
            IArbFoldHook finalHook = q.reverse ? coordinator.hookAB() : coordinator.hookAC();
            manager.mint(address(finalHook), tokenA.toId(), retained);
            manager.mint(request.solver, tokenA.toId(), reward);
            coordinator.recordReferenceReinjection(finalHook, retained);
        }

        _settle(tokenA, request.payer);
        _settle(tokenB, request.payer);
        _settle(tokenC, request.payer);
        return abi.encode(originDelta);
    }

    function _swap(PoolKey memory key, bool zeroForOne, uint256 amountIn, bool expectedZeroForOne, uint256 expectedOut)
        private
        returns (BalanceDelta delta)
    {
        delta = manager.swap(
            key,
            SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );
        if (expectedOut != 0) {
            int128 outputDelta = expectedZeroForOne ? delta.amount1() : delta.amount0();
            uint256 actualOut = outputDelta > 0 ? uint128(outputDelta) : 0;
            if (actualOut != expectedOut) revert ReferenceOutputMismatch(expectedOut, actualOut);
        }
    }

    function _settle(Currency currency, address payer) private {
        int256 delta = manager.currencyDelta(address(this), currency);
        if (delta < 0) currency.settle(manager, payer, uint256(-delta), false);
        else if (delta > 0) currency.take(manager, payer, uint256(delta), false);
    }
}

