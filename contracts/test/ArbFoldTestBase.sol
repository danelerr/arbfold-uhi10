// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BaseCustomAccounting} from "@openzeppelin/uniswap-hooks/base/BaseCustomAccounting.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {ArbFoldCoordinator} from "../src/ArbFoldCoordinator.sol";
import {ArbFoldHook} from "../src/ArbFoldHook.sol";
import {ArbFoldHookDeployer} from "../src/ArbFoldHookDeployer.sol";
import {ArbFoldRouter} from "../src/ArbFoldRouter.sol";
import {CycleMath} from "../src/CycleMath.sol";
import {DemoToken} from "../src/DemoToken.sol";
import {IArbFoldHook, IArbFoldCoordinator} from "../src/IArbFold.sol";

abstract contract ArbFoldTestBase is Test {
    using CurrencyLibrary for Currency;

    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint24 internal constant DYNAMIC_FEE = LPFeeLibrary.DYNAMIC_FEE_FLAG;
    int24 internal constant TICK_SPACING = 60;
    uint256 internal constant A_RESERVE = 333_333333333333333333;
    uint256 internal constant QUOTE_RESERVE = 1_000_000 ether;
    int24 internal constant MIN_TICK = -887220;
    int24 internal constant MAX_TICK = 887220;

    IPoolManager internal manager;
    ArbFoldCoordinator internal coordinator;
    ArbFoldHook internal hookAB;
    ArbFoldHook internal hookBC;
    ArbFoldHook internal hookAC;
    ArbFoldRouter internal router;
    DemoToken internal tokenAContract;
    DemoToken internal tokenBContract;
    DemoToken internal tokenCContract;
    Currency internal tokenA;
    Currency internal tokenB;
    Currency internal tokenC;
    address internal solver;

    function setUp() public virtual {
        solver = makeAddr("solver");
        _deploySortedTokens();
        manager = IPoolManager(address(new PoolManager(address(this))));
        coordinator = new ArbFoldCoordinator(manager, tokenA, tokenB, tokenC);

        ArbFoldHookDeployer hookDeployer = new ArbFoldHookDeployer();
        hookAB = _mineAndDeploy(hookDeployer);
        hookBC = _mineAndDeploy(hookDeployer);
        hookAC = _mineAndDeploy(hookDeployer);

        tokenAContract.mint(address(this), 20_000_000 ether);
        tokenBContract.mint(address(this), 20_000_000 ether);
        tokenCContract.mint(address(this), 20_000_000 ether);

        _initialize(hookAB, tokenA, tokenB, A_RESERVE, QUOTE_RESERVE);
        _initialize(hookBC, tokenB, tokenC, QUOTE_RESERVE, QUOTE_RESERVE);
        _initialize(hookAC, tokenA, tokenC, A_RESERVE, QUOTE_RESERVE);
        coordinator.configureHooks(
            IArbFoldHook(address(hookAB)), IArbFoldHook(address(hookBC)), IArbFoldHook(address(hookAC))
        );

        router = new ArbFoldRouter(manager, IArbFoldCoordinator(address(coordinator)));
        tokenAContract.approve(address(router), type(uint256).max);
        tokenBContract.approve(address(router), type(uint256).max);
        tokenCContract.approve(address(router), type(uint256).max);
    }

    function _mineAndDeploy(ArbFoldHookDeployer deployer) private returns (ArbFoldHook hook) {
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        bytes memory constructorArgs = abi.encode(manager, address(coordinator));
        (address expected, bytes32 salt) =
            HookMiner.find(address(deployer), flags, type(ArbFoldHook).creationCode, constructorArgs);
        hook = deployer.deploy(manager, address(coordinator), salt);
        assertEq(address(hook), expected, "mined hook address mismatch");
        Hooks.validateHookPermissions(hook, hook.getHookPermissions());
    }

    function _initialize(ArbFoldHook hook, Currency currency0, Currency currency1, uint256 reserve0, uint256 reserve1)
        private
    {
        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: DYNAMIC_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(hook))
        });
        manager.initialize(key, SQRT_PRICE_1_1);
        DemoToken(Currency.unwrap(currency0)).approve(address(hook), type(uint256).max);
        DemoToken(Currency.unwrap(currency1)).approve(address(hook), type(uint256).max);
        hook.addLiquidity(
            BaseCustomAccounting.AddLiquidityParams({
                amount0Desired: reserve0,
                amount1Desired: reserve1,
                amount0Min: reserve0,
                amount1Min: reserve1,
                deadline: type(uint256).max,
                tickLower: MIN_TICK,
                tickUpper: MAX_TICK,
                userInputSalt: bytes32(0)
            })
        );
        hook.authorizeCoordinator();
    }

    function _deploySortedTokens() private {
        DemoToken x = new DemoToken("Token X", "X");
        DemoToken y = new DemoToken("Token Y", "Y");
        DemoToken z = new DemoToken("Token Z", "Z");
        address[3] memory values = [address(x), address(y), address(z)];
        if (values[0] > values[1]) (values[0], values[1]) = (values[1], values[0]);
        if (values[1] > values[2]) (values[1], values[2]) = (values[2], values[1]);
        if (values[0] > values[1]) (values[0], values[1]) = (values[1], values[0]);
        tokenAContract = DemoToken(values[0]);
        tokenBContract = DemoToken(values[1]);
        tokenCContract = DemoToken(values[2]);
        tokenA = Currency.wrap(values[0]);
        tokenB = Currency.wrap(values[1]);
        tokenC = Currency.wrap(values[2]);
    }

    function _assertClaimsMatchReserves() internal view {
        CycleMath.Network memory n = coordinator.network();
        assertEq(manager.balanceOf(address(hookAB), tokenA.toId()), n.abA, "AB token A claim drift");
        assertEq(manager.balanceOf(address(hookAB), tokenB.toId()), n.abB, "AB token B claim drift");
        assertEq(manager.balanceOf(address(hookBC), tokenB.toId()), n.bcB, "BC token B claim drift");
        assertEq(manager.balanceOf(address(hookBC), tokenC.toId()), n.bcC, "BC token C claim drift");
        assertEq(manager.balanceOf(address(hookAC), tokenA.toId()), n.acA, "AC token A claim drift");
        assertEq(manager.balanceOf(address(hookAC), tokenC.toId()), n.acC, "AC token C claim drift");
    }

    function _assertBacking() internal view {
        CycleMath.Network memory n = coordinator.network();
        uint256 solverA = manager.balanceOf(solver, tokenA.toId());
        assertEq(tokenAContract.balanceOf(address(manager)), n.abA + n.acA + solverA, "token A backing drift");
        assertEq(tokenBContract.balanceOf(address(manager)), n.abB + n.bcB, "token B backing drift");
        assertEq(tokenCContract.balanceOf(address(manager)), n.bcC + n.acC, "token C backing drift");
    }

    function _assertNonDecreasing(CycleMath.Network memory beforeN, CycleMath.Network memory afterN) internal pure {
        assertGe(afterN.abA * afterN.abB, beforeN.abA * beforeN.abB, "AB invariant decreased");
        assertGe(afterN.bcB * afterN.bcC, beforeN.bcB * beforeN.bcC, "BC invariant decreased");
        assertGe(afterN.acA * afterN.acC, beforeN.acA * beforeN.acC, "AC invariant decreased");
    }
}
