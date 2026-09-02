const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const BYTECODE_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const MAX_DEMO_AMOUNT = 25_000;
const MIN_DEMO_AMOUNT = 1_000;
export const RUNTIME_BYTECODE_KEYS = [
  "coordinator",
  "hookAB",
  "hookBC",
  "hookAC",
  "router",
  "tokenA",
  "tokenB",
  "tokenC",
];

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
  if (!/^0x[a-fA-F0-9]{64}$/.test(manifest.canonicalDemoTransaction ?? "")) {
    throw new Error("manifest contains an invalid canonical transaction");
  }
  if (manifest.interactiveDemo) {
    if (!ADDRESS_PATTERN.test(manifest.interactiveDemo.user ?? "")
      || !/^0x[a-fA-F0-9]{64}$/.test(manifest.interactiveDemo.transaction ?? "")
      || !["amountIn", "amountOut", "residualProfit", "solverReward"].every((field) => /^\d+$/.test(manifest.interactiveDemo[field] ?? ""))
      || !Number.isSafeInteger(manifest.interactiveDemo.blockNumber)
      || manifest.interactiveDemo.blockNumber <= 0
      || !Number.isSafeInteger(manifest.interactiveDemo.foldRounds)
      || manifest.interactiveDemo.foldRounds < 0) {
      throw new Error("manifest contains invalid interactive-demo evidence");
    }
  }
  if (!manifest.rpcSimulation
    || !ADDRESS_PATTERN.test(manifest.rpcSimulation.account ?? "")
      || !/^0x[a-fA-F0-9]{64}$/.test(manifest.rpcSimulation.allowanceTransaction ?? "")
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
  return manifest;
}

export function runtimeBytecodeTargets(manifest) {
  return [
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
