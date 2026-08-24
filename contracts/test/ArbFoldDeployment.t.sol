// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {DeployArbFold} from "../script/DeployArbFold.s.sol";
import {VerifyArbFoldDeployment} from "../script/VerifyArbFoldDeployment.s.sol";

contract DeployArbFoldHarness is DeployArbFold {
    function deployLocal() external returns (Deployment memory) {
        return _deploy(address(this), false, IPoolManager(address(0)));
    }

    function deployExisting(IPoolManager manager) external returns (Deployment memory) {
        return _deploy(address(this), true, manager);
    }
}

contract ArbFoldDeploymentTest is Test {
    DeployArbFoldHarness private deployer;
    VerifyArbFoldDeployment private verifier;

    function setUp() public {
        deployer = new DeployArbFoldHarness();
        verifier = new VerifyArbFoldDeployment();
    }

    function test_LocalDeploymentAndManifestPassVerification() public {
        DeployArbFold.Deployment memory deployment = deployer.deployLocal();
        verifier.verify(_addresses(deployment));

        string memory manifest = deployer.deploymentJson(address(deployer), deployment);
        assertEq(vm.parseJsonUint(manifest, ".chainId"), block.chainid);
        assertEq(vm.parseJsonAddress(manifest, ".poolManager"), address(deployment.manager));
        assertEq(vm.parseJsonAddress(manifest, ".hooks.ab"), address(deployment.hookAB));
        assertEq(vm.parseJsonAddress(manifest, ".tokens.c"), address(deployment.tokenC));
        assertFalse(vm.parseJsonBool(manifest, ".usesExistingManager"));
        assertTrue(vm.parseJsonBool(manifest, ".researchOnly"));
    }

    function test_ExistingManagerDeploymentPassesVerification() public {
        IPoolManager manager = IPoolManager(address(new PoolManager(address(this))));
        DeployArbFold.Deployment memory deployment = deployer.deployExisting(manager);

        assertEq(address(deployment.manager), address(manager));
        assertTrue(deployment.usesExistingManager);
        verifier.verify(_addresses(deployment));
    }

    function test_ExistingManagerRejectsZeroAddress() public {
        vm.expectRevert(DeployArbFold.ExternalManagerRequired.selector);
        deployer.deployExisting(IPoolManager(address(0)));
    }

    function test_ExistingManagerRejectsCodeLessAddress() public {
        address noCode = makeAddr("no-code-manager");
        vm.expectRevert(abi.encodeWithSelector(DeployArbFold.ExternalManagerHasNoCode.selector, noCode));
        deployer.deployExisting(IPoolManager(noCode));
    }

    function test_VerifierRejectsWrongTokenBinding() public {
        DeployArbFold.Deployment memory deployment = deployer.deployLocal();
        VerifyArbFoldDeployment.Addresses memory addresses = _addresses(deployment);
        addresses.tokenA = address(deployment.tokenB);
        vm.expectRevert(
            abi.encodeWithSelector(VerifyArbFoldDeployment.InvalidDeployment.selector, bytes32("token-binding"))
        );
        verifier.verify(addresses);
    }

    function _addresses(DeployArbFold.Deployment memory deployment)
        private
        pure
        returns (VerifyArbFoldDeployment.Addresses memory)
    {
        return VerifyArbFoldDeployment.Addresses({
            manager: deployment.manager,
            coordinator: deployment.coordinator,
            hookAB: deployment.hookAB,
            hookBC: deployment.hookBC,
            hookAC: deployment.hookAC,
            router: deployment.router,
            tokenA: address(deployment.tokenA),
            tokenB: address(deployment.tokenB),
            tokenC: address(deployment.tokenC),
            solver: address(0)
        });
    }
}
