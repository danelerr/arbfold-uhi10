import type { Address, EIP1193Provider, Hash } from "viem";

export interface ReserveState {
  abA: bigint;
  abB: bigint;
  bcB: bigint;
  bcC: bigint;
  acA: bigint;
  acC: bigint;
}

export interface LiveState {
  network: ReserveState;
  calls: bigint;
  rounds: bigint;
  residual: bigint;
  blockNumber: bigint;
}

export interface DemoSnapshot {
  amountIn: string;
  amountOut: string;
  foldRounds: number;
  residualProfit: string;
  solverReward: string;
  preReserves: Record<keyof ReserveState, string>;
  postReserves: Record<keyof ReserveState, string>;
}

export interface DeploymentManifest {
  blockNumber: number;
  canonicalDemoTransaction: Hash;
  chainId: number;
  coordinator: Address;
  explorerBaseUrl: string;
  gitCommit: string;
  hooks: { ab: Address; bc: Address; ac: Address };
  interactiveDemo?: {
    amountIn: string;
    amountOut: string;
    blockNumber: number;
    foldRounds: number;
    residualProfit: string;
    solverReward: string;
    transaction: Hash;
    user: Address;
  };
  network: string;
  officialPoolManager: Address;
  poolManager: Address;
  researchOnly: boolean;
  router: Address;
  rpcSimulation: {
    account: Address;
    allowanceBlock: number;
    allowanceTransaction: Hash;
    maximumInput: string;
  };
  sourceVerification: string;
  tokens: { a: Address; b: Address; c: Address };
  demo: DemoSnapshot;
}

export interface BenchmarkRow {
  size: number;
  backrun: number;
  direct: number;
  reduction: number;
}

export interface BenchmarkPayload {
  rows: Array<{
    origin_input_wei: string;
    backrun_total_gas: number;
    direct_total_gas: number;
  }>;
}

export interface BrowserProvider extends EIP1193Provider {
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
}

export interface WalletCandidate {
  provider: BrowserProvider;
  info: { name?: string; rdns?: string };
}

export type TokenRole = "a" | "b" | "c";
export type TokenSymbol = "ARFX" | "ARFY" | "ARFZ";
export type HookKey = "ab" | "bc" | "ac";

export interface TokenMeta {
  role: TokenRole;
  address: Address;
  symbol: TokenSymbol;
  decimals: number;
}

export interface SwapRoute {
  input: TokenRole;
  output: TokenRole;
  hook: HookKey;
  zeroForOne: boolean;
}

export type LabActionKind = "verify" | "install" | "connect" | "switch" | "gas" | "invalid" | "mint" | "approve" | "quote" | "execute";
export type LabBusyAction = "connect" | "switch" | "mint" | "approve" | "quote" | "execute" | "refresh" | "preview";

export interface SwapLabResult {
  hash: Hash;
  input: bigint;
  output: bigint | null;
  rounds: bigint | null;
  roundEvents: number;
  residual: bigint | null;
  reward: bigint | null;
  gasUsed: bigint;
  blockNumber: bigint;
  inputRole: TokenRole;
  outputRole: TokenRole;
  hook: HookKey;
  zeroForOne: boolean;
  decodeWarning?: string;
}

declare global {
  interface Window {
    ethereum?: BrowserProvider & { providers?: BrowserProvider[] };
  }
}
