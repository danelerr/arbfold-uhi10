// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {TransientStateLibrary} from "@uniswap/v4-core/src/libraries/TransientStateLibrary.sol";
import {CurrencySettler} from "@openzeppelin/uniswap-hooks/utils/CurrencySettler.sol";
import {CycleMath} from "./CycleMath.sol";
import {ArbFoldCoordinator} from "./ArbFoldCoordinator.sol";
import {ICPMMHook} from "./ICPMMHook.sol";

abstract contract BenchmarkHarnessBase is IUnlockCallback {
    using BalanceDeltaLibrary for BalanceDelta;
    using CurrencySettler for Currency;
    using TransientStateLibrary for IPoolManager;

    error NotPoolManager();

    struct Request {
        address payer;
        uint256 originAmountB;
        address solver;
    }

    IPoolManager public immutable manager;
    ArbFoldCoordinator public immutable coordinator;
    Currency public immutable tokenA;
    Currency public immutable tokenB;
    Currency public immutable tokenC;
    PoolKey internal _keyAB;
    PoolKey internal _keyBC;
    PoolKey internal _keyAC;

    constructor(IPoolManager manager_, ArbFoldCoordinator coordinator_) {
        manager = manager_;
        coordinator = coordinator_;
        tokenA = coordinator_.tokenA();
        tokenB = coordinator_.tokenB();
        tokenC = coordinator_.tokenC();
        _keyAB = CPMMKeyReader(address(coordinator_.hookAB())).poolKey();
        _keyBC = CPMMKeyReader(address(coordinator_.hookBC())).poolKey();
        _keyAC = CPMMKeyReader(address(coordinator_.hookAC())).poolKey();
    }

    function execute(uint256 originAmountB, address solver) external returns (uint256 userOutputA) {
        BalanceDelta originDelta = abi.decode(
            manager.unlock(abi.encode(Request(msg.sender, originAmountB, solver))), (BalanceDelta)
        );
        userOutputA = uint128(originDelta.amount0());
    }

    function _originSwap(uint256 amountB, bytes memory hookData) internal returns (BalanceDelta) {
        return manager.swap(
            _keyAB,
            SwapParams({
                zeroForOne: false,
                amountSpecified: -int256(amountB),
                sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
            }),
            hookData
        );
    }

    function _swap(PoolKey memory key, bool zeroForOne, uint256 amountIn) internal returns (BalanceDelta) {
        return manager.swap(
            key,
            SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );
    }

    function _settleAll(address payer) internal {
        _settleCurrency(tokenA, payer);
        _settleCurrency(tokenB, payer);
        _settleCurrency(tokenC, payer);
    }

    function _settleCurrency(Currency currency, address payer) private {
        int256 delta = manager.currencyDelta(address(this), currency);
        if (delta < 0) currency.settle(manager, payer, uint256(-delta), false);
        else if (delta > 0) currency.take(manager, payer, uint256(delta), false);
    }
}

interface CPMMKeyReader {
    function poolKey() external view returns (PoolKey memory);
}

contract OriginOnlyHarness is BenchmarkHarnessBase {
    constructor(IPoolManager manager_, ArbFoldCoordinator coordinator_) BenchmarkHarnessBase(manager_, coordinator_) {}

    function unlockCallback(bytes calldata rawData) external returns (bytes memory) {
        if (msg.sender != address(manager)) revert NotPoolManager();
        Request memory request = abi.decode(rawData, (Request));
        BalanceDelta originDelta = _originSwap(request.originAmountB, "");
        _settleAll(request.payer);
        return abi.encode(originDelta);
    }
}

contract DirectFoldHarness is BenchmarkHarnessBase {
    constructor(IPoolManager manager_, ArbFoldCoordinator coordinator_) BenchmarkHarnessBase(manager_, coordinator_) {}

    function unlockCallback(bytes calldata rawData) external returns (bytes memory) {
        if (msg.sender != address(manager)) revert NotPoolManager();
        Request memory request = abi.decode(rawData, (Request));
        BalanceDelta originDelta = _originSwap(request.originAmountB, abi.encode(uint8(1), request.solver));
        _settleAll(request.payer);
        return abi.encode(originDelta);
    }
}

contract AtomicBackrunHarness is BenchmarkHarnessBase {
    constructor(IPoolManager manager_, ArbFoldCoordinator coordinator_) BenchmarkHarnessBase(manager_, coordinator_) {}

    function unlockCallback(bytes calldata rawData) external returns (bytes memory) {
        if (msg.sender != address(manager)) revert NotPoolManager();
        Request memory request = abi.decode(rawData, (Request));
        BalanceDelta originDelta = _originSwap(request.originAmountB, "");

        for (uint256 round = 0; round < coordinator.MAX_ROUNDS(); ++round) {
            CycleMath.Quote memory q = coordinator.quote();
            if (q.profitA <= coordinator.RESIDUAL_THRESHOLD()) break;

            if (!q.reverse) {
                _swap(_keyAB, true, q.amountAIn);
                _swap(_keyBC, true, q.intermediateFirst);
                _swap(_keyAC, false, q.intermediateSecond);
            } else {
                _swap(_keyAC, true, q.amountAIn);
                _swap(_keyBC, false, q.intermediateFirst);
                _swap(_keyAB, false, q.intermediateSecond);
            }

            uint256 reward = q.profitA * coordinator.SOLVER_SHARE_BPS() / coordinator.BPS();
            uint256 retained = q.profitA - reward;
            ICPMMHook finalHook = q.reverse ? coordinator.hookAB() : coordinator.hookAC();
            manager.mint(address(finalHook), tokenA.toId(), retained);
            manager.mint(request.solver, tokenA.toId(), reward);
            coordinator.recordReinjection(finalHook, tokenA, retained);
        }

        _settleAll(request.payer);
        return abi.encode(originDelta);
    }
}

