// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ArbFoldTestBase} from "./ArbFoldTestBase.sol";
import {ArbFoldCoordinator} from "../src/ArbFoldCoordinator.sol";
import {CycleMath} from "../src/CycleMath.sol";

/// @notice Converts the frozen v0 reward-alias finding into a v0.1 regression.
/// @dev The original reproducer remains archived under research/historical-v0.
contract ArbFoldResearchFindingsTest is ArbFoldTestBase {
    function test_RegisteredHookRewardRecipientNowRevertsAtomically() public {
        CycleMath.Network memory beforeNetwork = coordinator.network();
        uint256 callsBefore = coordinator.totalFoldCalls();
        uint256 roundsBefore = coordinator.totalFoldRounds();
        uint256 rewardsBefore = coordinator.totalSolverRewards();

        vm.prank(address(hookAB));
        vm.expectRevert(ArbFoldCoordinator.InvalidSolver.selector);
        coordinator.fold(address(hookAB));

        assertEq(keccak256(abi.encode(coordinator.network())), keccak256(abi.encode(beforeNetwork)));
        assertEq(coordinator.totalFoldCalls(), callsBefore);
        assertEq(coordinator.totalFoldRounds(), roundsBefore);
        assertEq(coordinator.totalSolverRewards(), rewardsBefore);
        _assertClaimsMatchReserves();
        _assertBacking();
    }
}
