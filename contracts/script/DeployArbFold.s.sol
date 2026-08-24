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

/// @notice Deploys the complete research network against either a fresh or supplied PoolManager.
/// @dev Demo tokens are permissionlessly mintable and have no economic value.
contract DeployArbFold is Script {
    using CurrencyLibrary for Currency;

    string public constant DEPENDENCY_COMMIT = "12048bb17b93ad9ed683aff9c34b89596280c77d";
    uint160 public constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint24 public constant DYNAMIC_FEE = LPFeeLibrary.DYNAMIC_FEE_FLAG;
    int24 public constant TICK_SPACING = 60;
    uint256 public constant A_RESERVE = 333_333333333333333333;
    uint256 public constant QUOTE_RESERVE = 1_000_000 ether;
    int24 public constant MIN_TICK = -887220;
    int24 public constant MAX_TICK = 887220;

    error ExternalManagerRequired();
    error ExternalManagerHasNoCode(address manager);
    error HookPermissionMismatch(address hook);
    error ManifestPathRequired();
    error UnexpectedChain(uint256 expected, uint256 actual);

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
        bool usesExistingManager;
    }

    /// @notice Environment-driven entry point used for local simulation and public testnet broadcasts.
    /// @dev Set USE_EXISTING_MANAGER=true and POOL_MANAGER for the official-manager path.
    function run() external returns (Deployment memory deployment) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        bool useExistingManager = vm.envOr("USE_EXISTING_MANAGER", false);
        address suppliedManager = vm.envOr("POOL_MANAGER", address(0));
        uint256 expectedChainId = vm.envOr("EXPECTED_CHAIN_ID", block.chainid);

        if (block.chainid != expectedChainId) revert UnexpectedChain(expectedChainId, block.chainid);
        if (useExistingManager) _requireExternalManager(suppliedManager);

        vm.startBroadcast(privateKey);
        deployment = _deploy(deployer, useExistingManager, IPoolManager(suppliedManager));
        vm.stopBroadcast();

        _validateDeployment(deployment);
        _logDeployment(deployer, deployment);

        string memory manifest = deploymentJson(deployer, deployment);
        console2.log("ARBFOLD manifest", manifest);
        if (vm.envOr("WRITE_MANIFEST", false)) {
            string memory path = vm.envOr("MANIFEST_PATH", string(""));
            if (bytes(path).length == 0) revert ManifestPathRequired();
            vm.writeJson(manifest, path);
            console2.log("ARBFOLD manifest path", path);
        }
    }

    /// @dev Internal entry point exposed through the test harness without changing production contracts.
    function _deploy(address liquidityProvider, bool useExistingManager, IPoolManager suppliedManager)
        internal
        returns (Deployment memory deployment)
    {
        if (useExistingManager) {
            _requireExternalManager(address(suppliedManager));
            deployment.manager = suppliedManager;
        } else {
            deployment.manager = IPoolManager(address(new PoolManager(liquidityProvider)));
        }
        deployment.usesExistingManager = useExistingManager;

        (deployment.tokenA, deployment.tokenB, deployment.tokenC) = _deploySortedTokens();
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

        deployment.tokenA.mint(liquidityProvider, 20_000_000 ether);
        deployment.tokenB.mint(liquidityProvider, 20_000_000 ether);
        deployment.tokenC.mint(liquidityProvider, 20_000_000 ether);

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
    }

    function deploymentJson(address deployer, Deployment memory deployment) public returns (string memory json) {
        string memory network = vm.envOr("NETWORK_NAME", string("local-research"));
        string memory gitCommit = vm.envOr("GIT_COMMIT", string("working-tree"));
        string memory explorer = vm.envOr("EXPLORER_BASE_URL", string(""));
        address officialManager = vm.envOr("OFFICIAL_POOL_MANAGER", address(0));

        string[] memory noTransactions = new string[](0);
        string memory root = "arbfold-deployment";
        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeString(root, "network", network);
        vm.serializeString(root, "gitCommit", gitCommit);
        vm.serializeString(root, "dependencyCommit", DEPENDENCY_COMMIT);
        vm.serializeAddress(root, "officialPoolManager", officialManager);
        vm.serializeAddress(root, "poolManager", address(deployment.manager));
        vm.serializeBool(root, "usesExistingManager", deployment.usesExistingManager);
        vm.serializeAddress(root, "deployer", deployer);
        vm.serializeAddress(root, "coordinator", address(deployment.coordinator));
        vm.serializeAddress(root, "router", address(deployment.router));
        vm.serializeJsonType(
            root,
            "hooks",
            "Hooks(address ab,address bc,address ac)",
            abi.encode(address(deployment.hookAB), address(deployment.hookBC), address(deployment.hookAC))
        );
        vm.serializeJsonType(
            root,
            "tokens",
            "Tokens(address a,address b,address c)",
            abi.encode(address(deployment.tokenA), address(deployment.tokenB), address(deployment.tokenC))
        );
        vm.serializeString(root, "deploymentTransactions", noTransactions);
        vm.serializeString(root, "canonicalDemoTransaction", "pending");
        vm.serializeUint(root, "blockNumber", block.number);
        vm.serializeString(root, "explorerBaseUrl", explorer);
        vm.serializeString(root, "sourceVerification", "not-available");
        json = vm.serializeBool(root, "researchOnly", true);
    }

    function _mineAndDeploy(ArbFoldHookDeployer hookDeployer, IPoolManager manager, ArbFoldCoordinator coordinator)
        private
        returns (ArbFoldHook hook)
    {
        uint160 flags = _requiredHookFlags();
        bytes memory args = abi.encode(manager, address(coordinator));
        (address expected, bytes32 salt) =
            HookMiner.find(address(hookDeployer), flags, type(ArbFoldHook).creationCode, args);
        hook = hookDeployer.deploy(manager, address(coordinator), salt);
        if (address(hook) != expected) revert HookPermissionMismatch(address(hook));
        _validateHookPermissions(hook);
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
        DemoToken x = new DemoToken("ARBFOLD Research Token X", "ARFX");
        DemoToken y = new DemoToken("ARBFOLD Research Token Y", "ARFY");
        DemoToken z = new DemoToken("ARBFOLD Research Token Z", "ARFZ");
        address[3] memory values = [address(x), address(y), address(z)];
        if (values[0] > values[1]) (values[0], values[1]) = (values[1], values[0]);
        if (values[1] > values[2]) (values[1], values[2]) = (values[2], values[1]);
        if (values[0] > values[1]) (values[0], values[1]) = (values[1], values[0]);
        return (DemoToken(values[0]), DemoToken(values[1]), DemoToken(values[2]));
    }

    function _validateDeployment(Deployment memory deployment) private view {
        _validateHookPermissions(deployment.hookAB);
        _validateHookPermissions(deployment.hookBC);
        _validateHookPermissions(deployment.hookAC);
        if (
            !deployment.coordinator.configured() || !deployment.coordinator.isHook(address(deployment.hookAB))
                || !deployment.coordinator.isHook(address(deployment.hookBC))
                || !deployment.coordinator.isHook(address(deployment.hookAC))
        ) revert HookPermissionMismatch(address(0));
    }

    function _validateHookPermissions(ArbFoldHook hook) private pure {
        Hooks.validateHookPermissions(hook, hook.getHookPermissions());
        if ((uint160(address(hook)) & Hooks.ALL_HOOK_MASK) != _requiredHookFlags()) {
            revert HookPermissionMismatch(address(hook));
        }
    }

    function _requiredHookFlags() private pure returns (uint160) {
        return uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
    }

    function _requireExternalManager(address managerAddress) private view {
        if (managerAddress == address(0)) revert ExternalManagerRequired();
        if (managerAddress.code.length == 0) revert ExternalManagerHasNoCode(managerAddress);
    }

    function _logDeployment(address deployer, Deployment memory deployment) private view {
        console2.log("ARBFOLD chain ID", block.chainid);
        console2.log("ARBFOLD deployer", deployer);
        console2.log("ARBFOLD dependency commit", DEPENDENCY_COMMIT);
        console2.log("ARBFOLD existing PoolManager", deployment.usesExistingManager);
        console2.log("ARBFOLD PoolManager", address(deployment.manager));
        console2.log("ARBFOLD Coordinator", address(deployment.coordinator));
        console2.log("ARBFOLD Hook AB", address(deployment.hookAB));
        console2.log("ARBFOLD Hook BC", address(deployment.hookBC));
        console2.log("ARBFOLD Hook AC", address(deployment.hookAC));
        console2.log("ARBFOLD Router", address(deployment.router));
        console2.log("ARBFOLD Token A", address(deployment.tokenA));
        console2.log("ARBFOLD Token B", address(deployment.tokenB));
        console2.log("ARBFOLD Token C", address(deployment.tokenC));
    }
}
