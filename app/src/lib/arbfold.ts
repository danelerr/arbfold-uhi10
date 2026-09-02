import {
  createPublicClient,
  decodeEventLog,
  formatUnits,
  getAddress,
  http,
  keccak256,
  parseAbi,
  type Address,
} from "viem";
import {
  assertNetworkSnapshot,
  assertRuntimeBytecodeIdentity,
  normalizeNetwork,
  reductionPercent,
  runtimeBytecodeTargets,
  validateManifest,
} from "../../live-core.js";
import { validateBenchmarkPayload } from "../../benchmark-core.js";
import { TOKEN_SYMBOLS } from "../../swap-lab-core.js";
import type {
  BenchmarkPayload,
  BenchmarkRow,
  DeploymentManifest,
  LiveState,
  ReserveState,
  TokenMeta,
  TokenRole,
} from "../types";

export const CHAIN_ID = 1301;
export const CHAIN_HEX = "0x515";
export const RPC_URL = "https://sepolia.unichain.org";
export const EXPLORER_URL = "https://sepolia.uniscan.xyz";
export const TOKEN_DECIMALS = 18;

export const unichainSepolia = {
  id: CHAIN_ID,
  name: "Unichain Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Uniscan", url: EXPLORER_URL } },
  testnet: true,
} as const;

export const coordinatorAbi = parseAbi([
  "function manager() view returns (address)",
  "function tokenA() view returns (address)",
  "function tokenB() view returns (address)",
  "function tokenC() view returns (address)",
  "function hookAB() view returns (address)",
  "function hookBC() view returns (address)",
  "function hookAC() view returns (address)",
  "function network() view returns (uint256 abA, uint256 abB, uint256 bcB, uint256 bcC, uint256 acA, uint256 acC)",
  "function totalFoldCalls() view returns (uint256)",
  "function totalFoldRounds() view returns (uint256)",
  "function lastResidualProfit() view returns (uint256)",
  "event FoldRound(address indexed originHook, address indexed solver, uint256 indexed round, bool reverse, uint256 threatenedProfit, uint256 solverReward)",
  "event FoldCompleted(address indexed originHook, address indexed solver, uint256 rounds, uint256 residualProfit)",
]);

export const routerAbi = parseAbi([
  "function manager() view returns (address)",
  "function coordinator() view returns (address)",
  "function swapExactInput(address hook, bool zeroForOne, uint256 amountIn, uint256 minAmountOut, address solver, uint256 deadline) returns (uint256 amountOut)",
  "event SwapAndFold(address indexed payer, address indexed hook, address indexed solver, bool zeroForOne, uint256 amountIn, uint256 amountOut)",
  "error DeadlineExpired()",
  "error InvalidAmount()",
  "error InvalidSolver()",
  "error UnregisteredHook()",
  "error TooLittleReceived(uint256 minimum, uint256 actual)",
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "error ExactInputOnly()",
  "error InvalidHookData()",
  "error UnsupportedAmount()",
  "error StateDrift()",
  "error InvariantDecreased()",
  "error NoInvariantIncrease()",
  "error ConservationFailed(uint8 tokenIndex, uint256 beforeTotal, uint256 afterTotal)",
]);

function decodedEvents(receipt: { logs: readonly any[] }): any[] {
  const events: any[] = [];
  for (const log of receipt.logs) {
    for (const abi of [routerAbi, coordinatorAbi]) {
      try {
        events.push(decodeEventLog({ abi, data: log.data, topics: log.topics, strict: true }));
        break;
      } catch {
        // Ignore PoolManager, hook and ERC-20 logs.
      }
    }
  }
  return events;
}

function assertCanonicalReceipt(receipt: any, manifest: DeploymentManifest): void {
  const events = decodedEvents(receipt);
  const swaps = events.filter((event) => event.eventName === "SwapAndFold");
  const foldRounds = events.filter((event) => event.eventName === "FoldRound");
  const completed = events.filter((event) => event.eventName === "FoldCompleted");
  if (swaps.length !== 1 || completed.length !== 1 || foldRounds.length !== manifest.demo.foldRounds) {
    throw new Error("Canonical transaction does not contain the published ARBFOLD event topology");
  }
  const swap = swaps[0];
  const completion = completed[0];
  const reward = foldRounds.reduce((sum, event) => sum + event.args.solverReward, 0n);
  if (receipt.from.toLowerCase() !== manifest.demo.user.toLowerCase()
    || receipt.to?.toLowerCase() !== manifest.router.toLowerCase()
    || receipt.blockNumber !== BigInt(manifest.blockNumber)
    || swap.args.payer.toLowerCase() !== manifest.demo.user.toLowerCase()
    || swap.args.hook.toLowerCase() !== manifest.demo.originHook.toLowerCase()
    || swap.args.solver.toLowerCase() !== manifest.demo.solver.toLowerCase()
    || swap.args.zeroForOne !== manifest.demo.zeroForOne
    || swap.args.amountIn !== BigInt(manifest.demo.amountIn)
    || swap.args.amountOut !== BigInt(manifest.demo.amountOut)
    || completion.args.originHook.toLowerCase() !== manifest.demo.originHook.toLowerCase()
    || completion.args.solver.toLowerCase() !== manifest.demo.solver.toLowerCase()
    || completion.args.rounds !== BigInt(manifest.demo.foldRounds)
    || completion.args.residualProfit !== BigInt(manifest.demo.residualProfit)
    || reward !== BigInt(manifest.demo.solverReward)) {
    throw new Error("Canonical transaction semantics do not match the published manifest");
  }
}

