// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {TransientStateLibrary} from "@uniswap/v4-core/src/libraries/TransientStateLibrary.sol";
import {ArbFoldTestBase} from "./ArbFoldTestBase.sol";
import {ArbFoldRouter} from "../src/ArbFoldRouter.sol";
import {ArbFoldHook} from "../src/ArbFoldHook.sol";
import {ArbFoldCoordinator} from "../src/ArbFoldCoordinator.sol";
import {DemoToken} from "../src/DemoToken.sol";
import {CycleMath} from "../src/CycleMath.sol";

/// @notice Stateful actor covering all three origin pools, both directions and three solver identities.
contract SixPathSwapHandler is Test {
    ArbFoldRouter internal immutable router;
    ArbFoldCoordinator internal immutable coordinator;
    ArbFoldHook[3] internal hooks;
    DemoToken[3] internal tokens;
    address[3] internal solvers;
    uint256[6] public pathCalls;
    uint256 public successfulCalls;
    uint256 public expectedSolverRewards;

    constructor(
        ArbFoldRouter router_,
        ArbFoldCoordinator coordinator_,
        ArbFoldHook[3] memory hooks_,
        DemoToken[3] memory tokens_,
        address[3] memory solvers_
    ) {
        router = router_;
        coordinator = coordinator_;
        hooks = hooks_;
        tokens = tokens_;
        solvers = solvers_;
        for (uint256 i; i < 3; ++i) {
            tokens[i].approve(address(router_), type(uint256).max);
        }
    }

    function swapAndFold(uint8 rawPath, uint96 rawAmount, uint8 rawSolver) external {
        uint8 path = rawPath % 6;
        uint256 amount = 1 ether + uint256(rawAmount) % 999 ether;
        (ArbFoldHook hook, bool zeroForOne, DemoToken input, DemoToken output) = _path(path);
        address selectedSolver = solvers[rawSolver % 3];

        uint256 inputBefore = input.balanceOf(address(this));
        uint256 outputBefore = output.balanceOf(address(this));
        uint256 rewardBefore = coordinator.totalSolverRewards();
        uint256 amountOut = router.swapExactInput(hook, zeroForOne, amount, 0, selectedSolver, block.timestamp);

        assertEq(inputBefore - input.balanceOf(address(this)), amount, "router overspent input");
        assertEq(output.balanceOf(address(this)) - outputBefore, amountOut, "router output mismatch");
        uint256 rewardDelta = coordinator.totalSolverRewards() - rewardBefore;
        expectedSolverRewards += rewardDelta;
        ++pathCalls[path];
        ++successfulCalls;
    }

    function revertingSwapPreservesState(uint8 rawPath, uint96 rawAmount, uint8 rawSolver) external {
        uint8 path = rawPath % 6;
        uint256 amount = 1 ether + uint256(rawAmount) % 999 ether;
        (ArbFoldHook hook, bool zeroForOne,,) = _path(path);
        address selectedSolver = solvers[rawSolver % 3];

        bytes32 networkBefore = keccak256(abi.encode(coordinator.network()));
        uint256 rewardsBefore = coordinator.totalSolverRewards();
        uint256 callsBefore = coordinator.totalFoldCalls();
        try router.swapExactInput(hook, zeroForOne, amount, type(uint128).max, selectedSolver, block.timestamp) {
            fail("expected slippage revert");
        } catch {}
        assertEq(keccak256(abi.encode(coordinator.network())), networkBefore, "revert changed network");
        assertEq(coordinator.totalSolverRewards(), rewardsBefore, "revert changed rewards");
        assertEq(coordinator.totalFoldCalls(), callsBefore, "revert changed fold calls");
    }

    function solver(uint256 index) external view returns (address) {
        return solvers[index];
    }

    function _path(uint8 path)
        private
        view
        returns (ArbFoldHook hook, bool zeroForOne, DemoToken input, DemoToken output)
    {
        if (path == 0) return (hooks[0], true, tokens[0], tokens[1]);
        if (path == 1) return (hooks[0], false, tokens[1], tokens[0]);
        if (path == 2) return (hooks[1], true, tokens[1], tokens[2]);
        if (path == 3) return (hooks[1], false, tokens[2], tokens[1]);
        if (path == 4) return (hooks[2], true, tokens[0], tokens[2]);
        return (hooks[2], false, tokens[2], tokens[0]);
    }
}

