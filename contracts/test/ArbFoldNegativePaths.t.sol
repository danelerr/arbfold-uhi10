// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {TransientStateLibrary} from "@uniswap/v4-core/src/libraries/TransientStateLibrary.sol";
import {CustomRevert} from "@uniswap/v4-core/src/libraries/CustomRevert.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {CurrencySettler} from "@openzeppelin/uniswap-hooks/utils/CurrencySettler.sol";
import {BaseCustomAccounting} from "@openzeppelin/uniswap-hooks/base/BaseCustomAccounting.sol";
import {ArbFoldTestBase} from "./ArbFoldTestBase.sol";
import {ArbFoldCoordinator} from "../src/ArbFoldCoordinator.sol";
import {ArbFoldHook} from "../src/ArbFoldHook.sol";
import {ArbFoldHookDeployer} from "../src/ArbFoldHookDeployer.sol";
import {ArbFoldRouter} from "../src/ArbFoldRouter.sol";
import {CycleMath} from "../src/CycleMath.sol";
import {IArbFoldHook} from "../src/IArbFold.sol";

contract RawPoolManagerCaller is IUnlockCallback {
    using CurrencySettler for Currency;
    using TransientStateLibrary for IPoolManager;

    error NotPoolManager();

    struct RawSwap {
        address payer;
        PoolKey key;
        SwapParams params;
        bytes hookData;
    }

    IPoolManager internal immutable manager;

    constructor(IPoolManager manager_) {
        manager = manager_;
    }

    function rawSwap(address payer, PoolKey memory key, SwapParams memory params, bytes memory hookData)
        external
        returns (BalanceDelta delta)
    {
        delta = abi.decode(
            manager.unlock(abi.encode(uint8(0), abi.encode(RawSwap(payer, key, params, hookData)))), (BalanceDelta)
        );
    }

    function directModify(PoolKey memory key, ModifyLiquidityParams memory params) external {
        manager.unlock(abi.encode(uint8(1), abi.encode(key, params)));
    }

    function unlockCallback(bytes calldata rawData) external returns (bytes memory) {
        if (msg.sender != address(manager)) revert NotPoolManager();
        (uint8 action, bytes memory payload) = abi.decode(rawData, (uint8, bytes));
        if (action == 0) {
            RawSwap memory request = abi.decode(payload, (RawSwap));
            BalanceDelta delta = manager.swap(request.key, request.params, request.hookData);
            _settle(request.key.currency0, request.payer);
            _settle(request.key.currency1, request.payer);
            return abi.encode(delta);
        }

        (PoolKey memory key, ModifyLiquidityParams memory params) =
            abi.decode(payload, (PoolKey, ModifyLiquidityParams));
        manager.modifyLiquidity(key, params, bytes(""));
        return bytes("");
    }

    function _settle(Currency currency, address payer) private {
        int256 delta = manager.currencyDelta(address(this), currency);
        if (delta < 0) currency.settle(manager, payer, uint256(-delta), false);
        else if (delta > 0) currency.take(manager, payer, uint256(delta), false);
    }
}

contract CoordinatorSafetyHarness is ArbFoldCoordinator {
    constructor(IPoolManager manager_, Currency tokenA_, Currency tokenB_, Currency tokenC_)
        ArbFoldCoordinator(manager_, tokenA_, tokenB_, tokenC_)
    {}

    function assertNonDecreasing(CycleMath.Network memory beforeState, CycleMath.Network memory afterState)
        external
        pure
    {
        _assertNonDecreasing(beforeState, afterState);
    }

    function assertConservation(
        CycleMath.Network memory beforeState,
        CycleMath.Network memory afterState,
        uint256 reward
    ) external pure {
        _assertConservation(beforeState, afterState, reward);
    }
}

