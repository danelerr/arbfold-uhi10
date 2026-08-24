// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Closed-form integer math for a three-CPMM arbitrage cycle.
/// @dev The same library is used by the direct transition and its reference benchmark.
library CycleMath {
    uint256 internal constant DENOMINATOR = 1_000_000;
    uint256 internal constant GAMMA = 997_000;
    uint256 private constant NORMALIZED_MAX = 1e36;

    struct Network {
        uint256 abA;
        uint256 abB;
        uint256 bcB;
        uint256 bcC;
        uint256 acA;
        uint256 acC;
    }

    struct Quote {
        bool reverse;
        uint256 amountAIn;
        uint256 intermediateFirst;
        uint256 intermediateSecond;
        uint256 amountAOut;
        uint256 profitA;
    }

    struct Leg {
        uint256 reserveIn;
        uint256 reserveOut;
    }

    function swapOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256) {
        if (amountIn == 0) return 0;
        uint256 effectiveIn = amountIn * GAMMA;
        return Math.mulDiv(effectiveIn, reserveOut, reserveIn * DENOMINATOR + effectiveIn);
    }

    function best(Network memory n) internal pure returns (Quote memory quote) {
        Quote memory forward = _quoteForward(n);
        Quote memory reverse = _quoteReverse(n);
        quote = forward.profitA >= reverse.profitA ? forward : reverse;
    }

    function _quoteForward(Network memory n) private pure returns (Quote memory quote) {
        Leg[3] memory legs = [Leg(n.abA, n.abB), Leg(n.bcB, n.bcC), Leg(n.acC, n.acA)];
        uint256 q = _optimalInput(legs);
        uint256 tokenB = swapOut(q, n.abA, n.abB);
        uint256 tokenC = swapOut(tokenB, n.bcB, n.bcC);
        uint256 tokenA = swapOut(tokenC, n.acC, n.acA);
        quote = Quote(false, q, tokenB, tokenC, tokenA, tokenA > q ? tokenA - q : 0);
    }

    function _quoteReverse(Network memory n) private pure returns (Quote memory quote) {
        Leg[3] memory legs = [Leg(n.acA, n.acC), Leg(n.bcC, n.bcB), Leg(n.abB, n.abA)];
        uint256 q = _optimalInput(legs);
        uint256 tokenC = swapOut(q, n.acA, n.acC);
        uint256 tokenB = swapOut(tokenC, n.bcC, n.bcB);
        uint256 tokenA = swapOut(tokenB, n.abB, n.abA);
        quote = Quote(true, q, tokenC, tokenB, tokenA, tokenA > q ? tokenA - q : 0);
    }

    /// @dev Closed-form optimum of A*x/(B+C*x)-x after bounded normalization.
    function _optimalInput(Leg[3] memory legs) private pure returns (uint256) {
        uint256 a = GAMMA * legs[0].reserveOut;
        uint256 b = DENOMINATOR * legs[0].reserveIn;
        uint256 c = GAMMA;

        for (uint256 i = 1; i < 3; ++i) {
            uint256 nextA = GAMMA * legs[i].reserveOut;
            uint256 nextB = DENOMINATOR * legs[i].reserveIn;
            (a, b, c) = _normalize(nextA * a, nextB * b, nextB * c + GAMMA * a);
        }

        (a, b, c) = _normalize(a, b, c);
        uint256 root = Math.sqrt(a * b);
        if (root <= b || c == 0) return 0;
        return (root - b) / c;
    }

    function _normalize(uint256 a, uint256 b, uint256 c) private pure returns (uint256, uint256, uint256) {
        uint256 maximum = Math.max(Math.max(a, b), c);
        if (maximum <= NORMALIZED_MAX) return (a, b, c);
        uint256 scale = Math.ceilDiv(maximum, NORMALIZED_MAX);
        return (a / scale, b / scale, c / scale);
    }
}

