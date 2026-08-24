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
import {ArbFoldHook} from "./ArbFoldHook.sol";
import {IArbFoldCoordinator} from "./IArbFold.sol";

/// @notice Minimal exact-input router that triggers ARBFOLD in the originating PoolManager unlock.
contract ArbFoldRouter is IUnlockCallback {
    using BalanceDeltaLibrary for BalanceDelta;
    using CurrencySettler for Currency;
    using TransientStateLibrary for IPoolManager;

    bytes4 private constant FOLD_MODE = bytes4(keccak256("ARBFOLD_DIRECT_V0"));

    error NotPoolManager();
    error DeadlineExpired();
    error InvalidAmount();
    error InvalidSolver();
    error UnregisteredHook();
    error TooLittleReceived(uint256 minimum, uint256 actual);

    struct Request {
        address payer;
        ArbFoldHook hook;
        bool zeroForOne;
        uint256 amountIn;
        uint256 minAmountOut;
        address solver;
    }

    IPoolManager public immutable manager;
    IArbFoldCoordinator public immutable coordinator;

    event SwapAndFold(
        address indexed payer,
        address indexed hook,
        address indexed solver,
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(IPoolManager manager_, IArbFoldCoordinator coordinator_) {
        manager = manager_;
        coordinator = coordinator_;
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
        emit SwapAndFold(msg.sender, address(hook), solver, zeroForOne, amountIn, amountOut);
    }

    function unlockCallback(bytes calldata rawData) external returns (bytes memory) {
        if (msg.sender != address(manager)) revert NotPoolManager();
        Request memory request = abi.decode(rawData, (Request));
        PoolKey memory key = request.hook.poolKey();
        BalanceDelta delta = manager.swap(
            key,
            SwapParams({
                zeroForOne: request.zeroForOne,
                amountSpecified: -int256(request.amountIn),
                sqrtPriceLimitX96: request.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            abi.encode(FOLD_MODE, request.solver)
        );

        _settle(key.currency0, request.payer);
        _settle(key.currency1, request.payer);
        return abi.encode(delta);
    }

    function _settle(Currency currency, address payer) private {
        int256 delta = manager.currencyDelta(address(this), currency);
        if (delta < 0) currency.settle(manager, payer, uint256(-delta), false);
        else if (delta > 0) currency.take(manager, payer, uint256(delta), false);
    }
}
