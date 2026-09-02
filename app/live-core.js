const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const BYTECODE_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const TRANSACTION_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const HOOK_DEPLOYED_TOPIC = "0x20723cf4e0ce4009ffa533c784c16cee0dfcbe4bdb0726213d600f19edc56613";
const ARBFOLD_HOOK_DEPLOYER = "0xdc7798b015faa585bef6462828b374079c4e8a22";
const MAX_DEMO_AMOUNT = 25_000;
const MIN_DEMO_AMOUNT = 1_000;
export const OFFICIAL_UNICHAIN_SEPOLIA_POOL_MANAGER = "0x9cb26a7183b2f4515945dc52cb4195b0d2d06c95";
const NETWORK_FIELDS = ["abA", "abB", "bcB", "bcC", "acA", "acC"];
export const RUNTIME_BYTECODE_KEYS = [
  "poolManager",
  "coordinator",
  "hookAB",
  "hookBC",
  "hookAC",
  "router",
  "tokenA",
  "tokenB",
  "tokenC",
];
export const SOURCE_VERIFICATION_KEYS = [
  "coordinator",
  "hookAB",
  "hookBC",
  "hookAC",
  "router",
  "tokenA",
  "tokenB",
  "tokenC",
];

const SOURCE_CONTRACTS = {
  coordinator: "src/ArbFoldCoordinator.sol:ArbFoldCoordinator",
  hookAB: "src/ArbFoldHook.sol:ArbFoldHook",
  hookBC: "src/ArbFoldHook.sol:ArbFoldHook",
  hookAC: "src/ArbFoldHook.sol:ArbFoldHook",
  router: "src/ArbFoldRouter.sol:ArbFoldRouter",
  tokenA: "src/DemoToken.sol:DemoToken",
  tokenB: "src/DemoToken.sol:DemoToken",
  tokenC: "src/DemoToken.sol:DemoToken",
};

