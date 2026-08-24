// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {CycleMath} from "../src/CycleMath.sol";

contract CycleMathHarness {
    function swapOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) external pure returns (uint256) {
        return CycleMath.swapOut(amountIn, reserveIn, reserveOut);
    }

    function best(CycleMath.Network memory network) external pure returns (CycleMath.Quote memory) {
        return CycleMath.best(network);
    }
}

/// @notice Boundary and differential checks for the documented arithmetic domain.
contract CycleMathTest is Test {
    uint256 private constant D = 1_000_000;
    uint256 private constant G = 997_000;
    CycleMathHarness private harness;

    function setUp() public {
        harness = new CycleMathHarness();
    }

    function test_SwapOutZeroInputIsZero() public view {
        assertEq(harness.swapOut(0, 0, 0), 0);
    }

    function test_SwapOutRejectsUnsupportedDomain() public {
        vm.expectRevert(CycleMath.ArithmeticDomain.selector);
        harness.swapOut(1, 0, 1);

        vm.expectRevert(CycleMath.ArithmeticDomain.selector);
        harness.swapOut(1, 1, 0);

        vm.expectRevert(CycleMath.ArithmeticDomain.selector);
        harness.swapOut(CycleMath.MAX_NETWORK_RESERVE + 1, 1, 1);

        vm.expectRevert(CycleMath.ArithmeticDomain.selector);
        harness.swapOut(1, CycleMath.MAX_NETWORK_RESERVE + 1, 1);
    }

    function test_BestRejectsZeroAndOversizedReserves() public {
        CycleMath.Network memory network = _uniformNetwork(CycleMath.MIN_NETWORK_RESERVE);
        network.abA = 0;
        vm.expectRevert(CycleMath.ArithmeticDomain.selector);
        harness.best(network);

        network = _uniformNetwork(CycleMath.MIN_NETWORK_RESERVE);
        network.acC = CycleMath.MAX_NETWORK_RESERVE + 1;
        vm.expectRevert(CycleMath.ArithmeticDomain.selector);
        harness.best(network);
    }

    function testFuzz_SwapOutMatchesExactRationalFloor(uint96 rawIn, uint96 rawReserveIn, uint96 rawReserveOut)
        public
        view
    {
        uint256 amountIn = bound(uint256(rawIn), 1, CycleMath.MAX_NETWORK_RESERVE);
        uint256 reserveIn = bound(uint256(rawReserveIn), CycleMath.MIN_NETWORK_RESERVE, CycleMath.MAX_NETWORK_RESERVE);
        uint256 reserveOut = bound(uint256(rawReserveOut), CycleMath.MIN_NETWORK_RESERVE, CycleMath.MAX_NETWORK_RESERVE);
        uint256 expected = Math.mulDiv(amountIn * G, reserveOut, reserveIn * D + amountIn * G);
        assertEq(harness.swapOut(amountIn, reserveIn, reserveOut), expected);
        assertLt(expected, reserveOut);
    }

    function testFuzz_BestQuoteIsInternallyConsistentAcrossSupportedDomain(
        uint96 abA,
        uint96 abB,
        uint96 bcB,
        uint96 bcC,
        uint96 acA,
        uint96 acC
    ) public view {
        CycleMath.Network memory network = CycleMath.Network({
            abA: bound(uint256(abA), CycleMath.MIN_NETWORK_RESERVE, CycleMath.MAX_NETWORK_RESERVE),
            abB: bound(uint256(abB), CycleMath.MIN_NETWORK_RESERVE, CycleMath.MAX_NETWORK_RESERVE),
            bcB: bound(uint256(bcB), CycleMath.MIN_NETWORK_RESERVE, CycleMath.MAX_NETWORK_RESERVE),
            bcC: bound(uint256(bcC), CycleMath.MIN_NETWORK_RESERVE, CycleMath.MAX_NETWORK_RESERVE),
            acA: bound(uint256(acA), CycleMath.MIN_NETWORK_RESERVE, CycleMath.MAX_NETWORK_RESERVE),
            acC: bound(uint256(acC), CycleMath.MIN_NETWORK_RESERVE, CycleMath.MAX_NETWORK_RESERVE)
        });

        CycleMath.Quote memory quote = harness.best(network);
        uint256 first;
        uint256 second;
        uint256 amountOut;
        if (!quote.reverse) {
            first = harness.swapOut(quote.amountAIn, network.abA, network.abB);
            second = harness.swapOut(first, network.bcB, network.bcC);
            amountOut = harness.swapOut(second, network.acC, network.acA);
        } else {
            first = harness.swapOut(quote.amountAIn, network.acA, network.acC);
            second = harness.swapOut(first, network.bcC, network.bcB);
            amountOut = harness.swapOut(second, network.abB, network.abA);
        }
        assertEq(quote.intermediateFirst, first);
        assertEq(quote.intermediateSecond, second);
        assertEq(quote.amountAOut, amountOut);
        assertEq(quote.profitA, amountOut > quote.amountAIn ? amountOut - quote.amountAIn : 0);
    }

    function _uniformNetwork(uint256 reserve) private pure returns (CycleMath.Network memory) {
        return CycleMath.Network({abA: reserve, abB: reserve, bcB: reserve, bcC: reserve, acA: reserve, acC: reserve});
    }
}
