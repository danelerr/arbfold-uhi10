// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ArbFoldTestBase} from "./ArbFoldTestBase.sol";
import {console2} from "forge-std/console2.sol";
import {ArbFoldCoordinator} from "../src/ArbFoldCoordinator.sol";
import {ArbFoldRouter} from "../src/ArbFoldRouter.sol";
import {CycleMath} from "../src/CycleMath.sol";
import {IArbFoldHook} from "../src/IArbFold.sol";
import {BaseCustomAccounting} from "@openzeppelin/uniswap-hooks/base/BaseCustomAccounting.sol";

contract ArbFoldTest is ArbFoldTestBase {
    function test_SwapAndFoldPreservesOutputBackingAndParetoSafety() public {
        uint256 amountIn = 100_000 ether;
        CycleMath.Network memory initial = coordinator.network();
        uint256 expectedOutput = CycleMath.swapOut(amountIn, initial.abB, initial.abA);
        CycleMath.Network memory postUser = initial;
        postUser.abB += amountIn;
        postUser.abA -= expectedOutput;

        uint256 amountOut = router.swapExactInput(hookAB, false, amountIn, expectedOutput, solver, block.timestamp);

        assertEq(amountOut, expectedOutput, "fold changed user output");
        assertGt(manager.balanceOf(solver, tokenA.toId()), 0, "solver reward missing");
        assertGt(coordinator.totalFoldRounds(), 0, "no fold round executed");
        assertLe(coordinator.lastResidualProfit(), coordinator.RESIDUAL_THRESHOLD(), "material residual");
        _assertNonDecreasing(postUser, coordinator.network());
        _assertClaimsMatchReserves();
        _assertBacking();
    }

    function testFuzz_SwapAndFoldMaintainsMechanicalProperties(uint96 rawAmount) public {
        uint256 amountIn = bound(uint256(rawAmount), 1_000 ether, 200_000 ether);
        CycleMath.Network memory initial = coordinator.network();
        uint256 expectedOutput = CycleMath.swapOut(amountIn, initial.abB, initial.abA);
        CycleMath.Network memory postUser = initial;
        postUser.abB += amountIn;
        postUser.abA -= expectedOutput;

        uint256 amountOut = router.swapExactInput(hookAB, false, amountIn, 0, solver, block.timestamp);
        assertEq(amountOut, expectedOutput);
        _assertNonDecreasing(postUser, coordinator.network());
        _assertClaimsMatchReserves();
        _assertBacking();
        assertLe(coordinator.lastResidualProfit(), coordinator.RESIDUAL_THRESHOLD());
    }

    function test_UnauthorizedFoldReverts() public {
        vm.expectRevert(ArbFoldCoordinator.NotHook.selector);
        coordinator.fold(solver);
    }

    function test_HooksCannotBeReconfigured() public {
        vm.expectRevert(ArbFoldCoordinator.AlreadyConfigured.selector);
        coordinator.configureHooks(
            IArbFoldHook(address(hookAB)), IArbFoldHook(address(hookBC)), IArbFoldHook(address(hookAC))
        );
    }

    function test_MinOutputRevertsAtomically() public {
        CycleMath.Network memory beforeN = coordinator.network();
        uint256 expectedOutput = CycleMath.swapOut(100_000 ether, beforeN.abB, beforeN.abA);
        vm.expectRevert(
            abi.encodeWithSelector(ArbFoldRouter.TooLittleReceived.selector, uint256(type(uint128).max), expectedOutput)
        );
        router.swapExactInput(hookAB, false, 100_000 ether, type(uint128).max, solver, block.timestamp);
        CycleMath.Network memory afterN = coordinator.network();
        assertEq(keccak256(abi.encode(beforeN)), keccak256(abi.encode(afterN)), "revert left state changes");
    }

    function test_ExpiredSwapRevertsBeforeUnlock() public {
        vm.warp(2);
        vm.expectRevert(ArbFoldRouter.DeadlineExpired.selector);
        router.swapExactInput(hookAB, false, 1 ether, 0, solver, 1);
    }

    function test_LiquidityRemovalUpdatesReservesAndClaimsTogether() public {
        uint256 shares = hookAB.balanceOf(address(this)) / 10;
        hookAB.removeLiquidity(
            BaseCustomAccounting.RemoveLiquidityParams({
                liquidity: shares,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp,
                tickLower: MIN_TICK,
                tickUpper: MAX_TICK,
                userInputSalt: bytes32(0)
            })
        );
        _assertClaimsMatchReserves();
        _assertBacking();
    }

    function testGas_CanonicalSwapAndFold() public {
        router.swapExactInput(hookAB, false, 100_000 ether, 0, solver, block.timestamp);
    }

    function test_ReportCanonicalDemoState() public {
        uint256 amountOut = router.swapExactInput(hookAB, false, 100_000 ether, 0, solver, block.timestamp);
        CycleMath.Network memory n = coordinator.network();
        console2.log("ARBFOLD_DEMO_USER_OUTPUT_A", amountOut);
        console2.log("ARBFOLD_DEMO_SOLVER_REWARD_A", manager.balanceOf(solver, tokenA.toId()));
        console2.log("ARBFOLD_DEMO_AB_A", n.abA);
        console2.log("ARBFOLD_DEMO_AB_B", n.abB);
        console2.log("ARBFOLD_DEMO_BC_B", n.bcB);
        console2.log("ARBFOLD_DEMO_BC_C", n.bcC);
        console2.log("ARBFOLD_DEMO_AC_A", n.acA);
        console2.log("ARBFOLD_DEMO_AC_C", n.acC);
        console2.log("ARBFOLD_DEMO_RESIDUAL_A", coordinator.lastResidualProfit());
    }
}
