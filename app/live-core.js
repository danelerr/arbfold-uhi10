const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const MAX_DEMO_AMOUNT = 25_000;
const MIN_DEMO_AMOUNT = 100;

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
      || !/^0x[a-fA-F0-9]{64}$/.test(manifest.interactiveDemo.transaction ?? "")) {
      throw new Error("manifest contains invalid interactive-demo evidence");
    }
  }
  if (manifest.rpcSimulation) {
    if (!ADDRESS_PATTERN.test(manifest.rpcSimulation.account ?? "")
      || !/^0x[a-fA-F0-9]{64}$/.test(manifest.rpcSimulation.allowanceTransaction ?? "")
      || !/^\d+$/.test(manifest.rpcSimulation.maximumInput ?? "")) {
      throw new Error("manifest contains an invalid RPC simulation configuration");
    }
  }
  return manifest;
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
