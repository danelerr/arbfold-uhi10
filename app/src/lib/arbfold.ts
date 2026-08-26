import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  type Address,
} from "viem";
import { normalizeNetwork, reductionPercent, validateManifest } from "../../live-core.js";
import type {
  BenchmarkPayload,
  BenchmarkRow,
  DeploymentManifest,
  LiveState,
  ReserveState,
} from "../types";

export const CHAIN_ID = 1301;
export const CHAIN_HEX = "0x515";
export const RPC_URL = "https://sepolia.unichain.org";
export const EXPLORER_URL = "https://sepolia.uniscan.xyz";
export const TOKEN_DECIMALS = 18;
export const DEMO_ALLOWANCE = 25_000n * 10n ** 18n;

export const unichainSepolia = {
  id: CHAIN_ID,
  name: "Unichain Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Uniscan", url: EXPLORER_URL } },
  testnet: true,
} as const;

export const coordinatorAbi = parseAbi([
  "function network() view returns (uint256 abA, uint256 abB, uint256 bcB, uint256 bcC, uint256 acA, uint256 acC)",
  "function totalFoldCalls() view returns (uint256)",
  "function totalFoldRounds() view returns (uint256)",
  "function lastResidualProfit() view returns (uint256)",
  "event FoldRound(address indexed originHook, address indexed solver, uint256 indexed round, bool reverse, uint256 threatenedProfit, uint256 solverReward)",
  "event FoldCompleted(address indexed originHook, address indexed solver, uint256 rounds, uint256 residualProfit)",
]);

export const routerAbi = parseAbi([
  "function swapExactInput(address hook, bool zeroForOne, uint256 amountIn, uint256 minAmountOut, address solver, uint256 deadline) returns (uint256 amountOut)",
  "event SwapAndFold(address indexed payer, address indexed hook, address indexed solver, bool zeroForOne, uint256 amountIn, uint256 amountOut)",
]);

export const tokenAbi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
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

export function tokenAmount(value?: bigint | string, precision = 6): string {
  if (value === undefined) return "—";
  const rendered = formatUnits(BigInt(value), TOKEN_DECIMALS);
  const [whole, fraction = ""] = rendered.split(".");
  const shortFraction = fraction.slice(0, precision).replace(/0+$/, "");
  const grouped = BigInt(whole).toLocaleString("en-US");
  return shortFraction ? `${grouped}.${shortFraction}` : grouped;
}

export function reserveLine(reserves: ReserveState): string {
  return [
    `ETH / USD-1   ${tokenAmount(reserves.abA)} ETH / ${tokenAmount(reserves.abB)} USD-1`,
    `USD-1 / USD-2 ${tokenAmount(reserves.bcB)} USD-1 / ${tokenAmount(reserves.bcC)} USD-2`,
    `ETH / USD-2   ${tokenAmount(reserves.acA)} ETH / ${tokenAmount(reserves.acC)} USD-2`,
  ].join("\n");
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export async function loadManifest(): Promise<DeploymentManifest> {
  const raw = await fetchJson<DeploymentManifest>("deployments/unichain-sepolia-1301.json");
  return validateManifest(raw) as DeploymentManifest;
}

export async function loadBenchmark(): Promise<BenchmarkRow[]> {
  const payload = await fetchJson<BenchmarkPayload>("data/release-results.json");
  return payload.rows.map((row) => {
    const backrun = row.backrun_total_gas;
    const direct = row.direct_total_gas;
    return {
      size: Number(BigInt(row.origin_input_wei) / 10n ** 18n),
      backrun,
      direct,
      reduction: reductionPercent(backrun, direct),
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
  const addresses = [
    manifest.poolManager,
    manifest.coordinator,
    manifest.router,
    manifest.hooks.ab,
    manifest.hooks.bc,
    manifest.hooks.ac,
  ].map(canonicalAddress);
  const [chainId, canonicalReceipt, interactiveReceipt, ...codes] = await Promise.all([
    publicClient.getChainId(),
    publicClient.getTransactionReceipt({ hash: manifest.canonicalDemoTransaction }),
    manifest.interactiveDemo?.transaction
      ? publicClient.getTransactionReceipt({ hash: manifest.interactiveDemo.transaction })
      : Promise.resolve(null),
    ...addresses.map((address) => publicClient.getCode({ address })),
  ]);
  if (chainId !== CHAIN_ID) throw new Error(`RPC returned chain ${chainId}, expected ${CHAIN_ID}`);
  if (canonicalReceipt.status !== "success") throw new Error("Canonical transaction did not succeed");
  if (interactiveReceipt && interactiveReceipt.status !== "success") {
    throw new Error("Browser-signed validation transaction did not succeed");
  }
  if (codes.some((code) => !code || code === "0x")) throw new Error("A deployed contract has no bytecode");
  return readLiveState(manifest);
}

export function describeError(error: unknown): string {
  const candidate = error as { shortMessage?: string; details?: string; message?: string; cause?: { code?: number }; code?: number };
  const message = candidate.shortMessage || candidate.details || candidate.message || String(error);
  if (/User rejected|user rejected|denied transaction signature/i.test(message)) return "The wallet request was cancelled.";
  if (/insufficient funds/i.test(message)) return "Your wallet needs Unichain Sepolia test ETH for network gas.";
  if (/TooLittleReceived/i.test(message)) return "The pool price changed before confirmation. Request a new quote and try again.";
  if (/returned no data|returned an invalid response/i.test(message)) {
    return "The public Unichain RPC could not refresh the deployment. Retry in a moment; an already confirmed transaction remains valid.";
  }
  return message.split("\n")[0].slice(0, 220);
}