export function validateManifest(manifest) {
  if (!manifest || manifest.researchOnly !== true || manifest.chainId !== 1301 || !manifest.demo) {
    throw new Error("manifest failed the research-deployment schema gate");
  }

  const addresses = [
    manifest.poolManager,
    manifest.officialPoolManager,
    manifest.coordinator,
    manifest.router,
    manifest.tokens?.a,
    manifest.tokens?.b,
    manifest.tokens?.c,
    manifest.hooks?.ab,
    manifest.hooks?.bc,
    manifest.hooks?.ac,
  ];
  if (addresses.some((value) => !ADDRESS_PATTERN.test(value ?? ""))) {
    throw new Error("manifest contains an invalid contract address");
  }
  if (manifest.poolManager.toLowerCase() !== OFFICIAL_UNICHAIN_SEPOLIA_POOL_MANAGER
    || manifest.officialPoolManager.toLowerCase() !== OFFICIAL_UNICHAIN_SEPOLIA_POOL_MANAGER) {
    throw new Error("manifest does not bind the frozen official Unichain Sepolia PoolManager");
  }
  if (!Number.isSafeInteger(manifest.blockNumber) || manifest.blockNumber <= 0) {
    throw new Error("manifest contains an invalid canonical block number");
  }
  if (!TRANSACTION_PATTERN.test(manifest.canonicalDemoTransaction ?? "")) {
    throw new Error("manifest contains an invalid canonical transaction");
  }
  if (manifest.interactiveDemo) {
    if (!ADDRESS_PATTERN.test(manifest.interactiveDemo.user ?? "")
      || !TRANSACTION_PATTERN.test(manifest.interactiveDemo.transaction ?? "")
      || !["amountIn", "amountOut", "residualProfit", "solverReward"].every((field) => /^\d+$/.test(manifest.interactiveDemo[field] ?? ""))
      || !Number.isSafeInteger(manifest.interactiveDemo.blockNumber)
      || manifest.interactiveDemo.blockNumber <= 0
      || !Number.isSafeInteger(manifest.interactiveDemo.foldRounds)
      || manifest.interactiveDemo.foldRounds < 0) {
      throw new Error("manifest contains invalid interactive-demo evidence");
    }
  }
  const demo = manifest.demo;
  if (demo.chainId !== manifest.chainId
    || !ADDRESS_PATTERN.test(demo.originHook ?? "")
    || !ADDRESS_PATTERN.test(demo.solver ?? "")
    || !ADDRESS_PATTERN.test(demo.user ?? "")
    || typeof demo.zeroForOne !== "boolean"
    || !["amountIn", "amountOut", "residualProfit", "solverReward"].every(
      (field) => /^(0|[1-9]\d*)$/.test(demo[field] ?? ""),
    )
    || !Number.isSafeInteger(demo.foldRounds)
    || demo.foldRounds < 0
    || ![demo.preReserves, demo.postReserves].every((snapshot) => snapshot
      && Object.keys(snapshot).sort().join(",") === [...NETWORK_FIELDS].sort().join(",")
      && NETWORK_FIELDS.every((field) => /^(0|[1-9]\d*)$/.test(snapshot[field] ?? "")))) {
    throw new Error("manifest contains invalid canonical-demo evidence");
  }
  if (!manifest.rpcSimulation
    || !ADDRESS_PATTERN.test(manifest.rpcSimulation.account ?? "")
      || !TRANSACTION_PATTERN.test(manifest.rpcSimulation.allowanceTransaction ?? "")
      || !/^\d+$/.test(manifest.rpcSimulation.maximumInput ?? "")
      || BigInt(manifest.rpcSimulation.maximumInput ?? "0") <= 0n
      || !Number.isSafeInteger(manifest.rpcSimulation.allowanceBlock)
      || manifest.rpcSimulation.allowanceBlock <= 0) {
    throw new Error("manifest contains an invalid RPC simulation configuration");
  }
  const bytecodeKeys = Object.keys(manifest.runtimeBytecode ?? {}).sort();
  if (bytecodeKeys.join(",") !== [...RUNTIME_BYTECODE_KEYS].sort().join(",")
    || RUNTIME_BYTECODE_KEYS.some((key) => {
      const evidence = manifest.runtimeBytecode?.[key];
      return !Number.isSafeInteger(evidence?.bytes)
        || evidence.bytes <= 0
        || !BYTECODE_HASH_PATTERN.test(evidence?.keccak256 ?? "");
    })) {
    throw new Error("manifest contains invalid runtime-bytecode evidence");
  }
  if (!Array.isArray(manifest.deploymentTransactions)
    || manifest.deploymentTransactions.length !== 28
    || manifest.deploymentTransactions.some((transaction) => !TRANSACTION_PATTERN.test(transaction))
    || new Set(manifest.deploymentTransactions.map((transaction) => transaction.toLowerCase())).size !== 28) {
    throw new Error("manifest contains invalid deployment-transaction evidence");
  }
  const sourceEvidence = manifest.sourceVerificationEvidence;
  const sourceKeys = Object.keys(sourceEvidence?.targets ?? {}).sort();
  if (manifest.sourceVerification !== "verified"
    || sourceEvidence?.schema !== "sourcify-v2-match-v1"
    || sourceEvidence?.provider !== "Sourcify"
    || sourceEvidence?.chainId !== manifest.chainId
    || sourceEvidence?.apiBaseUrl !== "https://sourcify.dev/server/v2/contract"
    || sourceEvidence?.repositoryBaseUrl !== "https://repo.sourcify.dev"
    || !/^\d{4}-\d{2}-\d{2}$/.test(sourceEvidence?.checkedAt ?? "")
    || sourceKeys.join(",") !== [...SOURCE_VERIFICATION_KEYS].sort().join(",")) {
    throw new Error("manifest contains invalid source-verification evidence");
  }
  const roleAddresses = {
    coordinator: manifest.coordinator,
    hookAB: manifest.hooks.ab,
    hookBC: manifest.hooks.bc,
    hookAC: manifest.hooks.ac,
    router: manifest.router,
    tokenA: manifest.tokens.a,
    tokenB: manifest.tokens.b,
    tokenC: manifest.tokens.c,
  };
  if (SOURCE_VERIFICATION_KEYS.some((key) => {
    const evidence = sourceEvidence.targets[key];
    const expectedAddress = roleAddresses[key];
    return !ADDRESS_PATTERN.test(evidence?.address ?? "")
      || evidence.address.toLowerCase() !== expectedAddress.toLowerCase()
      || evidence.contract !== SOURCE_CONTRACTS[key]
      || !TRANSACTION_PATTERN.test(evidence.creationTransaction ?? "")
      || !manifest.deploymentTransactions.some(
        (transaction) => transaction.toLowerCase() === evidence.creationTransaction.toLowerCase(),
      )
      || !ISO_UTC_PATTERN.test(evidence.verifiedAt ?? "")
      || evidence.creationMatch !== "match"
      || evidence.runtimeMatch !== "match"
      || evidence.repositoryUrl !== `${sourceEvidence.repositoryBaseUrl}/${manifest.chainId}/${evidence.address}`;
  })) {
    throw new Error("manifest contains invalid source-verification target evidence");
  }
  return manifest;
}

