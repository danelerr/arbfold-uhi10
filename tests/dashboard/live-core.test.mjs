import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSourceCreationReceipt,
  assertRuntimeBytecodeIdentity,
  assertNetworkSnapshot,
  bufferedGasLimit,
  networkChanged,
  normalizeNetwork,
  parseDemoAmount,
  reductionPercent,
  sourceVerificationTargets,
  validateManifest,
} from "../../app/live-core.js";

const address = "0x1111111111111111111111111111111111111111";
const transaction = `0x${"ab".repeat(32)}`;
const bytecodeHash = `0x${"cd".repeat(32)}`;
const txHash = (value) => `0x${value.toString(16).padStart(64, "0")}`;

function manifest() {
  const deploymentTransactions = Array.from({ length: 28 }, (_, index) => txHash(index + 1));
  const sourceContracts = {
    coordinator: "src/ArbFoldCoordinator.sol:ArbFoldCoordinator",
    hookAB: "src/ArbFoldHook.sol:ArbFoldHook",
    hookBC: "src/ArbFoldHook.sol:ArbFoldHook",
    hookAC: "src/ArbFoldHook.sol:ArbFoldHook",
    router: "src/ArbFoldRouter.sol:ArbFoldRouter",
    tokenA: "src/DemoToken.sol:DemoToken",
    tokenB: "src/DemoToken.sol:DemoToken",
    tokenC: "src/DemoToken.sol:DemoToken",
  };
  const sourceTargets = Object.fromEntries(Object.entries(sourceContracts).map(([key, contract], index) => [key, {
    address,
    contract,
    creationTransaction: deploymentTransactions[index],
    verifiedAt: "2026-09-02T12:00:00Z",
    creationMatch: "match",
    runtimeMatch: "match",
    repositoryUrl: `https://repo.sourcify.dev/1301/${address}`,
  }]));
  return {
    researchOnly: true,
    chainId: 1301,
    blockNumber: 1,
    demo: {
      amountIn: "1",
      amountOut: "1",
      chainId: 1301,
      foldRounds: 1,
      originHook: address,
      residualProfit: "0",
      solver: address,
      solverReward: "1",
      user: address,
      zeroForOne: false,
      preReserves: { abA: "1", abB: "1", bcB: "1", bcC: "1", acA: "1", acC: "1" },
      postReserves: { abA: "1", abB: "1", bcB: "1", bcC: "1", acA: "1", acC: "1" },
    },
    poolManager: "0x9cB26A7183B2F4515945Dc52CB4195B0d2D06C95",
    officialPoolManager: "0x9cB26A7183B2F4515945Dc52CB4195B0d2D06C95",
    coordinator: address,
    router: address,
    tokens: { a: address, b: address, c: address },
    hooks: { ab: address, bc: address, ac: address },
    canonicalDemoTransaction: transaction,
    deploymentTransactions,
    rpcSimulation: {
      account: address,
      allowanceBlock: 1,
      allowanceTransaction: transaction,
      maximumInput: "1",
    },
    runtimeBytecode: Object.fromEntries([
      "poolManager", "coordinator", "hookAB", "hookBC", "hookAC", "router", "tokenA", "tokenB", "tokenC",
    ].map((key) => [key, { bytes: 1, keccak256: bytecodeHash }])),
    sourceVerification: "verified",
    sourceVerificationEvidence: {
      schema: "sourcify-v2-match-v1",
      provider: "Sourcify",
      chainId: 1301,
      apiBaseUrl: "https://sourcify.dev/server/v2/contract",
      repositoryBaseUrl: "https://repo.sourcify.dev",
      checkedAt: "2026-09-02",
      targets: sourceTargets,
    },
  };
}

test("validateManifest accepts the committed deployment shape", () => {
  assert.equal(validateManifest(manifest()).chainId, 1301);
});

test("runtime bytecode identity requires the published size and hash", () => {
  const target = { key: "router", expected: { bytes: 1, keccak256: bytecodeHash } };
  assert.doesNotThrow(() => assertRuntimeBytecodeIdentity(target, "0x00", bytecodeHash));
  assert.throws(
    () => assertRuntimeBytecodeIdentity(target, "0x0000", bytecodeHash),
    /does not match/,
  );
  assert.throws(
    () => assertRuntimeBytecodeIdentity(target, "0x00", `0x${"ef".repeat(32)}`),
    /does not match/,
  );
  assert.throws(() => assertRuntimeBytecodeIdentity(target, "0x", bytecodeHash), /no deployed bytecode/);
});

test("source verification targets bind all eight active project contracts", () => {
  const targets = sourceVerificationTargets(validateManifest(manifest()));
  assert.equal(targets.length, 8);
  assert.deepEqual(targets.map(({ key }) => key), [
    "coordinator", "hookAB", "hookBC", "hookAC", "router", "tokenA", "tokenB", "tokenC",
  ]);
});

test("source creation receipts bind direct and CREATE2 deployments to the published address", () => {
  const target = { key: "coordinator", address };
  assert.doesNotThrow(() => assertSourceCreationReceipt(target, {
    status: "0x1",
    contractAddress: address,
    logs: [],
  }));
  assert.doesNotThrow(() => assertSourceCreationReceipt({ key: "hookAB", address }, {
    status: "0x1",
    contractAddress: null,
    logs: [{
      address: "0xdc7798B015FAA585bef6462828b374079C4e8a22",
      topics: [
        "0x20723cf4e0ce4009ffa533c784c16cee0dfcbe4bdb0726213d600f19edc56613",
        `0x${address.slice(2).padStart(64, "0")}`,
      ],
    }],
  }));
  assert.throws(() => assertSourceCreationReceipt(target, {
    status: "0x0",
    contractAddress: address,
    logs: [],
  }), /did not succeed/);
  assert.throws(() => assertSourceCreationReceipt(target, {
    status: "0x1",
    contractAddress: "0x2222222222222222222222222222222222222222",
    logs: [],
  }), /does not establish/);
});

