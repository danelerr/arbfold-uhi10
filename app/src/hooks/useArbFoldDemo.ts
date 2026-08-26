import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createWalletClient,
  custom,
  decodeEventLog,
  formatEther,
  parseUnits,
  type Address,
  type Hash,
  type WalletClient,
} from "viem";
import { bufferedGasLimit, networkChanged, parseDemoAmount } from "../../live-core.js";
import {
  CHAIN_HEX,
  CHAIN_ID,
  DEMO_ALLOWANCE,
  EXPLORER_URL,
  RPC_URL,
  abbreviated,
  canonicalAddress,
  coordinatorAbi,
  describeError,
  publicClient,
  readLiveState,
  routerAbi,
  tokenAbi,
  tokenAmount,
  unichainSepolia,
} from "../lib/arbfold";
import type {
  BrowserProvider,
  DeploymentManifest,
  WalletCandidate,
  WalletResult,
} from "../types";

interface UseArbFoldDemoOptions {
  manifest: DeploymentManifest | null;
  liveReady: boolean;
  onLiveStateChanged: () => Promise<void>;
}

interface DecodedArgs {
  payer?: Address;
  amountOut?: bigint;
  solverReward?: bigint;
  rounds?: bigint;
  residualProfit?: bigint;
}

const DEFAULT_AMOUNT = "1000";
type DemoAction = "connect" | "prepare" | "refresh" | "execute" | "simulate";