export const tokenAbi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

export const publicClient = createPublicClient({
  chain: unichainSepolia,
  transport: http(RPC_URL, { retryCount: 3, retryDelay: 500 }),
});

export function canonicalAddress(value: string): Address {
  return getAddress(value.toLowerCase());
}

export function abbreviated(value?: string): string {
  return value?.startsWith("0x") ? `${value.slice(0, 8)}…${value.slice(-6)}` : value ?? "—";
}

export function tokenAmount(value?: bigint | string, precision = 6, decimals = TOKEN_DECIMALS): string {
  if (value === undefined) return "—";
  const rendered = formatUnits(BigInt(value), decimals);
  const [whole, fraction = ""] = rendered.split(".");
  const shortFraction = fraction.slice(0, precision).replace(/0+$/, "");
  const grouped = BigInt(whole).toLocaleString("en-US");
  return shortFraction ? `${grouped}.${shortFraction}` : grouped;
}

export async function readTokenMetadata(manifest: DeploymentManifest): Promise<Record<TokenRole, TokenMeta>> {
  const roles: TokenRole[] = ["a", "b", "c"];
  const entries = await Promise.all(roles.map(async (role) => {
    const address = canonicalAddress(manifest.tokens[role]);
    const [symbol, decimals] = await Promise.all([
      publicClient.readContract({ address, abi: tokenAbi, functionName: "symbol" }),
      publicClient.readContract({ address, abi: tokenAbi, functionName: "decimals" }),
    ]);
    const expected = TOKEN_SYMBOLS[role];
    if (symbol !== expected) {
      throw new Error(`Internal token role ${role} reports ${symbol}; the published deployment requires ${expected}.`);
    }
    return [role, { role, address, symbol: expected, decimals: Number(decimals) }] as const;
  }));
  return Object.fromEntries(entries) as Record<TokenRole, TokenMeta>;
}

export function reserveLine(reserves: ReserveState): string {
  return [
    `ARFX / ARFY ${tokenAmount(reserves.abA)} ARFX / ${tokenAmount(reserves.abB)} ARFY`,
    `ARFY / ARFZ ${tokenAmount(reserves.bcB)} ARFY / ${tokenAmount(reserves.bcC)} ARFZ`,
    `ARFX / ARFZ ${tokenAmount(reserves.acA)} ARFX / ${tokenAmount(reserves.acC)} ARFZ`,
  ].join("\n");
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export async function loadManifest(): Promise<DeploymentManifest> {
  const raw = await fetchJson<DeploymentManifest>("deployments/unichain-sepolia-1301-v0.1.json");
  return validateManifest(raw) as DeploymentManifest;
}

export async function loadBenchmark(): Promise<BenchmarkRow[]> {
  const payload = validateBenchmarkPayload(
    await fetchJson<unknown>("data/release-results.json"),
  ) as BenchmarkPayload;
  const rows = payload.frozen_grid.map((row) => ({
    size: row.input_tokens,
    backrun: row.reference_total_gas,
    direct: row.direct_total_gas,
    referenceRounds: row.reference_rounds,
    directRounds: row.direct_rounds,
    referenceSwaps: row.reference_arbitrage_swaps,
    referenceReinjections: row.reference_reinjections,
  }));
  return rows.map((row) => {
    const backrun = row.backrun;
    const direct = row.direct;
    return {
      size: row.size,
      backrun,
      direct,
      reduction: reductionPercent(backrun, direct),
      referenceRounds: row.referenceRounds,
      directRounds: row.directRounds,
      referenceSwaps: row.referenceSwaps,
      referenceReinjections: row.referenceReinjections,
    };
  });
}

export async function readLiveState(
  manifest: DeploymentManifest,
  blockNumber?: bigint,
): Promise<LiveState> {
  const atBlock = blockNumber === undefined ? {} : { blockNumber };
  const coordinator = canonicalAddress(manifest.coordinator);
  const [network, calls, rounds, residual, observedBlock] = await Promise.all([
    publicClient.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "network", ...atBlock }),
    publicClient.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "totalFoldCalls", ...atBlock }),
    publicClient.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "totalFoldRounds", ...atBlock }),
    publicClient.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "lastResidualProfit", ...atBlock }),
    blockNumber === undefined ? publicClient.getBlockNumber({ cacheTime: 0 }) : Promise.resolve(blockNumber),
  ]);
  return {
    network: normalizeNetwork(network) as ReserveState,
    calls,
    rounds,
    residual,
    blockNumber: observedBlock,
  };
}