test("canonical network snapshots are compared losslessly", () => {
  const actual = { abA: 1n, abB: 2n, bcB: 3n, bcC: 4n, acA: 5n, acC: 6n };
  const expected = Object.fromEntries(Object.entries(actual).map(([key, value]) => [key, String(value)]));
  assert.doesNotThrow(() => assertNetworkSnapshot("canonical", actual, expected));
  expected.acC = "7";
  assert.throws(() => assertNetworkSnapshot("canonical", actual, expected), /acC does not match/);
});

test("validateManifest rejects the wrong chain and malformed addresses", () => {
  const wrongChain = manifest();
  wrongChain.chainId = 1;
  assert.throws(() => validateManifest(wrongChain), /schema gate/);

  const malformed = manifest();
  malformed.router = "0x1234";
  assert.throws(() => validateManifest(malformed), /invalid contract address/);

  const mismatchedManager = manifest();
  mismatchedManager.poolManager = address;
  assert.throws(() => validateManifest(mismatchedManager), /official Unichain Sepolia PoolManager/);

  const invalidSimulation = manifest();
  invalidSimulation.rpcSimulation = {
    account: address,
    allowanceBlock: 1,
    allowanceTransaction: "0x12",
    maximumInput: "1",
  };
  assert.throws(() => validateManifest(invalidSimulation), /invalid RPC simulation/);

  const invalidInteractive = manifest();
  invalidInteractive.interactiveDemo = {
    user: address,
    transaction,
    amountIn: "1000",
    amountOut: "900",
    residualProfit: "0",
    solverReward: "1",
    blockNumber: 1,
    foldRounds: -1,
  };
  assert.throws(() => validateManifest(invalidInteractive), /invalid interactive-demo evidence/);

  const missingBytecode = manifest();
  delete missingBytecode.runtimeBytecode.router;
  assert.throws(() => validateManifest(missingBytecode), /invalid runtime-bytecode evidence/);

  const malformedBytecode = manifest();
  malformedBytecode.runtimeBytecode.router.keccak256 = "0x12";
  assert.throws(() => validateManifest(malformedBytecode), /invalid runtime-bytecode evidence/);

  const malformedDemo = manifest();
  malformedDemo.demo.preReserves.abA = "01";
  assert.throws(() => validateManifest(malformedDemo), /invalid canonical-demo evidence/);

  const missingDeploymentTransaction = manifest();
  missingDeploymentTransaction.deploymentTransactions.pop();
  assert.throws(() => validateManifest(missingDeploymentTransaction), /deployment-transaction evidence/);

  const duplicateDeploymentTransaction = manifest();
  duplicateDeploymentTransaction.deploymentTransactions[27] = duplicateDeploymentTransaction.deploymentTransactions[0];
  assert.throws(() => validateManifest(duplicateDeploymentTransaction), /deployment-transaction evidence/);

  const missingSourceTarget = manifest();
  delete missingSourceTarget.sourceVerificationEvidence.targets.router;
  assert.throws(() => validateManifest(missingSourceTarget), /source-verification evidence/);

  const mismatchedSourceAddress = manifest();
  mismatchedSourceAddress.sourceVerificationEvidence.targets.router.address = "0x2222222222222222222222222222222222222222";
  assert.throws(() => validateManifest(mismatchedSourceAddress), /source-verification target evidence/);

  const incompleteSourceMatch = manifest();
  incompleteSourceMatch.sourceVerificationEvidence.targets.hookAB.runtimeMatch = "partial";
  assert.throws(() => validateManifest(incompleteSourceMatch), /source-verification target evidence/);
});

test("parseDemoAmount enforces the public-demo range", () => {
  assert.equal(parseDemoAmount("10000"), "10000");
  assert.equal(parseDemoAmount("1000.25"), "1000.25");
  assert.throws(() => parseDemoAmount("999"), /between/);
  assert.throws(() => parseDemoAmount("25001"), /between/);
  assert.throws(() => parseDemoAmount("1e4"), /plain token amount/);
});

test("normalizeNetwork names all six coordinator outputs", () => {
  const network = normalizeNetwork([1n, 2n, 3n, 4n, 5n, 6n]);
  assert.deepEqual(network, { abA: 1n, abB: 2n, bcB: 3n, bcC: 4n, acA: 5n, acC: 6n });
  assert.equal(networkChanged(network, { ...network }), false);
  assert.equal(networkChanged(network, { ...network, acC: 7n }), true);
});

test("reductionPercent preserves gains and regressions", () => {
  assert.ok(Math.abs(reductionPercent(544187, 440128) - 19.121919487235086) < 1e-12);
  assert.ok(reductionPercent(409381, 413409) < 0);
  assert.throws(() => reductionPercent(0, 1), /invalid gas row/);
});

test("bufferedGasLimit adds a rounded-up wallet-safe margin", () => {
  assert.equal(bufferedGasLimit(325_437n), 390_525n);
  assert.equal(bufferedGasLimit(1n), 2n);
  assert.throws(() => bufferedGasLimit(0n), /invalid gas estimate/);
  assert.throws(() => bufferedGasLimit(1), /invalid gas estimate/);
});
