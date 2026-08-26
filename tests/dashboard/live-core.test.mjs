import test from "node:test";
import assert from "node:assert/strict";
import {
  bufferedGasLimit,
  networkChanged,
  normalizeNetwork,
  parseDemoAmount,
  reductionPercent,
  validateManifest,
} from "../../app/live-core.js";

const address = "0x1111111111111111111111111111111111111111";
const transaction = `0x${"ab".repeat(32)}`;

function manifest() {
  return {
    researchOnly: true,
    chainId: 1301,
    demo: {},
    poolManager: address,
    officialPoolManager: address,
    coordinator: address,
    router: address,
    tokens: { a: address, b: address, c: address },
    hooks: { ab: address, bc: address, ac: address },
    canonicalDemoTransaction: transaction,
  };
}

test("validateManifest accepts the committed deployment shape", () => {
  assert.equal(validateManifest(manifest()).chainId, 1301);
});

test("validateManifest rejects the wrong chain and malformed addresses", () => {
  const wrongChain = manifest();
  wrongChain.chainId = 1;
  assert.throws(() => validateManifest(wrongChain), /schema gate/);

  const malformed = manifest();
  malformed.router = "0x1234";
  assert.throws(() => validateManifest(malformed), /invalid contract address/);

  const invalidSimulation = manifest();
  invalidSimulation.rpcSimulation = {
    account: address,
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
