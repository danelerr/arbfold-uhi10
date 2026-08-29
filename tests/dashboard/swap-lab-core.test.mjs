import assert from "node:assert/strict";
import test from "node:test";
import {
  TOKEN_SYMBOLS,
  cycleRoles,
  derivePrimaryAction,
  quoteSwap,
  resolveRoute,
  routeReserves,
} from "../../app/swap-lab-core.js";

test("deployment roles remain distinct from user-facing token symbols", () => {
  assert.deepEqual(TOKEN_SYMBOLS, { a: "ARFY", b: "ARFX", c: "ARFZ" });
});

test("all six token routes match the deployed hooks and PoolKey order", () => {
  const expected = [
    ["a", "b", "ab", true],
    ["b", "a", "ab", false],
    ["b", "c", "bc", true],
    ["c", "b", "bc", false],
    ["a", "c", "ac", true],
    ["c", "a", "ac", false],
  ];
  for (const [input, output, hook, zeroForOne] of expected) {
    assert.deepEqual(resolveRoute(input, output), { input, output, hook, zeroForOne });
  }
  assert.throws(() => resolveRoute("a", "a"), /must be different/);
});

test("cycle narration starts and ends in the selected input token", () => {
  assert.deepEqual(cycleRoles("b", "a"), ["b", "a", "c", "b"]);
  assert.deepEqual(cycleRoles("c", "b"), ["c", "b", "a", "c"]);
});

test("route reserve resolution follows a=ARFY, b=ARFX, c=ARFZ", () => {
  const network = { abA: 1n, abB: 2n, bcB: 3n, bcC: 4n, acA: 5n, acC: 6n };
  assert.deepEqual(routeReserves(network, resolveRoute("a", "b")), [1n, 2n]);
  assert.deepEqual(routeReserves(network, resolveRoute("b", "a")), [2n, 1n]);
  assert.deepEqual(routeReserves(network, resolveRoute("b", "c")), [3n, 4n]);
  assert.deepEqual(routeReserves(network, resolveRoute("c", "b")), [4n, 3n]);
  assert.deepEqual(routeReserves(network, resolveRoute("a", "c")), [5n, 6n]);
  assert.deepEqual(routeReserves(network, resolveRoute("c", "a")), [6n, 5n]);
});

test("quote math matches the deployed fixed-fee CPMM formula", () => {
  assert.equal(quoteSwap(100n, 1_000n, 1_000n), 90n);
  assert.throws(() => quoteSwap(0n, 1n, 1n), /positive bigint/);
});

test("the contextual action never skips mint or exact approval", () => {
  const ready = {
    deploymentReady: true,
    tokenMetadataReady: true,
    walletAvailable: true,
    accountConnected: true,
    correctChain: true,
    hasGas: true,
    amountValid: true,
    amountIn: 10n,
    balance: 0n,
    allowance: 0n,
    quoteReady: true,
  };
  assert.equal(derivePrimaryAction(ready), "mint");
  assert.equal(derivePrimaryAction({ ...ready, balance: 10n }), "approve");
  assert.equal(derivePrimaryAction({ ...ready, balance: 10n, allowance: 10n }), "execute");
  assert.equal(derivePrimaryAction({ ...ready, balance: 10n, allowance: 10n, quoteReady: false }), "quote");
  assert.equal(derivePrimaryAction({ ...ready, correctChain: false }), "switch");
});
