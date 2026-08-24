// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {BaseCustomCurve} from "@openzeppelin/uniswap-hooks/base/BaseCustomCurve.sol";
import {BaseCustomAccounting} from "@openzeppelin/uniswap-hooks/base/BaseCustomAccounting.sol";
import {BaseHook} from "@openzeppelin/uniswap-hooks/base/BaseHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {CycleMath} from "./CycleMath.sol";
import {IArbFoldCoordinator} from "./IArbFold.sol";

/// @notice Hook-owned 30 bps CPMM participating in one fixed ARBFOLD network.
/// @dev Exact-input only. OpenZeppelin BaseCustomCurve is experimental software.
contract ArbFoldHook is BaseCustomCurve, ERC20 {
    using BalanceDeltaLibrary for BalanceDelta;
    using CurrencyLibrary for Currency;

    bytes4 public constant FOLD_MODE = bytes4(keccak256("ARBFOLD_DIRECT_V0"));

    error ExactInputOnly();
    error AlreadyFunded();
    error NotCoordinator();
    error InvalidReserves();
    error InvalidHookData();

    address public immutable coordinator;
    uint256 private _reserve0;
    uint256 private _reserve1;
    bool private _coordinatorAuthorized;

    event CoordinatorAuthorized(address indexed coordinator);
    event ReservesUpdated(uint256 reserve0, uint256 reserve1);

    constructor(IPoolManager manager_, address coordinator_) BaseHook(manager_) ERC20("ARBFOLD Research LP", "ARB-LP") {
        if (coordinator_ == address(0)) revert NotCoordinator();
        coordinator = coordinator_;
    }

    function reserves() external view returns (uint256 reserve0, uint256 reserve1) {
        return (_reserve0, _reserve1);
    }

    /// @notice One-time ERC-6909 operator approval for the fixed coordinator.
    function authorizeCoordinator() external {
        if (!_coordinatorAuthorized) {
            _coordinatorAuthorized = true;
            poolManager.setOperator(coordinator, true);
            emit CoordinatorAuthorized(coordinator);
        }
    }

    function setReservesFromCoordinator(uint256 reserve0, uint256 reserve1) external {
        if (msg.sender != coordinator) revert NotCoordinator();
        if (reserve0 == 0 || reserve1 == 0) revert InvalidReserves();
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        emit ReservesUpdated(reserve0, reserve1);
    }

    function _beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        internal
        override
        returns (bytes4 selector, BeforeSwapDelta returnDelta, uint24 feeOverride)
    {
        // BaseCustomCurve first computes and books the user's exact output. Folding therefore cannot change it.
        (selector, returnDelta, feeOverride) = super._beforeSwap(sender, key, params, hookData);
        if (hookData.length != 0) {
            (bytes4 mode, address solver) = abi.decode(hookData, (bytes4, address));
            if (mode != FOLD_MODE || solver == address(0)) revert InvalidHookData();
            IArbFoldCoordinator(coordinator).fold(solver);
        }
    }

    function _getUnspecifiedAmount(SwapParams calldata params) internal override returns (uint256 amountOut) {
        if (params.amountSpecified >= 0) revert ExactInputOnly();
        uint256 amountIn = uint256(-params.amountSpecified);
        if (params.zeroForOne) {
            amountOut = CycleMath.swapOut(amountIn, _reserve0, _reserve1);
            _reserve0 += amountIn;
            _reserve1 -= amountOut;
        } else {
            amountOut = CycleMath.swapOut(amountIn, _reserve1, _reserve0);
            _reserve1 += amountIn;
            _reserve0 -= amountOut;
        }
    }

    function _getSwapFeeAmount(SwapParams calldata params, uint256) internal pure override returns (uint256) {
        if (params.amountSpecified >= 0) return 0;
        return uint256(-params.amountSpecified) * (CycleMath.DENOMINATOR - CycleMath.GAMMA) / CycleMath.DENOMINATOR;
    }

    function _getAmountIn(BaseCustomAccounting.AddLiquidityParams memory params)
        internal
        override
        returns (uint256 amount0, uint256 amount1, uint256 shares)
    {
        if (totalSupply() != 0) revert AlreadyFunded();
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        if (amount0 == 0 || amount1 == 0) revert InvalidReserves();
        _reserve0 = amount0;
        _reserve1 = amount1;
        shares = Math.sqrt(amount0 * amount1);
        emit ReservesUpdated(amount0, amount1);
    }

    function _getAmountOut(BaseCustomAccounting.RemoveLiquidityParams memory params)
        internal
        view
        override
        returns (uint256 amount0, uint256 amount1, uint256 shares)
    {
        shares = params.liquidity;
        uint256 supply = totalSupply();
        amount0 = Math.mulDiv(_reserve0, shares, supply);
        amount1 = Math.mulDiv(_reserve1, shares, supply);
    }

    function _mint(BaseCustomAccounting.AddLiquidityParams memory, BalanceDelta, BalanceDelta, uint256 shares)
        internal
        override
    {
        _mint(msg.sender, shares);
    }

    function _burn(
        BaseCustomAccounting.RemoveLiquidityParams memory,
        BalanceDelta callerDelta,
        BalanceDelta,
        uint256 shares
    ) internal override {
        int128 delta0 = callerDelta.amount0();
        int128 delta1 = callerDelta.amount1();
        if (delta0 < 0 || delta1 < 0) revert InvalidReserves();
        uint256 amount0 = uint256(uint128(delta0));
        uint256 amount1 = uint256(uint128(delta1));
        _reserve0 -= amount0;
        _reserve1 -= amount1;
        _burn(msg.sender, shares);
        emit ReservesUpdated(_reserve0, _reserve1);
    }
}
