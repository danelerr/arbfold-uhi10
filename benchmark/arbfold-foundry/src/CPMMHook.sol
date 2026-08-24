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
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {CycleMath} from "./CycleMath.sol";
import {IArbFoldCoordinator} from "./ICPMMHook.sol";

contract CPMMHook is BaseCustomCurve, ERC20 {
    using CurrencyLibrary for Currency;

    error ExactInputOnly();
    error AlreadyFunded();
    error NotCoordinator();
    error InvalidReserves();
    error InvalidHookData();

    address public immutable coordinator;
    uint256 private _reserve0;
    uint256 private _reserve1;
    bool private _operatorAuthorized;

    constructor(IPoolManager manager_, address coordinator_)
        BaseHook(manager_)
        ERC20("ARBFOLD Benchmark LP", "ARB-LP")
    {
        coordinator = coordinator_;
    }

    function reserves() external view returns (uint256 reserve0, uint256 reserve1) {
        return (_reserve0, _reserve1);
    }

    function authorizeCoordinator() external {
        if (!_operatorAuthorized) {
            _operatorAuthorized = true;
            poolManager.setOperator(coordinator, true);
        }
    }

    function setReservesFromCoordinator(uint256 reserve0, uint256 reserve1) external {
        if (msg.sender != coordinator) revert NotCoordinator();
        if (reserve0 == 0 || reserve1 == 0) revert InvalidReserves();
        _reserve0 = reserve0;
        _reserve1 = reserve1;
    }

    function creditReserveFromCoordinator(Currency currency, uint256 amount) external {
        if (msg.sender != coordinator) revert NotCoordinator();
        PoolKey memory key = poolKey();
        if (currency == key.currency0) _reserve0 += amount;
        else if (currency == key.currency1) _reserve1 += amount;
        else revert InvalidReserves();
    }

    function _beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        internal
        override
        returns (bytes4 selector, BeforeSwapDelta returnDelta, uint24 feeOverride)
    {
        (selector, returnDelta, feeOverride) = super._beforeSwap(sender, key, params, hookData);
        if (hookData.length != 0) {
            (uint8 mode, address solver) = abi.decode(hookData, (uint8, address));
            if (mode != 1 || solver == address(0)) revert InvalidHookData();
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
        return uint256(-params.amountSpecified) * (CycleMath.DENOMINATOR - CycleMath.GAMMA)
            / CycleMath.DENOMINATOR;
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

    function _mint(
        BaseCustomAccounting.AddLiquidityParams memory,
        BalanceDelta,
        BalanceDelta,
        uint256 shares
    ) internal override {
        _mint(msg.sender, shares);
    }

    function _burn(
        BaseCustomAccounting.RemoveLiquidityParams memory,
        BalanceDelta,
        BalanceDelta,
        uint256 shares
    ) internal override {
        _burn(msg.sender, shares);
    }
}

