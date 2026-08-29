/** @typedef {"a" | "b" | "c"} TokenRole */
/** @typedef {"ARFX" | "ARFY" | "ARFZ"} TokenSymbol */
/** @typedef {"ab" | "bc" | "ac"} HookKey */

/** @type {Readonly<Record<TokenRole, TokenSymbol>>} */
export const TOKEN_SYMBOLS = Object.freeze({
  a: "ARFY",
  b: "ARFX",
  c: "ARFZ",
});

/**
 * The deployment uses internal roles a/b/c. These are deliberately kept
 * separate from the user-facing symbols because a=ARFY and b=ARFX.
 * @type {ReadonlyArray<Readonly<{ input: TokenRole, output: TokenRole, hook: HookKey, zeroForOne: boolean }>>}
 */
export const SWAP_ROUTES = Object.freeze([
  Object.freeze({ input: "a", output: "b", hook: "ab", zeroForOne: true }),
  Object.freeze({ input: "b", output: "a", hook: "ab", zeroForOne: false }),
  Object.freeze({ input: "b", output: "c", hook: "bc", zeroForOne: true }),
  Object.freeze({ input: "c", output: "b", hook: "bc", zeroForOne: false }),
  Object.freeze({ input: "a", output: "c", hook: "ac", zeroForOne: true }),
  Object.freeze({ input: "c", output: "a", hook: "ac", zeroForOne: false }),
]);

/** @param {TokenRole} input @param {TokenRole} output */
export function resolveRoute(input, output) {
  if (input === output) throw new Error("input and output tokens must be different");
  const route = SWAP_ROUTES.find((candidate) => candidate.input === input && candidate.output === output);
  if (!route) throw new Error(`unsupported route ${input}->${output}`);
  return route;
}

/** @param {TokenRole} input @param {TokenRole} output */
export function thirdRole(input, output) {
  if (input === output) throw new Error("input and output tokens must be different");
  const role = /** @type {TokenRole[]} */ (["a", "b", "c"]).find((candidate) => candidate !== input && candidate !== output);
  if (!role) throw new Error("route does not leave a third token");
  return role;
}

/** @param {TokenRole} input @param {TokenRole} output */
export function cycleRoles(input, output) {
  return [input, output, thirdRole(input, output), input];
}

/** @param {HookKey} hook */
export function poolSymbols(hook) {
  if (hook === "ab") return ["ARFX", "ARFY"];
  if (hook === "bc") return ["ARFX", "ARFZ"];
  return ["ARFY", "ARFZ"];
}

/**
 * @param {{abA: bigint, abB: bigint, bcB: bigint, bcC: bigint, acA: bigint, acC: bigint}} network
 * @param {{hook: HookKey, zeroForOne: boolean}} route
 */
export function routeReserves(network, route) {
  const ordered = route.hook === "ab"
    ? [network.abA, network.abB]
    : route.hook === "bc"
      ? [network.bcB, network.bcC]
      : [network.acA, network.acC];
  return route.zeroForOne ? ordered : [ordered[1], ordered[0]];
}

/** CPMM quote with the same fixed 0.30% fee math used by CycleMath. */
export function quoteSwap(amountIn, reserveIn, reserveOut) {
  if ([amountIn, reserveIn, reserveOut].some((value) => typeof value !== "bigint" || value <= 0n)) {
    throw new Error("quote inputs must be positive bigint values");
  }
  const effectiveInput = amountIn * 997_000n;
  return effectiveInput * reserveOut / (reserveIn * 1_000_000n + effectiveInput);
}

/**
 * @typedef {"verify" | "install" | "connect" | "switch" | "gas" | "invalid" | "mint" | "approve" | "quote" | "execute"} LabActionKind
 * @param {{
 *   deploymentReady: boolean,
 *   tokenMetadataReady: boolean,
 *   walletAvailable: boolean,
 *   accountConnected: boolean,
 *   correctChain: boolean,
 *   hasGas: boolean,
 *   amountValid: boolean,
 *   amountIn: bigint,
 *   balance: bigint,
 *   allowance: bigint,
 *   quoteReady: boolean
 * }} state
 * @returns {LabActionKind}
 */
export function derivePrimaryAction(state) {
  if (!state.deploymentReady || !state.tokenMetadataReady) return "verify";
  if (!state.walletAvailable) return "install";
  if (!state.accountConnected) return "connect";
  if (!state.correctChain) return "switch";
  if (!state.hasGas) return "gas";
  if (!state.amountValid || state.amountIn <= 0n) return "invalid";
  if (state.balance < state.amountIn) return "mint";
  if (state.allowance < state.amountIn) return "approve";
  if (!state.quoteReady) return "quote";
  return "execute";
}
