// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test} from "forge-std/Test.sol";
import {ArbFoldTestBase} from "./ArbFoldTestBase.sol";
import {ArbFoldRouter} from "../src/ArbFoldRouter.sol";
import {ArbFoldHook} from "../src/ArbFoldHook.sol";
import {DemoToken} from "../src/DemoToken.sol";
import {CycleMath} from "../src/CycleMath.sol";

contract SwapHandler is Test {
    ArbFoldRouter internal immutable router;
    ArbFoldHook internal immutable hook;
    DemoToken internal immutable inputToken;
    address internal immutable solver;

    constructor(ArbFoldRouter router_, ArbFoldHook hook_, DemoToken inputToken_, address solver_) {
        router = router_;
        hook = hook_;
        inputToken = inputToken_;
        solver = solver_;
        inputToken_.approve(address(router_), type(uint256).max);
    }

    function swapAndFold(uint96 rawAmount) external {
        uint256 amount = 1 ether + uint256(rawAmount) % 999 ether;
        router.swapExactInput(hook, false, amount, 0, solver, block.timestamp);
    }
}

contract ArbFoldInvariantTest is StdInvariant, ArbFoldTestBase {
    SwapHandler internal handler;
    uint256 internal initialAB;
    uint256 internal initialBC;
    uint256 internal initialAC;

    function setUp() public override {
        super.setUp();
        handler = new SwapHandler(router, hookAB, tokenBContract, solver);
        tokenBContract.mint(address(handler), 1_000_000_000 ether);
        targetContract(address(handler));

        CycleMath.Network memory n = coordinator.network();
        initialAB = n.abA * n.abB;
        initialBC = n.bcB * n.bcC;
        initialAC = n.acA * n.acC;
    }

    function invariant_ClaimsAlwaysMatchVirtualReserves() public view {
        _assertClaimsMatchReserves();
    }

    function invariant_PoolManagerBackingIsExact() public view {
        _assertBacking();
    }

    function invariant_InvariantsNeverFallBelowInitialState() public view {
        CycleMath.Network memory n = coordinator.network();
        assertGe(n.abA * n.abB, initialAB);
        assertGe(n.bcB * n.bcC, initialBC);
        assertGe(n.acA * n.acC, initialAC);
    }

    function invariant_ResidualCycleIsBounded() public view {
        assertLe(CycleMath.best(coordinator.network()).profitA, coordinator.RESIDUAL_THRESHOLD());
    }
}