function providerName(candidate: WalletCandidate | null): string {
  if (candidate?.info.name) return candidate.info.name;
  if (candidate?.provider.isMetaMask) return "MetaMask";
  if (candidate?.provider.isCoinbaseWallet) return "Coinbase Wallet";
  if (candidate?.provider.isBraveWallet) return "Brave Wallet";
  return candidate ? "Browser wallet" : "No browser wallet";
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

export function useArbFoldDemo({ manifest, liveReady, onLiveStateChanged }: UseArbFoldDemoOptions) {
  const announced = useRef<WalletCandidate[]>([]);
  const quoteSequence = useRef(0);
  const [candidate, setCandidate] = useState<WalletCandidate | null>(() => chooseCandidate(legacyCandidates()));
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [balance, setBalance] = useState(0n);
  const [allowance, setAllowance] = useState(0n);
  const [gasBalance, setGasBalance] = useState(0n);
  const [activeAction, setActiveAction] = useState<DemoAction | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Verifying the public deployment before enabling wallet actions.");
  const [quote, setQuote] = useState<bigint | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [result, setResult] = useState<WalletResult | null>(null);
  const [simulationAmount, setSimulationAmount] = useState(DEFAULT_AMOUNT);
  const [simulationStatus, setSimulationStatus] = useState("Waiting for live RPC verification.");

  const parsedAmount = useMemo(() => {
    try {
      return parseUnits(parseDemoAmount(amount), 18);
    } catch {
      return 0n;
    }
  }, [amount]);

  const amountError = useMemo(() => {
    try {
      parseDemoAmount(amount);
      return "";
    } catch (error) {
      return describeError(error);
    }
  }, [amount]);

  const simulationError = useMemo(() => {
    try {
      parseDemoAmount(simulationAmount);
      return "";
    } catch (error) {
      return describeError(error);
    }
  }, [simulationAmount]);

  const needsMint = Boolean(account && balance < DEMO_ALLOWANCE);
  const needsApproval = Boolean(account && allowance < DEMO_ALLOWANCE);
  const prepared = Boolean(account && !needsMint && !needsApproval);
  const preparationTransactions = Number(needsMint) + Number(needsApproval);

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
    if (liveReady && !account) setStatus("Deployment verified. Connect a wallet or run the no-wallet preview.");
    if (liveReady) setSimulationStatus("Ready. This preview will not sign or change blockchain state.");
  }, [account, liveReady]);

  const refreshWalletState = useCallback(async (selectedAccount = account) => {
    if (!selectedAccount || !manifest) return;
    const token = canonicalAddress(manifest.tokens.b);
    const router = canonicalAddress(manifest.router);
    const [nextGas, nextBalance, nextAllowance] = await Promise.all([
      publicClient.getBalance({ address: selectedAccount }),
      publicClient.readContract({ address: token, abi: tokenAbi, functionName: "balanceOf", args: [selectedAccount] }),
      publicClient.readContract({ address: token, abi: tokenAbi, functionName: "allowance", args: [selectedAccount, router] }),
    ]);
    setGasBalance(nextGas);
    setBalance(nextBalance);
    setAllowance(nextAllowance);
  }, [account, manifest]);

  useEffect(() => {
    if (!manifest || !liveReady || parsedAmount === 0n) {
      setQuote(null);
      return;
    }
    const sequence = ++quoteSequence.current;
    setQuoteLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const simulation = await publicClient.simulateContract({
          account: canonicalAddress(manifest.rpcSimulation.account),
          address: canonicalAddress(manifest.router),
          abi: routerAbi,
          functionName: "swapExactInput",
          args: [
            canonicalAddress(manifest.hooks.ab),
            false,
            parsedAmount,
            0n,
            canonicalAddress(manifest.rpcSimulation.account),
            BigInt(Math.floor(Date.now() / 1_000) + 900),
          ],
        });
        if (sequence === quoteSequence.current) setQuote(simulation.result);
      } catch {
        if (sequence === quoteSequence.current) setQuote(null);
      } finally {
        if (sequence === quoteSequence.current) setQuoteLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [liveReady, manifest, parsedAmount]);

  async function switchToUnichain(provider: BrowserProvider) {
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
    } catch (error) {
      const candidateError = error as { code?: number; cause?: { code?: number } };
      if ((candidateError.code ?? candidateError.cause?.code) !== 4902) throw error;
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

  const busy = activeAction !== null;

  const runAction = useCallback(async (actionName: DemoAction, action: () => Promise<void>) => {
    if (activeAction) return;
    setActiveAction(actionName);
    setError("");
    try {
      await action();
    } catch (error) {
      const message = describeError(error);
      if (actionName === "simulate") {
        setSimulationStatus(`Preview failed: ${message}`);
      } else {
        setError(message);
        setStatus(message);
      }
    } finally {
      setActiveAction(null);
    }
  }, [activeAction]);

  const connect = () => runAction("connect", async () => {
    if (!liveReady) throw new Error("Wait for public deployment verification first");
    if (!candidate) throw new Error("No browser wallet detected. Install MetaMask or use the no-wallet preview.");
    const provider = candidate.provider;
    await provider.request({ method: "eth_requestAccounts" });
    await switchToUnichain(provider);
    const connectedChain = await provider.request({ method: "eth_chainId" }) as string;
    if (Number.parseInt(connectedChain, 16) !== CHAIN_ID) throw new Error("Wallet did not switch to Unichain Sepolia");
    const accounts = await provider.request({ method: "eth_accounts" }) as string[];
    if (!accounts.length) throw new Error("No wallet account is connected");
    const selectedAccount = canonicalAddress(accounts[0]);
    const client = createWalletClient({
      account: selectedAccount,
      chain: unichainSepolia,
      transport: custom(provider),
    });
    setWalletClient(client);
    setAccount(selectedAccount);
    provider.on("accountsChanged", () => window.location.reload());
    provider.on("chainChanged", () => window.location.reload());
    await refreshWalletState(selectedAccount);
    setStatus("Wallet connected. Checking whether your free test tokens are ready.");
  });

  const sendContract = useCallback(async (
    functionName: "mint" | "approve",
    address: Address,
    args: readonly [Address, bigint],
  ) => {
    if (!account || !walletClient) throw new Error("Connect your wallet first");
    const simulation = await publicClient.simulateContract({
      account,
      address,
      abi: tokenAbi,
      functionName,
      args,
    });
    const estimatedGas = await publicClient.estimateContractGas(simulation.request);
    const hash = await walletClient.writeContract({
      ...simulation.request,
      gas: bufferedGasLimit(estimatedGas),
    });
    setStatus(`Submitted ${abbreviated(hash)}. Waiting for Unichain Sepolia…`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (receipt.status !== "success") throw new Error(`${functionName} transaction reverted`);
  }, [account, walletClient]);

  const prepare = () => runAction("prepare", async () => {
    if (!account || !manifest) throw new Error("Connect your wallet first");
    const token = canonicalAddress(manifest.tokens.b);
    const router = canonicalAddress(manifest.router);
    if (balance < DEMO_ALLOWANCE) {
      setStatus("Confirm in MetaMask to create free ARFX test tokens.");
      await sendContract("mint", token, [account, DEMO_ALLOWANCE - balance]);
    }
    if (allowance < DEMO_ALLOWANCE) {
      setStatus("Confirm in MetaMask to let this demo router use up to 25,000 ARFX.");
      await sendContract("approve", token, [router, DEMO_ALLOWANCE]);
    }
    await refreshWalletState(account);
    setStatus("Demo ready. You can now create the cycle and run ARBFOLD.");
  });

  const refresh = () => runAction("refresh", async () => {
    await refreshWalletState();
    setStatus("Wallet balances refreshed from Unichain Sepolia.");
  });

  const execute = () => runAction("execute", async () => {
    if (!account || !manifest || !walletClient || parsedAmount === 0n) throw new Error("Connect and prepare your test tokens first");
    if (!prepared) throw new Error("Prepare the free ARFX test tokens first");
    const router = canonicalAddress(manifest.router);
    const originHook = canonicalAddress(manifest.hooks.ab);
    const before = await readLiveState(manifest);
    const deadline = BigInt(Math.floor(Date.now() / 1_000) + 900);
    setStatus("Calculating the current deployed-pool quote…");
    const currentQuote = await publicClient.simulateContract({
      account,
      address: router,
      abi: routerAbi,
      functionName: "swapExactInput",
      args: [originHook, false, parsedAmount, 0n, account, deadline],
    });
    setQuote(currentQuote.result);
    const minimumOut = currentQuote.result * 995n / 1_000n;
    setStatus(`MetaMask will request one testnet transaction: spend ${tokenAmount(parsedAmount)} ARFX and receive about ${tokenAmount(currentQuote.result)} ARFY.`);
    const execution = await publicClient.simulateContract({
      account,
      address: router,
      abi: routerAbi,
      functionName: "swapExactInput",
      args: [originHook, false, parsedAmount, minimumOut, account, deadline],
    });
    const estimatedGas = await publicClient.estimateContractGas(execution.request);
    const hash = await walletClient.writeContract({
      ...execution.request,
      gas: bufferedGasLimit(estimatedGas),
    });
    setStatus(`Transaction ${abbreviated(hash)} submitted. Waiting for confirmation…`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (receipt.status !== "success") throw new Error("The swap + ARBFOLD transaction reverted");
    const after = await readLiveState(manifest, receipt.blockNumber);
    if (!networkChanged(before.network, after.network)) throw new Error("Transaction succeeded but the pool reserves did not change");

    const decoded = receipt.logs.flatMap((log) => {
      for (const abi of [routerAbi, coordinatorAbi]) {
        try {
          return [decodeEventLog({ abi, data: log.data, topics: log.topics, strict: true })];
        } catch {
          // PoolManager and ERC-20 logs are unrelated to the demo receipt.
        }
      }
      return [];
    });
    const swap = decoded.find((event) => event.eventName === "SwapAndFold");
    const roundEvents = decoded.filter((event) => event.eventName === "FoldRound");
    const completed = decoded.find((event) => event.eventName === "FoldCompleted");
    if (!swap || !completed) throw new Error("The confirmed receipt is missing ARBFOLD events");
    const swapArgs = swap.args as DecodedArgs;
    const completedArgs = completed.args as DecodedArgs;
    const reward = roundEvents.reduce((sum, event) => sum + (((event.args as DecodedArgs).solverReward) ?? 0n), 0n);
    const nextResult: WalletResult = {
      hash: hash as Hash,
      output: swapArgs.amountOut ?? 0n,
      rounds: completedArgs.rounds ?? 0n,
      roundEvents: roundEvents.length,
      residual: completedArgs.residualProfit ?? 0n,
      reward,
      gasUsed: receipt.gasUsed,
      blockNumber: receipt.blockNumber,
    };
    setResult(nextResult);
    await Promise.all([refreshWalletState(account), onLiveStateChanged()]);
    setStatus("Confirmed. The swap and direct three-pool transition settled together.");
  });

  const simulate = () => runAction("simulate", async () => {
    if (!manifest) throw new Error("Deployment manifest is not loaded");
    const input = parseUnits(parseDemoAmount(simulationAmount), 18);
    if (input > BigInt(manifest.rpcSimulation.maximumInput)) throw new Error("Input exceeds the prepared no-wallet preview limit");
    const simulationAccount = canonicalAddress(manifest.rpcSimulation.account);
    const args = [
      canonicalAddress(manifest.hooks.ab),
      false,
      input,
      0n,
      simulationAccount,
      BigInt(Math.floor(Date.now() / 1_000) + 900),
    ] as const;
    setSimulationStatus("Running the deployed swap + ARBFOLD call without changing state…");
    const [simulation, gas] = await Promise.all([
      publicClient.simulateContract({ account: simulationAccount, address: canonicalAddress(manifest.router), abi: routerAbi, functionName: "swapExactInput", args }),
      publicClient.estimateContractGas({ account: simulationAccount, address: canonicalAddress(manifest.router), abi: routerAbi, functionName: "swapExactInput", args }),
    ]);
    setSimulationStatus(`Preview passed: ${tokenAmount(input)} ARFX → ${tokenAmount(simulation.result)} ARFY · about ${gas.toLocaleString("en-US")} gas · no signature · no state change.`);
  });

  return {
    account,
    activeAction,
    allowance,
    amount,
    amountError,
    balance,
    busy,
    candidate,
    candidateName: providerName(candidate),
    connect,
    execute,
    error,
    gasBalance: `${Number(formatEther(gasBalance)).toFixed(5)} test ETH`,
    hasGas: gasBalance > 0n,
    needsApproval,
    needsMint,
    prepared,
    preparationTransactions,
    prepare,
    quote,
    quoteLoading,
    refresh,
    result,
    setAmount,
    setSimulationAmount,
    simulate,
    simulationAmount,
    simulationError,
    simulationStatus,
    status,
    refreshWalletState,
    resetResult: () => setResult(null),
  };
}