contract ArbFoldInvariantTest is StdInvariant, ArbFoldTestBase {
    using CurrencyLibrary for Currency;
    using TransientStateLibrary for IPoolManager;

    SixPathSwapHandler internal handler;
    uint256 internal initialAb;
    uint256 internal initialBc;
    uint256 internal initialAc;
    address[3] internal invariantSolvers;

    function setUp() public override {
        super.setUp();
        invariantSolvers = [solver, makeAddr("solver-two"), makeAddr("solver-three")];
        ArbFoldHook[3] memory hooks = [hookAB, hookBC, hookAC];
        DemoToken[3] memory tokens = [tokenAContract, tokenBContract, tokenCContract];
        handler = new SixPathSwapHandler(router, coordinator, hooks, tokens, invariantSolvers);
        for (uint256 i; i < 3; ++i) {
            tokens[i].mint(address(handler), 1_000_000_000 ether);
        }
        targetContract(address(handler));

        CycleMath.Network memory n = coordinator.network();
        initialAb = n.abA * n.abB;
        initialBc = n.bcB * n.bcC;
        initialAc = n.acA * n.acC;
    }

    function testFuzz_AllSixOriginDirectionPathsExecute(uint96[6] memory rawAmounts) public {
        for (uint8 path; path < 6; ++path) {
            handler.swapAndFold(path, rawAmounts[path], path % 3);
        }
        for (uint256 path; path < 6; ++path) {
            assertEq(handler.pathCalls(path), 1, "path not exercised");
        }
    }

    function invariant_ClaimsAlwaysMatchVirtualReserves() public view {
        _assertClaimsMatchReserves();
    }

    function invariant_PoolManagerBackingIsExact() public view {
        CycleMath.Network memory n = coordinator.network();
        uint256 solverClaims;
        for (uint256 i; i < 3; ++i) {
            solverClaims += manager.balanceOf(invariantSolvers[i], tokenA.toId());
        }
        assertEq(tokenAContract.balanceOf(address(manager)), n.abA + n.acA + solverClaims, "token A backing drift");
        assertEq(tokenBContract.balanceOf(address(manager)), n.abB + n.bcB, "token B backing drift");
        assertEq(tokenCContract.balanceOf(address(manager)), n.bcC + n.acC, "token C backing drift");
    }

    function invariant_InvariantsNeverFallBelowInitialState() public view {
        CycleMath.Network memory n = coordinator.network();
        assertGe(n.abA * n.abB, initialAb);
        assertGe(n.bcB * n.bcC, initialBc);
        assertGe(n.acA * n.acC, initialAc);
    }

    function invariant_ResidualDisclosureMatchesCurrentNetwork() public view {
        assertEq(coordinator.lastResidualProfit(), CycleMath.best(coordinator.network()).profitA);
    }

    function invariant_SolverClaimsEqualRecordedRewards() public view {
        uint256 claims;
        for (uint256 i; i < 3; ++i) {
            claims += manager.balanceOf(invariantSolvers[i], tokenA.toId());
        }
        assertEq(claims, coordinator.totalSolverRewards());
        assertEq(claims, handler.expectedSolverRewards());
    }

    function invariant_ConfigurationIsImmutable() public view {
        assertTrue(coordinator.configured());
        assertEq(address(coordinator.manager()), address(manager));
        assertEq(address(coordinator.hookAB()), address(hookAB));
        assertEq(address(coordinator.hookBC()), address(hookBC));
        assertEq(address(coordinator.hookAC()), address(hookAC));
        assertEq(address(router.manager()), address(manager));
        assertEq(address(router.coordinator()), address(coordinator));
    }

    function invariant_AllPersistentCurrencyDeltasAreZero() public view {
        address[5] memory actors =
            [address(router), address(coordinator), address(hookAB), address(hookBC), address(hookAC)];
        Currency[3] memory currencies = [tokenA, tokenB, tokenC];
        for (uint256 i; i < actors.length; ++i) {
            for (uint256 j; j < currencies.length; ++j) {
                assertEq(manager.currencyDelta(actors[i], currencies[j]), 0, "persistent currency delta");
            }
        }
    }

    function invariant_FoldCallCountMatchesSuccessfulSwaps() public view {
        assertEq(coordinator.totalFoldCalls(), handler.successfulCalls());
    }
}
