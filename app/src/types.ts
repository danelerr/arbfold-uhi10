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
  chainId: number;
  foldRounds: number;
  originHook: Address;
  residualProfit: string;
  solver: Address;
  solverReward: string;
  user: Address;
  zeroForOne: boolean;
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
  runtimeBytecode: Record<
    "poolManager" | "coordinator" | "hookAB" | "hookBC" | "hookAC" | "router" | "tokenA" | "tokenB" | "tokenC",
    { bytes: number; keccak256: Hash }
  >;
  sourceVerification: string;
  tokens: { a: Address; b: Address; c: Address };
  demo: DemoSnapshot;
}

export interface BenchmarkRow {
  size: number;
  backrun: number;
  direct: number;
  reduction: number;
  referenceRounds: number;
  directRounds: number;
  referenceSwaps: number;
  referenceReinjections: number;
}

export interface BenchmarkPayload {
  schema: "arbfold-v0.1-optimized-release-candidate-v5";
  source_tree_sha256: string;
  residual_threshold_wei_a: string;
  frozen_grid: Array<{
    kind: "grid";
    path: number;
    path_label: string;
    input_tokens: number;
    input_wei: string;
    reference_total_gas: number;
    direct_total_gas: number;
    reference_execution_gas: number;
    direct_execution_gas: number;
    reference_calldata_gas: number;
    direct_calldata_gas: number;
    absolute_gas_saved: number;
    direct_to_reference_bps: number;
    gas_reduction_percent: string;
    reference_rounds: number;
    direct_rounds: number;
    reference_arbitrage_swaps: number;
    reference_reinjections: number;
    direct_fold_calls: number;
    reference_user_output: string;
    direct_user_output: string;
    reference_external_recipient_reward: string;
    direct_external_recipient_reward: string;
    reference_residual: number;
    direct_residual: number;
    equivalence_tolerance_wei: number;
    reference_final_reserves: Record<string, string>;
    direct_final_reserves: Record<string, string>;
  }>;
  mechanical_gates: {
    all_frozen_outputs_equal: boolean;
    all_frozen_rewards_equal: boolean;
    all_frozen_final_reserves_within_one_wei: boolean;
    all_frozen_residuals_equal_and_within_threshold: boolean;
    twenty_five_k_cheaper: boolean;
    all_five_cheaper: boolean;
  };
  dense_sweep: Array<{
    input_tokens: number;
    input_wei: string;
    reference_total_gas: number;
    direct_total_gas: number;
    absolute_gas_saved: number;
    gas_reduction_percent: string;
    direct_rounds: number;
  }>;
  dense_sweep_summary: {
    first_actionable_tokens: number;
    actionable_rows: number;
    cheaper_actionable_rows: number;
    zero_round_ranges: Array<{ start_tokens: number; end_tokens: number }>;
    regression_ranges: Array<{ start_tokens: number; end_tokens: number }>;
    round_regions: Record<string, Array<{ start_tokens: number; end_tokens: number }>>;
  };
  six_path_matrix: Array<{
    kind: "path";
    path: number;
    path_label: string;
    input_tokens: number;
    input_wei: string;
  }>;
  compiler_matrix: Array<{
    name: string;
    status: "measured" | "compile-failed";
    via_ir: boolean;
    optimizer_runs: number;
    canonical_reference_total_gas?: number;
    canonical_direct_total_gas?: number;
    canonical_gas_reduction_percent?: string;
    deployed_bytecode_bytes?: {
      coordinator: number;
      hook: number;
      router: number;
      reference_router: number;
    };
    error?: string;
    error_sha256?: string;
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