export function runtimeBytecodeTargets(manifest) {
  return [
    ["poolManager", manifest.poolManager],
    ["coordinator", manifest.coordinator],
    ["hookAB", manifest.hooks.ab],
    ["hookBC", manifest.hooks.bc],
    ["hookAC", manifest.hooks.ac],
    ["router", manifest.router],
    ["tokenA", manifest.tokens.a],
    ["tokenB", manifest.tokens.b],
    ["tokenC", manifest.tokens.c],
  ].map(([key, address]) => ({ key, address, expected: manifest.runtimeBytecode[key] }));
}

export function sourceVerificationTargets(manifest) {
  return SOURCE_VERIFICATION_KEYS.map((key) => ({
    key,
    ...manifest.sourceVerificationEvidence.targets[key],
  }));
}

export function assertSourceCreationReceipt(target, receipt) {
  if (!receipt || receipt.status !== "0x1") {
    throw new Error(`${target.key} creation transaction did not succeed`);
  }
  const expectedAddress = target.address.toLowerCase();
  const directCreation = receipt.contractAddress?.toLowerCase() === expectedAddress;
  const expectedAddressTopic = `0x${expectedAddress.slice(2).padStart(64, "0")}`;
  const create2Event = Array.isArray(receipt.logs) && receipt.logs.some((log) => (
    log?.address?.toLowerCase() === ARBFOLD_HOOK_DEPLOYER
      && log?.topics?.[0]?.toLowerCase() === HOOK_DEPLOYED_TOPIC
      && log?.topics?.[1]?.toLowerCase() === expectedAddressTopic
  ));
  if (!directCreation && !create2Event) {
    throw new Error(`${target.key} creation receipt does not establish the published address`);
  }
}

export function assertNetworkSnapshot(label, actual, expected) {
  for (const field of NETWORK_FIELDS) {
    if (actual[field] !== BigInt(expected[field])) {
      throw new Error(`${label} ${field} does not match the published canonical snapshot`);
    }
  }
}

export function assertRuntimeBytecodeIdentity(target, code, observedHash) {
  if (!code || code === "0x") throw new Error(`${target.key} has no deployed bytecode`);
  const observedBytes = (code.length - 2) / 2;
  if (observedBytes !== target.expected.bytes
    || observedHash.toLowerCase() !== target.expected.keccak256.toLowerCase()) {
    throw new Error(`${target.key} runtime bytecode does not match the published manifest`);
  }
}

export function parseDemoAmount(value) {
  const normalized = String(value).trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(normalized)) {
    throw new Error("Enter a plain token amount with at most 6 decimal places");
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < MIN_DEMO_AMOUNT || amount > MAX_DEMO_AMOUNT) {
    throw new Error(`Choose an amount between ${MIN_DEMO_AMOUNT.toLocaleString()} and ${MAX_DEMO_AMOUNT.toLocaleString()}`);
  }
  return normalized;
}

export function normalizeNetwork(value) {
  const entries = Array.isArray(value)
    ? value
    : [value.abA, value.abB, value.bcB, value.bcC, value.acA, value.acC];
  if (entries.length !== 6 || entries.some((item) => typeof item !== "bigint")) {
    throw new Error("coordinator returned an invalid network state");
  }
  return {
    abA: entries[0],
    abB: entries[1],
    bcB: entries[2],
    bcC: entries[3],
    acA: entries[4],
    acC: entries[5],
  };
}

export function networkChanged(beforeState, afterState) {
  return Object.keys(beforeState).some((key) => beforeState[key] !== afterState[key]);
}

export function reductionPercent(backrun, direct) {
  if (!Number.isFinite(backrun) || !Number.isFinite(direct) || backrun <= 0 || direct <= 0) {
    throw new Error("invalid gas row");
  }
  return ((backrun - direct) / backrun) * 100;
}

export function bufferedGasLimit(estimate) {
  if (typeof estimate !== "bigint" || estimate <= 0n) {
    throw new Error("invalid gas estimate");
  }
  return (estimate * 120n + 99n) / 100n;
}
