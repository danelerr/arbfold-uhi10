// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
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
import {DemoToken} from "../src/DemoToken.sol";
import {IArbFoldHook, IArbFoldCoordinator} from "../src/IArbFold.sol";

/// @notice Deploys a complete research/demo network. It intentionally deploys demo tokens and a fresh PoolManager.
contract DeployArbFold is Script {
    using CurrencyLibrary for Currency;

    uint160 private constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint24 private constant DYNAMIC_FEE = LPFeeLibrary.DYNAMIC_FEE_FLAG;
    int24 private constant TICK_SPACING = 60;
    uint256 private constant A_RESERVE = 333_333333333333333333;
    uint256 private constant QUOTE_RESERVE = 1_000_000 ether;
    int24 private constant MIN_TICK = -887220;
    int24 private constant MAX_TICK = 887220;

    struct Deployment {
        IPoolManager manager;
        ArbFoldCoordinator coordinator;
        ArbFoldHook hookAB;
        ArbFoldHook hookBC;
        ArbFoldHook hookAC;
        ArbFoldRouter router;
        DemoToken tokenA;
        DemoToken tokenB;
        DemoToken tokenC;
    }

    function run() external returns (Deployment memory deployment) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        vm.startBroadcast(privateKey);

        (deployment.tokenA, deployment.tokenB, deployment.tokenC) = _deploySortedTokens();
        deployment.manager = IPoolManager(address(new PoolManager(deployer)));
        deployment.coordinator = new ArbFoldCoordinator(
            deployment.manager,
            Currency.wrap(address(deployment.tokenA)),
            Currency.wrap(address(deployment.tokenB)),
            Currency.wrap(address(deployment.tokenC))
        );
        ArbFoldHookDeployer hookDeployer = new ArbFoldHookDeployer();

        deployment.hookAB = _mineAndDeploy(hookDeployer, deployment.manager, deployment.coordinator);
        deployment.hookBC = _mineAndDeploy(hookDeployer, deployment.manager, deployment.coordinator);
        deployment.hookAC = _mineAndDeploy(hookDeployer, deployment.manager, deployment.coordinator);

        deployment.tokenA.mint(deployer, 20_000_000 ether);
        deployment.tokenB.mint(deployer, 20_000_000 ether);
        deployment.tokenC.mint(deployer, 20_000_000 ether);

        _initialize(
            deployment.manager,
            deployment.hookAB,
            Currency.wrap(address(deployment.tokenA)),
            Currency.wrap(address(deployment.tokenB)),
            A_RESERVE,
            QUOTE_RESERVE
        );
        _initialize(
            deployment.manager,
            deployment.hookBC,
            Currency.wrap(address(deployment.tokenB)),
            Currency.wrap(address(deployment.tokenC)),
            QUOTE_RESERVE,
            QUOTE_RESERVE
        );
        _initialize(
            deployment.manager,
            deployment.hookAC,
            Currency.wrap(address(deployment.tokenA)),
            Currency.wrap(address(deployment.tokenC)),
            A_RESERVE,
            QUOTE_RESERVE
        );

        deployment.coordinator
            .configureHooks(
                IArbFoldHook(address(deployment.hookAB)),
                IArbFoldHook(address(deployment.hookBC)),
                IArbFoldHook(address(deployment.hookAC))
            );
        deployment.router = new ArbFoldRouter(deployment.manager, IArbFoldCoordinator(address(deployment.coordinator)));
        vm.stopBroadcast();

        console2.log("ARBFOLD PoolManager", address(deployment.manager));
        console2.log("ARBFOLD Coordinator", address(deployment.coordinator));
        console2.log("ARBFOLD Hook AB", address(deployment.hookAB));
        console2.log("ARBFOLD Hook BC", address(deployment.hookBC));
        console2.log("ARBFOLD Hook AC", address(deployment.hookAC));
        console2.log("ARBFOLD Router", address(deployment.router));
    }

    function _mineAndDeploy(ArbFoldHookDeployer hookDeployer, IPoolManager manager, ArbFoldCoordinator coordinator)
        private
        returns (ArbFoldHook hook)
    {
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        bytes memory args = abi.encode(manager, address(coordinator));
        (address expected, bytes32 salt) =
            HookMiner.find(address(hookDeployer), flags, type(ArbFoldHook).creationCode, args);
        hook = hookDeployer.deploy(manager, address(coordinator), salt);
        require(address(hook) == expected, "ARBFOLD: mined hook mismatch");
    }

    function _initialize(
        IPoolManager manager,
        ArbFoldHook hook,
        Currency currency0,
        Currency currency1,
        uint256 reserve0,
        uint256 reserve1
    ) private {
        manager.initialize(
            PoolKey({
                currency0: currency0,
                currency1: currency1,
                fee: DYNAMIC_FEE,
                tickSpacing: TICK_SPACING,
                hooks: IHooks(address(hook))
            }),
            SQRT_PRICE_1_1
        );
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

    function _deploySortedTokens() private returns (DemoToken a, DemoToken b, DemoToken c) {
        DemoToken x = new DemoToken("ARBFOLD Token X", "AFX");
        DemoToken y = new DemoToken("ARBFOLD Token Y", "AFY");
        DemoToken z = new DemoToken("ARBFOLD Token Z", "AFZ");
        address[3] memory values = [address(x), address(y), address(z)];
        if (values[0] > values[1]) (values[0], values[1]) = (values[1], values[0]);
        if (values[1] > values[2]) (values[1], values[2]) = (values[2], values[1]);
        if (values[0] > values[1]) (values[0], values[1]) = (values[1], values[0]);
        return (DemoToken(values[0]), DemoToken(values[1]), DemoToken(values[2]));
    }
}

