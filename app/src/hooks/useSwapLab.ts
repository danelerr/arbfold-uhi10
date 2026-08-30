import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createWalletClient,
  custom,
  decodeEventLog,
  formatEther,
  parseUnits,
  type Address,
  type WalletClient,
} from "viem";
import { bufferedGasLimit, parseDemoAmount } from "../../live-core.js";
import {
  cycleRoles,
  derivePrimaryAction,
  poolSymbols,
  quoteSwap,
  resolveRoute,
  routeReserves,
  TOKEN_SYMBOLS,
} from "../../swap-lab-core.js";
import {
  CHAIN_HEX,
  CHAIN_ID,
  EXPLORER_URL,
  RPC_URL,
  abbreviated,
  canonicalAddress,
  coordinatorAbi,
  describeError,
  publicClient,
  readLiveState,
  readTokenMetadata,
  routerAbi,
  tokenAbi,
  tokenAmount,
  unichainSepolia,
} from "../lib/arbfold";
import type {
  BrowserProvider,
  DeploymentManifest,
  LabActionKind,
  LabBusyAction,
  SwapLabResult,
  SwapRoute,
  TokenMeta,
  TokenRole,
  WalletCandidate,
} from "../types";

interface UseSwapLabOptions {
  manifest: DeploymentManifest | null;
  liveReady: boolean;
  onLiveStateChanged: () => Promise<void>;
}

type EventProvider = BrowserProvider & { removeListener?: BrowserProvider["on"] };

interface SwapEventArgs {
  payer?: Address;
  hook?: Address;
  solver?: Address;
  zeroForOne?: boolean;
  amountIn?: bigint;
  amountOut?: bigint;
}

interface RoundEventArgs {
  originHook?: Address;
  solver?: Address;
  solverReward?: bigint;
}

interface CompletedEventArgs {
  originHook?: Address;
  solver?: Address;
  rounds?: bigint;
  residualProfit?: bigint;
}

const DEFAULT_INPUT: TokenRole = "b";
const DEFAULT_OUTPUT: TokenRole = "a";
const DEFAULT_AMOUNT = "10000";

const EMPTY_BALANCES: Record<TokenRole, bigint> = { a: 0n, b: 0n, c: 0n };

function providerName(candidate: WalletCandidate | null): string {
  if (candidate?.info.name) return candidate.info.name;
  if (candidate?.provider.isMetaMask) return "MetaMask";
  if (candidate?.provider.isCoinbaseWallet) return "Coinbase Wallet";
  if (candidate?.provider.isBraveWallet) return "Brave Wallet";
  return candidate ? "browser wallet" : "wallet";
}

function legacyCandidates(): WalletCandidate[] {
  const legacy = window.ethereum;
  if (!legacy) return [];
  const providers = Array.isArray(legacy.providers) ? legacy.providers : [];
  return [...providers, legacy].map((provider) => ({ provider, info: {} }));
}

function chooseCandidate(candidates: WalletCandidate[]): WalletCandidate | null {
  const unique = candidates.filter((candidate, index, all) => (
    all.findIndex((item) => item.provider === candidate.provider) === index
  ));
  return unique.find((candidate) => candidate.info.rdns === "io.metamask")
    || unique.find((candidate) => candidate.provider.isMetaMask && !candidate.provider.isRabby)
    || unique[0]
    || null;
}

function sameAddress(left?: string, right?: string): boolean {
  return Boolean(left && right && canonicalAddress(left) === canonicalAddress(right));
}