contract ArbFoldNegativePathsTest is ArbFoldTestBase {
    using TransientStateLibrary for IPoolManager;

    RawPoolManagerCaller private rawCaller;

    function setUp() public override {
        super.setUp();
        rawCaller = new RawPoolManagerCaller(manager);
        tokenAContract.approve(address(rawCaller), type(uint256).max);
        tokenBContract.approve(address(rawCaller), type(uint256).max);
        tokenCContract.approve(address(rawCaller), type(uint256).max);
    }

    function test_RouterRejectsZeroInput() public {
        vm.expectRevert(ArbFoldRouter.InvalidAmount.selector);
        router.swapExactInput(hookAB, false, 0, 0, solver, block.timestamp);
    }

    function test_RouterRejectsInputAboveSignedDomain() public {
        vm.expectRevert(ArbFoldRouter.InvalidAmount.selector);
        router.swapExactInput(hookAB, false, uint256(type(int256).max) + 1, 0, solver, block.timestamp);
    }

    function test_RouterRejectsZeroSolver() public {
        vm.expectRevert(ArbFoldRouter.InvalidSolver.selector);
        router.swapExactInput(hookAB, false, 1 ether, 0, address(0), block.timestamp);
    }

    function test_RouterRejectsUnregisteredHook() public {
        vm.expectRevert(ArbFoldRouter.UnregisteredHook.selector);
        router.swapExactInput(ArbFoldHook(address(0xBEEF)), false, 1 ether, 0, solver, block.timestamp);
    }

    function test_RouterUnlockCallbackRejectsDirectCaller() public {
        vm.expectRevert(ArbFoldRouter.NotPoolManager.selector);
        router.unlockCallback(bytes(""));
    }

    function test_RouterUnlockCallbackRejectsMalformedManagerPayload() public {
        vm.prank(address(manager));
        vm.expectRevert();
        router.unlockCallback(hex"01");
    }

    function test_SuccessAndFailureLeaveNoRouterCurrencyDeltas() public {
        router.swapExactInput(hookAB, false, 10_000 ether, 0, solver, block.timestamp);
        _assertRouterDeltasZero();

        vm.expectRevert();
        router.swapExactInput(hookAB, false, 10_000 ether, type(uint128).max, solver, block.timestamp);
        _assertRouterDeltasZero();
    }

    function test_HookRejectsExactOutput() public {
        PoolKey memory key = hookAB.poolKey();
        vm.expectRevert(
            _wrappedHookError(address(hookAB), IHooks.beforeSwap.selector, ArbFoldHook.ExactInputOnly.selector)
        );
        rawCaller.rawSwap(address(this), key, _params(false, int256(1 ether)), bytes(""));
    }

    function test_HookRejectsMalformedHookDataAtomically() public {
        PoolKey memory key = hookAB.poolKey();
        CycleMath.Network memory beforeNetwork = coordinator.network();
        vm.expectRevert();
        rawCaller.rawSwap(address(this), key, _params(false, -int256(1 ether)), hex"01");
        assertEq(keccak256(abi.encode(coordinator.network())), keccak256(abi.encode(beforeNetwork)));
    }

    function test_HookRejectsWrongFoldMode() public {
        PoolKey memory key = hookAB.poolKey();
        vm.expectRevert(
            _wrappedHookError(address(hookAB), IHooks.beforeSwap.selector, ArbFoldHook.InvalidHookData.selector)
        );
        rawCaller.rawSwap(address(this), key, _params(false, -int256(1 ether)), abi.encode(bytes4(0xDEADBEEF), solver));
    }

    function test_HookRejectsZeroSolverInHookData() public {
        PoolKey memory key = hookAB.poolKey();
        bytes memory hookData = abi.encode(hookAB.FOLD_MODE(), address(0));
        vm.expectRevert(
            _wrappedHookError(address(hookAB), IHooks.beforeSwap.selector, ArbFoldHook.InvalidHookData.selector)
        );
        rawCaller.rawSwap(address(this), key, _params(false, -int256(1 ether)), hookData);
    }

    function test_EmptyHookDataExecutesPlainSwapWithoutFold() public {
        uint256 callsBefore = coordinator.totalFoldCalls();
        rawCaller.rawSwap(address(this), hookAB.poolKey(), _params(false, -int256(1 ether)), bytes(""));
        assertEq(coordinator.totalFoldCalls(), callsBefore);
        _assertClaimsMatchReserves();
        _assertBacking();
    }

    function test_UnauthorizedReserveUpdateReverts() public {
        vm.expectRevert(ArbFoldHook.NotCoordinator.selector);
        hookAB.setReservesFromCoordinator(1, 1);
    }

    function test_CoordinatorReserveUpdateRejectsZero() public {
        vm.prank(address(coordinator));
        vm.expectRevert(ArbFoldHook.InvalidReserves.selector);
        hookAB.setReservesFromCoordinator(0, 1);
    }

    function test_CoordinatorAuthorizationIsIdempotent() public {
        hookAB.authorizeCoordinator();
        hookAB.authorizeCoordinator();
        assertTrue(manager.isOperator(address(hookAB), address(coordinator)));
    }

    function test_SecondInitialFundingReverts() public {
        vm.expectRevert(ArbFoldHook.AlreadyFunded.selector);
        hookAB.addLiquidity(_addLiquidity(1 ether, 1 ether));
    }

    function test_ZeroSidedAndOversizedInitialFundingRevert() public {
        ArbFoldHook fresh = _mineAndDeploy(new ArbFoldHookDeployer());
        PoolKey memory key = PoolKey({
            currency0: tokenA,
            currency1: tokenB,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(fresh))
        });
        manager.initialize(key, SQRT_PRICE_1_1);
        tokenAContract.approve(address(fresh), type(uint256).max);
        tokenBContract.approve(address(fresh), type(uint256).max);

        vm.expectRevert();
        fresh.addLiquidity(_addLiquidity(0, 1 ether));

        vm.expectRevert();
        fresh.addLiquidity(_addLiquidity(1 ether, 0));

        vm.expectRevert();
        fresh.addLiquidity(_addLiquidity(CycleMath.MAX_INITIAL_RESERVE + 1, 1 ether));
    }

    function test_HookRejectsSwapOutsideDocumentedDomain() public {
        PoolKey memory key = hookAB.poolKey();
        vm.expectRevert(
            _wrappedHookError(address(hookAB), IHooks.beforeSwap.selector, ArbFoldHook.UnsupportedAmount.selector)
        );
        rawCaller.rawSwap(address(this), key, _params(false, -int256(CycleMath.MAX_SWAP_INPUT + 1)), bytes(""));
    }

    function test_HookRejectsReserveGrowthAndDepletionOutsideDomain() public {
        uint256 snapshot = vm.snapshotState();
        _expectSwapAfterReserveOverride(CycleMath.MAX_NETWORK_RESERVE, CycleMath.MIN_NETWORK_RESERVE, true, 1);
        assertTrue(vm.revertToState(snapshot));

        _expectSwapAfterReserveOverride(CycleMath.MIN_NETWORK_RESERVE, CycleMath.MAX_NETWORK_RESERVE, false, 1);
        assertTrue(vm.revertToState(snapshot));

        _expectSwapAfterReserveOverride(
            CycleMath.MIN_NETWORK_RESERVE, CycleMath.MIN_NETWORK_RESERVE, true, CycleMath.MAX_SWAP_INPUT
        );
        assertTrue(vm.revertToState(snapshot));

        _expectSwapAfterReserveOverride(
            CycleMath.MIN_NETWORK_RESERVE, CycleMath.MIN_NETWORK_RESERVE, false, CycleMath.MAX_SWAP_INPUT
        );
        assertTrue(vm.revertToState(snapshot));
    }

    function test_DirectPoolManagerLiquidityModificationReverts() public {
        PoolKey memory key = hookAB.poolKey();
        vm.expectRevert(
            _wrappedHookError(
                address(hookAB), IHooks.beforeAddLiquidity.selector, BaseCustomAccounting.LiquidityOnlyViaHook.selector
            )
        );
        rawCaller.directModify(
            key, ModifyLiquidityParams({tickLower: MIN_TICK, tickUpper: MAX_TICK, liquidityDelta: 1, salt: bytes32(0)})
        );
    }

    function test_PartialWithdrawalCannotLeaveSubDomainDust() public {
        uint256 shares = hookAB.totalSupply() - 1;
        vm.expectRevert();
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

    function test_FullWithdrawalIsAOneWayResearchShutdownForOriginPool() public {
        hookAB.removeLiquidity(
            BaseCustomAccounting.RemoveLiquidityParams({
                liquidity: hookAB.balanceOf(address(this)),
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp,
                tickLower: MIN_TICK,
                tickUpper: MAX_TICK,
                userInputSalt: bytes32(0)
            })
        );
        (uint256 reserve0, uint256 reserve1) = hookAB.reserves();
        assertEq(reserve0, 0);
        assertEq(reserve1, 0);
        _assertClaimsMatchReserves();
        _assertBacking();

        vm.expectRevert(
            _wrappedHookError(address(hookAB), IHooks.beforeSwap.selector, CycleMath.ArithmeticDomain.selector)
        );
        router.swapExactInput(hookAB, false, 1 ether, 0, solver, block.timestamp);

        vm.expectRevert(ArbFoldHook.AlreadyFunded.selector);
        hookAB.addLiquidity(_addLiquidity(1 ether, 1 ether));
    }

    function test_CoordinatorRejectsNonAdminConfiguration() public {
        ArbFoldCoordinator fresh = new ArbFoldCoordinator(manager, tokenA, tokenB, tokenC);
        vm.prank(makeAddr("not-admin"));
        vm.expectRevert(ArbFoldCoordinator.NotAdmin.selector);
        fresh.configureHooks(
            IArbFoldHook(address(hookAB)), IArbFoldHook(address(hookBC)), IArbFoldHook(address(hookAC))
        );
    }

    function test_InvalidConstructorsAndUnconfiguredNetworkRevert() public {
        vm.expectRevert(ArbFoldCoordinator.InvalidHookConfiguration.selector);
        new ArbFoldCoordinator(IPoolManager(address(0)), tokenA, tokenB, tokenC);

        ArbFoldCoordinator fresh = new ArbFoldCoordinator(manager, tokenA, tokenB, tokenC);
        vm.expectRevert(ArbFoldCoordinator.NotConfigured.selector);
        fresh.network();

        ArbFoldHookDeployer deployer = new ArbFoldHookDeployer();
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        bytes memory constructorArgs = abi.encode(manager, address(0));
        vm.pauseGasMetering();
        (, bytes32 salt) = HookMiner.find(address(deployer), flags, type(ArbFoldHook).creationCode, constructorArgs);
        vm.resumeGasMetering();
        vm.expectRevert(ArbFoldHook.NotCoordinator.selector);
        deployer.deploy(manager, address(0), salt);
    }

    function test_CoordinatorRejectsZeroAndDuplicateHooks() public {
        ArbFoldCoordinator fresh = new ArbFoldCoordinator(manager, tokenA, tokenB, tokenC);
        vm.expectRevert(ArbFoldCoordinator.InvalidHookConfiguration.selector);
        fresh.configureHooks(IArbFoldHook(address(0)), IArbFoldHook(address(hookBC)), IArbFoldHook(address(hookAC)));

        fresh = new ArbFoldCoordinator(manager, tokenA, tokenB, tokenC);
        vm.expectRevert(ArbFoldCoordinator.InvalidHookConfiguration.selector);
        fresh.configureHooks(
            IArbFoldHook(address(hookAB)), IArbFoldHook(address(hookAB)), IArbFoldHook(address(hookAC))
        );
    }

    function test_CoordinatorRejectsCodeLessAndWrongCoordinatorHooks() public {
        ArbFoldCoordinator fresh = new ArbFoldCoordinator(manager, tokenA, tokenB, tokenC);
        vm.expectRevert(ArbFoldCoordinator.InvalidHookConfiguration.selector);
        fresh.configureHooks(
            IArbFoldHook(makeAddr("code-less")), IArbFoldHook(address(hookBC)), IArbFoldHook(address(hookAC))
        );

        fresh = new ArbFoldCoordinator(manager, tokenA, tokenB, tokenC);
        vm.expectRevert(ArbFoldCoordinator.InvalidHookConfiguration.selector);
        fresh.configureHooks(
            IArbFoldHook(address(hookAB)), IArbFoldHook(address(hookBC)), IArbFoldHook(address(hookAC))
        );
    }

    function test_CoordinatorRejectsZeroSolverEvenFromHook() public {
        vm.prank(address(hookAB));
        vm.expectRevert(ArbFoldCoordinator.InvalidSolver.selector);
        coordinator.fold(address(0));
    }

    function test_NoArbitrageFoldIsARecordedZeroRoundNoOp() public {
        assertEq(coordinator.quote().profitA, 0);
        vm.prank(address(hookAB));
        coordinator.fold(solver);
        assertEq(coordinator.totalFoldCalls(), 1);
        assertEq(coordinator.totalFoldRounds(), 0);
        assertEq(coordinator.lastResidualProfit(), 0);
        _assertClaimsMatchReserves();
        _assertBacking();
    }

    function test_CycleMathSelectsForwardAndReverseDirections() public pure {
        CycleMath.Network memory forward = CycleMath.Network({
            abA: 100 ether, abB: 200 ether, bcB: 100 ether, bcC: 200 ether, acA: 100 ether, acC: 100 ether
        });
        CycleMath.Network memory reverse = CycleMath.Network({
            abA: 200 ether, abB: 100 ether, bcB: 200 ether, bcC: 100 ether, acA: 100 ether, acC: 100 ether
        });
        assertFalse(CycleMath.best(forward).reverse);
        assertGt(CycleMath.best(forward).profitA, 0);
        assertTrue(CycleMath.best(reverse).reverse);
        assertGt(CycleMath.best(reverse).profitA, 0);
    }

    function test_CoordinatorSafetyChecksRejectInvariantAndEveryConservationDrift() public {
        CoordinatorSafetyHarness harness = new CoordinatorSafetyHarness(manager, tokenA, tokenB, tokenC);
        CycleMath.Network memory beforeState = CycleMath.Network({
            abA: 100 ether, abB: 100 ether, bcB: 100 ether, bcC: 100 ether, acA: 100 ether, acC: 100 ether
        });

        CycleMath.Network memory afterState = _copyNetwork(beforeState);
        afterState.abA -= 1;
        vm.expectRevert(ArbFoldCoordinator.InvariantDecreased.selector);
        harness.assertNonDecreasing(beforeState, afterState);

        afterState = _copyNetwork(beforeState);
        harness.assertNonDecreasing(beforeState, afterState);
        harness.assertConservation(beforeState, afterState, 0);

        afterState.abA -= 1;
        vm.expectRevert(
            abi.encodeWithSelector(ArbFoldCoordinator.ConservationFailed.selector, uint8(0), 200 ether, 200 ether - 1)
        );
        harness.assertConservation(beforeState, afterState, 0);

        afterState = _copyNetwork(beforeState);
        afterState.abB -= 1;
        vm.expectRevert(
            abi.encodeWithSelector(ArbFoldCoordinator.ConservationFailed.selector, uint8(1), 200 ether, 200 ether - 1)
        );
        harness.assertConservation(beforeState, afterState, 0);

        afterState = _copyNetwork(beforeState);
        afterState.bcC -= 1;
        vm.expectRevert(
            abi.encodeWithSelector(ArbFoldCoordinator.ConservationFailed.selector, uint8(2), 200 ether, 200 ether - 1)
        );
        harness.assertConservation(beforeState, afterState, 0);
    }

    function _params(bool zeroForOne, int256 amountSpecified) private pure returns (SwapParams memory) {
        return SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: amountSpecified,
            sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
        });
    }

    function _wrappedHookError(address hook, bytes4 callbackSelector, bytes4 reasonSelector)
        private
        pure
        returns (bytes memory)
    {
        return abi.encodeWithSelector(
            CustomRevert.WrappedError.selector,
            hook,
            callbackSelector,
            abi.encodePacked(reasonSelector),
            abi.encodePacked(Hooks.HookCallFailed.selector)
        );
    }

    function _expectSwapAfterReserveOverride(uint256 reserve0, uint256 reserve1, bool zeroForOne, uint256 amountIn)
        private
    {
        vm.prank(address(coordinator));
        hookAB.setReservesFromCoordinator(reserve0, reserve1);
        PoolKey memory key = hookAB.poolKey();
        vm.expectRevert(
            _wrappedHookError(address(hookAB), IHooks.beforeSwap.selector, ArbFoldHook.UnsupportedAmount.selector)
        );
        rawCaller.rawSwap(address(this), key, _params(zeroForOne, -int256(amountIn)), bytes(""));
    }

    function _copyNetwork(CycleMath.Network memory network) private pure returns (CycleMath.Network memory) {
        return CycleMath.Network({
            abA: network.abA, abB: network.abB, bcB: network.bcB, bcC: network.bcC, acA: network.acA, acC: network.acC
        });
    }

    function _addLiquidity(uint256 amount0, uint256 amount1)
        private
        view
        returns (BaseCustomAccounting.AddLiquidityParams memory)
    {
        return BaseCustomAccounting.AddLiquidityParams({
            amount0Desired: amount0,
            amount1Desired: amount1,
            amount0Min: 0,
            amount1Min: 0,
            deadline: block.timestamp,
            tickLower: MIN_TICK,
            tickUpper: MAX_TICK,
            userInputSalt: bytes32(0)
        });
    }

    function _assertRouterDeltasZero() private view {
        assertEq(manager.currencyDelta(address(router), tokenA), 0);
        assertEq(manager.currencyDelta(address(router), tokenB), 0);
        assertEq(manager.currencyDelta(address(router), tokenC), 0);
    }
}