export async function verifyDeployment(manifest: DeploymentManifest): Promise<LiveState> {
  const targets = runtimeBytecodeTargets(manifest).map((target) => ({
    ...target,
    address: canonicalAddress(target.address),
  }));
  const [chainId, canonicalReceipt, interactiveReceipt, ...codes] = await Promise.all([
    publicClient.getChainId(),
    publicClient.getTransactionReceipt({ hash: manifest.canonicalDemoTransaction }),
    manifest.interactiveDemo?.transaction
      ? publicClient.getTransactionReceipt({ hash: manifest.interactiveDemo.transaction })
      : Promise.resolve(null),
    ...targets.map(({ address }) => publicClient.getCode({ address })),
  ]);
  if (chainId !== CHAIN_ID) throw new Error(`RPC returned chain ${chainId}, expected ${CHAIN_ID}`);
  if (canonicalReceipt.status !== "success") throw new Error("Canonical transaction did not succeed");
  if (interactiveReceipt && interactiveReceipt.status !== "success") {
    throw new Error("Browser-signed validation transaction did not succeed");
  }
  codes.forEach((code, index) => {
    assertRuntimeBytecodeIdentity(targets[index], code, keccak256(code ?? "0x"));
  });
  assertCanonicalReceipt(canonicalReceipt, manifest);
  const coordinator = canonicalAddress(manifest.coordinator);
  const canonicalBlock = BigInt(manifest.blockNumber);
  const [coordinatorManager, routerManager, routerCoordinator, tokenA, tokenB, tokenC, hookAB, hookBC, hookAC, preNetwork, postNetwork] = await Promise.all([
    publicClient.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "manager" }),
    publicClient.readContract({ address: canonicalAddress(manifest.router), abi: routerAbi, functionName: "manager" }),
    publicClient.readContract({ address: canonicalAddress(manifest.router), abi: routerAbi, functionName: "coordinator" }),
    publicClient.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "tokenA" }),
    publicClient.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "tokenB" }),
    publicClient.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "tokenC" }),
    publicClient.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "hookAB" }),
    publicClient.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "hookBC" }),
    publicClient.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "hookAC" }),
    publicClient.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "network", blockNumber: canonicalBlock - 1n }),
    publicClient.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "network", blockNumber: canonicalBlock }),
  ]);
  if (canonicalAddress(coordinatorManager) !== canonicalAddress(manifest.poolManager)
    || canonicalAddress(routerManager) !== canonicalAddress(manifest.poolManager)
    || canonicalAddress(routerCoordinator) !== coordinator) {
    throw new Error("Coordinator/router bindings do not match the official PoolManager deployment");
  }
  const expected = [manifest.tokens.a, manifest.tokens.b, manifest.tokens.c, manifest.hooks.ab, manifest.hooks.bc, manifest.hooks.ac].map(canonicalAddress);
  const observed = [tokenA, tokenB, tokenC, hookAB, hookBC, hookAC].map(canonicalAddress);
  if (observed.some((address, index) => address !== expected[index])) {
    throw new Error("The coordinator token and hook roles do not match the published deployment manifest");
  }
  assertNetworkSnapshot("Canonical pre-state", normalizeNetwork(preNetwork), manifest.demo.preReserves);
  assertNetworkSnapshot("Canonical post-state", normalizeNetwork(postNetwork), manifest.demo.postReserves);
  return readLiveState(manifest);
}

export function describeError(error: unknown): string {
  type ErrorLike = {
    shortMessage?: string;
    details?: string;
    message?: string;
    errorName?: string;
    data?: { errorName?: string };
    cause?: unknown;
  };
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    const candidate = current as ErrorLike;
    for (const value of [candidate.errorName, candidate.data?.errorName, candidate.shortMessage, candidate.details, candidate.message]) {
      if (typeof value === "string" && value.length > 0) messages.push(value);
    }
    current = candidate.cause;
  }
  const message = messages.join("\n") || String(error);
  if (/User rejected|user rejected|denied transaction signature/i.test(message)) return "You rejected the wallet request. No action was taken.";
  if (/insufficient funds/i.test(message)) return "Your wallet needs Unichain Sepolia test ETH to pay for gas.";
  if (/ERC20InsufficientAllowance|0xfb8f41b2/i.test(message)) {
    return "The one-use test-token permission is missing or was already consumed. Allow this demo swap again, then run ARBFOLD.";
  }
  if (/ERC20InsufficientBalance|0xe450d38c/i.test(message)) {
    return "Your test-token balance changed. Get the missing test tokens, then continue.";
  }
  if (/TooLittleReceived|slippage/i.test(message)) return "The quote changed before confirmation. Refresh the quote and try again.";
  if (/StateDrift|InvariantDecreased|NoInvariantIncrease|ConservationFailed/i.test(message)) {
    return "The public pool state changed while the transaction was being prepared. Refresh the quote and try again.";
  }
  if (/chain|network/i.test(message) && /wrong|switch|expected|mismatch/i.test(message)) return "Switch your wallet to Unichain Sepolia to continue.";
  if (/returned no data|returned an invalid response/i.test(message)) {
    return "The public RPC could not refresh the data. Try again shortly; a confirmed transaction remains valid.";
  }
  return messages[0]?.split("\n")[0].slice(0, 220) || String(error).slice(0, 220);
}