export function useSwapLab({ manifest, liveReady, onLiveStateChanged }: UseSwapLabOptions) {
  const announced = useRef<WalletCandidate[]>([]);
  const quoteSequence = useRef(0);
  const [candidate, setCandidate] = useState<WalletCandidate | null>(() => chooseCandidate(legacyCandidates()));
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [metadata, setMetadata] = useState<Record<TokenRole, TokenMeta> | null>(null);
  const [metadataError, setMetadataError] = useState("");
  const [inputRole, setInputRoleState] = useState<TokenRole>(DEFAULT_INPUT);
  const [outputRole, setOutputRoleState] = useState<TokenRole>(DEFAULT_OUTPUT);
  const [amount, setAmountState] = useState(DEFAULT_AMOUNT);
  const [balances, setBalances] = useState<Record<TokenRole, bigint>>(EMPTY_BALANCES);
  const [allowances, setAllowances] = useState<Record<TokenRole, bigint>>(EMPTY_BALANCES);
  const [gasBalance, setGasBalance] = useState(0n);
  const [quote, setQuote] = useState<bigint | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<LabBusyAction | null>(null);
  const [status, setStatus] = useState("Verifying the public deployment.");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SwapLabResult | null>(null);

  const route = useMemo(
    () => resolveRoute(inputRole, outputRole) as SwapRoute,
    [inputRole, outputRole],
  );
  const inputToken = metadata?.[inputRole] ?? {
    role: inputRole,
    address: manifest ? canonicalAddress(manifest.tokens[inputRole]) : "0x0000000000000000000000000000000000000000" as Address,
    symbol: TOKEN_SYMBOLS[inputRole],
    decimals: 18,
  };
  const outputToken = metadata?.[outputRole] ?? {
    role: outputRole,
    address: manifest ? canonicalAddress(manifest.tokens[outputRole]) : "0x0000000000000000000000000000000000000000" as Address,
    symbol: TOKEN_SYMBOLS[outputRole],
    decimals: 18,
  };

  const parsedAmount = useMemo(() => {
    try {
      return parseUnits(parseDemoAmount(amount), inputToken.decimals);
    } catch {
      return 0n;
    }
  }, [amount, inputToken.decimals]);

  const amountError = useMemo(() => {
    try {
      parseDemoAmount(amount);
      return "";
    } catch {
      return "Enter an amount from 1,000 to 25,000 with up to 6 decimals.";
    }
  }, [amount]);

  const scanWallets = useCallback(() => {
    setCandidate(chooseCandidate([...announced.current, ...legacyCandidates()]));
  }, []);

  useEffect(() => {
    const announce = (event: Event) => {
      const detail = (event as CustomEvent<WalletCandidate>).detail;
      if (!detail?.provider?.request) return;
      if (!announced.current.some((item) => item.provider === detail.provider)) announced.current.push(detail);
      scanWallets();
    };
    window.addEventListener("eip6963:announceProvider", announce as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const timer = window.setTimeout(scanWallets, 500);
    return () => {
      window.removeEventListener("eip6963:announceProvider", announce as EventListener);
      window.clearTimeout(timer);
    };
  }, [scanWallets]);

  useEffect(() => {
    let active = true;
    if (!manifest || !liveReady) {
      setMetadata(null);
      return () => { active = false; };
    }
    setMetadataError("");
    readTokenMetadata(manifest)
      .then((nextMetadata) => {
        if (!active) return;
        setMetadata(nextMetadata);
        setStatus("Deployment and test tokens verified.");
      })
      .catch((caught) => {
        if (!active) return;
        setMetadata(null);
        setMetadataError(describeError(caught));
      });
    return () => { active = false; };
  }, [liveReady, manifest]);

  const refreshWalletState = useCallback(async (selectedAccount = account) => {
    if (!selectedAccount || !manifest || !metadata) return;
    const router = canonicalAddress(manifest.router);
    const roles: TokenRole[] = ["a", "b", "c"];
    const [nextGas, nextBalances, nextAllowances] = await Promise.all([
      publicClient.getBalance({ address: selectedAccount }),
      Promise.all(roles.map((role) => publicClient.readContract({
        address: metadata[role].address,
        abi: tokenAbi,
        functionName: "balanceOf",
        args: [selectedAccount],
      }))),
      Promise.all(roles.map((role) => publicClient.readContract({
        address: metadata[role].address,
        abi: tokenAbi,
        functionName: "allowance",
        args: [selectedAccount, router],
      }))),
    ]);
    setGasBalance(nextGas);
    setBalances({ a: nextBalances[0], b: nextBalances[1], c: nextBalances[2] });
    setAllowances({ a: nextAllowances[0], b: nextAllowances[1], c: nextAllowances[2] });
  }, [account, manifest, metadata]);

  useEffect(() => {
    const provider = candidate?.provider as EventProvider | undefined;
    if (!provider) return;
    const handleAccounts = (accounts: readonly Address[]) => {
      if (!accounts.length) {
        setAccount(null);
        setWalletClient(null);
        setBalances(EMPTY_BALANCES);
        setAllowances(EMPTY_BALANCES);
        return;
      }
      const selected = canonicalAddress(accounts[0]);
      setAccount(selected);
      setWalletClient(createWalletClient({ account: selected, chain: unichainSepolia, transport: custom(provider) }));
      void refreshWalletState(selected);
    };
    const handleChain = (chainHex: string) => {
      const nextChainId = Number.parseInt(chainHex, 16);
      setWalletChainId(nextChainId);
      if (nextChainId === CHAIN_ID && account) void refreshWalletState(account);
    };
    provider.on("accountsChanged", handleAccounts);
    provider.on("chainChanged", handleChain);
    return () => {
      provider.removeListener?.("accountsChanged", handleAccounts);
      provider.removeListener?.("chainChanged", handleChain);
    };
  }, [account, candidate, refreshWalletState]);

  const updateQuote = useCallback(async () => {
    if (!manifest || !liveReady || !metadata || parsedAmount <= 0n) {
      setQuote(null);
      return;
    }
    const sequence = ++quoteSequence.current;
    setQuoteLoading(true);
    setQuote(null);
    setError("");
    try {
      const state = await readLiveState(manifest);
      const [reserveIn, reserveOut] = routeReserves(state.network, route);
      const nextQuote = quoteSwap(parsedAmount, reserveIn, reserveOut);
      if (sequence === quoteSequence.current) setQuote(nextQuote);
    } catch (caught) {
      if (sequence === quoteSequence.current) setError(describeError(caught));
    } finally {
      if (sequence === quoteSequence.current) setQuoteLoading(false);
    }
  }, [liveReady, manifest, metadata, parsedAmount, route]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void updateQuote(); }, 220);
    return () => window.clearTimeout(timer);
  }, [updateQuote]);

  const busy = activeAction !== null;
  const runAction = useCallback(async (name: LabBusyAction, action: () => Promise<void>) => {
    if (activeAction) return;
    setActiveAction(name);
    setError("");
    try {
      await action();
    } catch (caught) {
      const message = describeError(caught);
      setError(message);
      setStatus(message);
    } finally {
      setActiveAction(null);
    }
  }, [activeAction]);

  const connect = () => runAction("connect", async () => {
    if (!liveReady || !metadata) throw new Error("Wait for the deployment verification to finish.");
    if (!candidate) throw new Error("No compatible wallet was detected in this browser.");
    const provider = candidate.provider;
    const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
    if (!accounts.length) throw new Error("The wallet did not return an account.");
    const selected = canonicalAddress(accounts[0]);
    const chainHex = await provider.request({ method: "eth_chainId" }) as string;
    const nextChainId = Number.parseInt(chainHex, 16);
    setWalletChainId(nextChainId);
    setAccount(selected);
    setWalletClient(createWalletClient({ account: selected, chain: unichainSepolia, transport: custom(provider) }));
    await refreshWalletState(selected);
    setStatus(nextChainId === CHAIN_ID ? "Wallet connected. Continue with the next step." : "Wallet connected. Switch to Unichain Sepolia to continue.");
  });

  async function switchToUnichain(provider: BrowserProvider) {
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
    } catch (caught) {
      const switchError = caught as { code?: number; cause?: { code?: number } };
      if ((switchError.code ?? switchError.cause?.code) !== 4902) throw caught;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN_HEX,
          chainName: unichainSepolia.name,
          nativeCurrency: unichainSepolia.nativeCurrency,
          rpcUrls: [RPC_URL],
          blockExplorerUrls: [EXPLORER_URL],
        }],
      });
    }
  }

  const switchNetwork = () => runAction("switch", async () => {
    if (!candidate) throw new Error("Connect a wallet first.");
    await switchToUnichain(candidate.provider);
    const chainHex = await candidate.provider.request({ method: "eth_chainId" }) as string;
    const nextChainId = Number.parseInt(chainHex, 16);
    if (nextChainId !== CHAIN_ID) throw new Error("The wallet did not switch to Unichain Sepolia.");
    setWalletChainId(nextChainId);
    await refreshWalletState();
    setStatus("Wallet connected to Unichain Sepolia.");
  });

  const sendTokenTransaction = useCallback(async (
    name: "mint" | "approve",
    token: TokenMeta,
    args: readonly [Address, bigint],
  ) => {
    if (!account || !walletClient) throw new Error("Connect a wallet first.");
    const simulation = await publicClient.simulateContract({
      account,
      address: token.address,
      abi: tokenAbi,
      functionName: name,
      args,
    });
    const estimatedGas = await publicClient.estimateContractGas(simulation.request);
    const hash = await walletClient.writeContract({ ...simulation.request, gas: bufferedGasLimit(estimatedGas) });
    setStatus(`Transaction ${abbreviated(hash)} submitted. Waiting for confirmation…`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (receipt.status !== "success") throw new Error(`The ${name} transaction reverted.`);
  }, [account, walletClient]);

  const mintMissing = () => runAction("mint", async () => {
    if (!account || !manifest || !metadata || parsedAmount <= 0n) throw new Error("Select a valid amount first.");
    const deficit = parsedAmount > balances[inputRole] ? parsedAmount - balances[inputRole] : 0n;
    if (deficit === 0n) return;
    setStatus(`Confirm the creation of ${tokenAmount(deficit, 6, inputToken.decimals)} valueless test ${inputToken.symbol} in your wallet.`);
    await sendTokenTransaction("mint", inputToken, [account, deficit]);
    await refreshWalletState(account);
    setStatus(`Test ${inputToken.symbol} received. The swap permission is requested separately.`);
  });

  const approveSelected = () => runAction("approve", async () => {
    if (!manifest || !metadata || parsedAmount <= 0n) throw new Error("Select a valid amount first.");
    const router = canonicalAddress(manifest.router);
    setStatus(`Confirm the exact permission for ${tokenAmount(parsedAmount, 6, inputToken.decimals)} ${inputToken.symbol}.`);
    await sendTokenTransaction("approve", inputToken, [router, parsedAmount]);
    await refreshWalletState();
    setStatus("Permission confirmed. The swap is ready.");
  });

  const refreshGas = () => runAction("refresh", async () => {
    await refreshWalletState();
    setStatus("Gas balance refreshed.");
  });

  const refreshQuote = () => runAction("quote", async () => {
    await updateQuote();
    setStatus("Quote refreshed from the public reserves.");
  });

  const execute = () => runAction("execute", async () => {
    if (!account || !manifest || !metadata || !walletClient || parsedAmount <= 0n) {
      throw new Error("Complete the swap preparation first.");
    }
    if (walletChainId !== CHAIN_ID) throw new Error("Switch your wallet to Unichain Sepolia to continue.");
    const routerAddress = canonicalAddress(manifest.router);
    const coordinatorAddress = canonicalAddress(manifest.coordinator);
    const hookAddress = canonicalAddress(manifest.hooks[route.hook]);
    const deadline = BigInt(Math.floor(Date.now() / 1_000) + 900);
    setStatus("Refreshing the quote before you sign…");
    const freshQuote = await publicClient.simulateContract({
      account,
      address: routerAddress,
      abi: routerAbi,
      functionName: "swapExactInput",
      args: [hookAddress, route.zeroForOne, parsedAmount, 0n, account, deadline],
    });
    setQuote(freshQuote.result);
    const minimumOut = freshQuote.result * 995n / 1_000n;
    setStatus(`Confirm a swap of ${tokenAmount(parsedAmount, 6, inputToken.decimals)} ${inputToken.symbol} for approximately ${tokenAmount(freshQuote.result, 6, outputToken.decimals)} ${outputToken.symbol}.`);
    const execution = await publicClient.simulateContract({
      account,
      address: routerAddress,
      abi: routerAbi,
      functionName: "swapExactInput",
      args: [hookAddress, route.zeroForOne, parsedAmount, minimumOut, account, deadline],
    });
    const estimatedGas = await publicClient.estimateContractGas(execution.request);
    const hash = await walletClient.writeContract({ ...execution.request, gas: bufferedGasLimit(estimatedGas) });
    setStatus(`Transaction ${abbreviated(hash)} submitted. Waiting for confirmation…`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (receipt.status !== "success") throw new Error("The swap + ARBFOLD transaction reverted.");

    let nextResult: SwapLabResult = {
      hash,
      input: parsedAmount,
      output: null,
      rounds: null,
      roundEvents: 0,
      residual: null,
      reward: null,
      gasUsed: receipt.gasUsed,
      blockNumber: receipt.blockNumber,
      inputRole,
      outputRole,
      hook: route.hook,
      zeroForOne: route.zeroForOne,
    };

    try {
      const routerEvents = receipt.logs
        .filter((log) => sameAddress(log.address, routerAddress))
        .flatMap((log) => {
          try { return [decodeEventLog({ abi: routerAbi, data: log.data, topics: log.topics, strict: true })]; }
          catch { return []; }
        });
      const coordinatorEvents = receipt.logs
        .filter((log) => sameAddress(log.address, coordinatorAddress))
        .flatMap((log) => {
          try { return [decodeEventLog({ abi: coordinatorAbi, data: log.data, topics: log.topics, strict: true })]; }
          catch { return []; }
        });
      const swap = routerEvents.find((event) => event.eventName === "SwapAndFold");
      const rounds = coordinatorEvents.filter((event) => event.eventName === "FoldRound");
      const completed = coordinatorEvents.find((event) => event.eventName === "FoldCompleted");
      if (!swap) throw new Error("The confirmed receipt is missing the SwapAndFold event.");
      const swapArgs = swap.args as SwapEventArgs;
      if (!sameAddress(swapArgs.payer, account)
        || !sameAddress(swapArgs.hook, hookAddress)
        || !sameAddress(swapArgs.solver, account)
        || swapArgs.zeroForOne !== route.zeroForOne
        || swapArgs.amountIn !== parsedAmount) {
        throw new Error("The confirmed events do not match the signed route.");
      }
      nextResult = { ...nextResult, output: swapArgs.amountOut ?? null };
      if (!completed) throw new Error("The confirmed receipt is missing the FoldCompleted event.");
      const completedArgs = completed.args as CompletedEventArgs;
      if (!sameAddress(completedArgs.originHook, hookAddress) || !sameAddress(completedArgs.solver, account)) {
        throw new Error("FoldCompleted does not match the signed route.");
      }
      const reward = rounds.reduce((sum, event) => {
        const args = event.args as RoundEventArgs;
        if (!sameAddress(args.originHook, hookAddress) || !sameAddress(args.solver, account)) {
          throw new Error("A fold round belongs to a different route or solver.");
        }
        return sum + (args.solverReward ?? 0n);
      }, 0n);
      if (completedArgs.rounds !== undefined && completedArgs.rounds !== BigInt(rounds.length)) {
        throw new Error("The round count does not match the FoldRound events.");
      }
      nextResult = {
        ...nextResult,
        rounds: completedArgs.rounds ?? BigInt(rounds.length),
        roundEvents: rounds.length,
        residual: completedArgs.residualProfit ?? null,
        reward,
      };
    } catch (caught) {
      nextResult = { ...nextResult, decodeWarning: describeError(caught) };
    }

    // The confirmed receipt is authoritative. Refreshes are best-effort only.
    setResult(nextResult);
    setStatus(nextResult.decodeWarning
      ? "Transaction confirmed. Some receipt details could not be decoded."
      : "Swap and ARBFOLD confirmed on Unichain Sepolia.");
    await Promise.allSettled([
      refreshWalletState(account),
      onLiveStateChanged(),
      updateQuote(),
    ]);
  });

  const actionKind = derivePrimaryAction({
    deploymentReady: liveReady,
    tokenMetadataReady: Boolean(metadata),
    walletAvailable: Boolean(candidate),
    accountConnected: Boolean(account),
    correctChain: walletChainId === CHAIN_ID,
    hasGas: gasBalance > 0n,
    amountValid: !amountError,
    amountIn: parsedAmount,
    balance: balances[inputRole],
    allowance: allowances[inputRole],
    quoteReady: quote !== null && !quoteLoading,
  }) as LabActionKind;

  const missingAmount = parsedAmount > balances[inputRole] ? parsedAmount - balances[inputRole] : 0n;
  const confirmationCount = Number(missingAmount > 0n) + Number(allowances[inputRole] < parsedAmount);
  const cycle = cycleRoles(inputRole, outputRole) as TokenRole[];
  const [poolLeft, poolRight] = poolSymbols(route.hook);

  function setAmount(value: string) {
    setAmountState(value);
    setResult(null);
    setError("");
    setQuote(null);
  }

  function setInputRole(role: TokenRole) {
    if (role === outputRole) return;
    setInputRoleState(role);
    setResult(null);
    setError("");
    setQuote(null);
  }

  function setOutputRole(role: TokenRole) {
    if (role === inputRole) return;
    setOutputRoleState(role);
    setResult(null);
    setError("");
    setQuote(null);
  }

  function invertRoute() {
    setInputRoleState(outputRole);
    setOutputRoleState(inputRole);
    setResult(null);
    setError("");
    setQuote(null);
  }

  const runPrimaryAction = () => {
    if (busy) return;
    if (actionKind === "connect") return connect();
    if (actionKind === "switch") return switchNetwork();
    if (actionKind === "gas") return refreshGas();
    if (actionKind === "mint") return mintMissing();
    if (actionKind === "approve") return approveSelected();
    if (actionKind === "quote") return refreshQuote();
    if (actionKind === "execute") return execute();
  };

  return {
    account,
    actionKind,
    activeAction,
    amount,
    amountError,
    balances,
    busy,
    candidate,
    candidateName: providerName(candidate),
    confirmationCount,
    cycle,
    error: metadataError || error,
    gasBalance,
    gasBalanceLabel: `${Number(formatEther(gasBalance)).toFixed(5)} test ETH`,
    inputRole,
    inputToken,
    invertRoute,
    metadata,
    missingAmount,
    outputRole,
    outputToken,
    parsedAmount,
    poolLabel: `${poolLeft} / ${poolRight}`,
    quote,
    quoteLoading,
    result,
    route,
    runPrimaryAction,
    setAmount,
    setInputRole,
    setOutputRole,
    status,
    resetResult: () => {
      setResult(null);
      setError("");
      void updateQuote();
    },
  };
}
