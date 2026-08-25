import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  formatEther,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  parseUnits,
} from "viem";
import {
  bufferedGasLimit,
  networkChanged,
  normalizeNetwork,
  parseDemoAmount,
  reductionPercent,
  validateManifest,
} from "./live-core.js";

const CHAIN_ID = 1301;
const CHAIN_HEX = "0x515";
const RPC_URL = "https://sepolia.unichain.org";
const EXPLORER_URL = "https://sepolia.uniscan.xyz";
const TOKEN_DECIMALS = 18;
const DEMO_ALLOWANCE = 25_000n * 10n ** 18n;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const unichainSepolia = {
  id: CHAIN_ID,
  name: "Unichain Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Uniscan", url: EXPLORER_URL } },
  testnet: true,
};

const hookAbi = parseAbi(["function reserves() view returns (uint256 reserve0, uint256 reserve1)"]);
const coordinatorAbi = parseAbi([
  "function totalFoldCalls() view returns (uint256)",
  "function totalFoldRounds() view returns (uint256)",
  "function lastResidualProfit() view returns (uint256)",
  "event FoldRound(address indexed originHook, address indexed solver, uint256 indexed round, bool reverse, uint256 threatenedProfit, uint256 solverReward)",
  "event FoldCompleted(address indexed originHook, address indexed solver, uint256 rounds, uint256 residualProfit)",
]);
const routerAbi = parseAbi([
  "function swapExactInput(address hook, bool zeroForOne, uint256 amountIn, uint256 minAmountOut, address solver, uint256 deadline) returns (uint256 amountOut)",
  "event SwapAndFold(address indexed payer, address indexed hook, address indexed solver, bool zeroForOne, uint256 amountIn, uint256 amountOut)",
]);
const tokenAbi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
]);

const publicClient = createPublicClient({
  chain: unichainSepolia,
  transport: http(RPC_URL, { retryCount: 3, retryDelay: 500 }),
});

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });
let manifest;
let walletClient;
let walletAccount;
let walletProvider;
let liveReady = false;
let benchmarkReady = false;
let actionBusy = false;
let replayRunning = false;
let replayTimers = [];
const announcedWallets = [];
const boundWalletProviders = new WeakSet();

function element(id) {
  return document.querySelector(`#${id}`);
}

function setText(id, value) {
  const target = element(id);
  if (target) target.textContent = value;
}

function abbreviated(value) {
  return value?.startsWith("0x") ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function canonicalAddress(value) {
  return getAddress(value.toLowerCase());
}

function walletCandidates() {
  const candidates = [...announcedWallets];
  const legacy = window.ethereum;
  const legacyProviders = Array.isArray(legacy?.providers) ? legacy.providers : [];
  legacyProviders.forEach((provider) => candidates.push({ provider, info: {} }));
  if (legacy) candidates.push({ provider: legacy, info: {} });

  return candidates.filter((candidate, index, all) => (
    candidate?.provider?.request
    && all.findIndex((item) => item?.provider === candidate.provider) === index
  ));
}

function selectWallet() {
  const candidates = walletCandidates();
  return candidates.find((candidate) => candidate.info?.rdns === "io.metamask")
    || candidates.find((candidate) => candidate.provider?.isMetaMask && !candidate.provider?.isRabby)
    || candidates[0]
    || null;
}

function walletName(candidate) {
  if (candidate?.info?.name) return candidate.info.name;
  if (candidate?.provider?.isMetaMask) return "MetaMask";
  if (candidate?.provider?.isCoinbaseWallet) return "Coinbase Wallet";
  if (candidate?.provider?.isBraveWallet) return "Brave Wallet";
  return "Browser wallet";
}

function refreshWalletAvailability() {
  const button = element("live-connect");
  const status = element("live-wallet-status");
  const help = element("wallet-provider-help");
  const step = element("wallet-step-connect");
  if (!button || !status) return;

  const candidate = selectWallet();
  walletProvider = candidate?.provider || null;
  if (walletAccount) {
    button.disabled = true;
    button.textContent = "Connected";
    status.className = "live-status ready";
    status.textContent = abbreviated(walletAccount);
    step?.classList.remove("is-ready");
    step?.classList.add("is-complete");
    if (help) help.hidden = true;
    return;
  }

  if (!candidate) {
    button.disabled = true;
    button.textContent = "Wallet not found";
    status.className = "live-status error";
    status.textContent = "No browser wallet detected";
    step?.classList.remove("is-ready", "is-complete");
    if (help) {
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      help.hidden = false;
      help.textContent = mobile ? "Open this demo in MetaMask" : "Install a browser wallet";
      help.href = mobile
        ? "https://metamask.app.link/dapp/danelerr.github.io/arbfold-uhi10/"
        : "https://metamask.io/download/";
    }
    return;
  }

  button.disabled = actionBusy || !liveReady;
  button.textContent = liveReady ? "Connect" : "Verifying";
  status.className = "live-status";
  status.textContent = `${walletName(candidate)} detected`;
  step?.classList.toggle("is-ready", liveReady);
  step?.classList.remove("is-complete");
  if (help) help.hidden = true;
}

function bindWalletEvents(provider) {
  if (!provider?.on || boundWalletProviders.has(provider)) return;
  provider.on("accountsChanged", () => window.location.reload());
  provider.on("chainChanged", () => window.location.reload());
  boundWalletProviders.add(provider);
}

function tokenAmount(value, precision = 6) {
  if (value === undefined || value === null) return "—";
  const rendered = formatUnits(BigInt(value), TOKEN_DECIMALS);
  const [whole, fraction = ""] = rendered.split(".");
  const shortFraction = fraction.slice(0, precision).replace(/0+$/, "");
  return shortFraction ? `${Number(whole).toLocaleString("en-US")}.${shortFraction}` : Number(whole).toLocaleString("en-US");
}

function reserveLine(reserves) {
  return [
    `ETH / USD-1   ${tokenAmount(reserves.abA)} ETH / ${tokenAmount(reserves.abB)} USD-1`,
    `USD-1 / USD-2 ${tokenAmount(reserves.bcB)} USD-1 / ${tokenAmount(reserves.bcC)} USD-2`,
    `ETH / USD-2   ${tokenAmount(reserves.acA)} ETH / ${tokenAmount(reserves.acC)} USD-2`,
  ].join("\n");
}

function setExplorerLink(id, kind, value, label = abbreviated(value)) {
  const link = element(id);
  if (!link) return;
  link.textContent = label;
  link.href = `${EXPLORER_URL}/${kind}/${value}`;
  link.target = "_blank";
  link.rel = "noreferrer";
}

function describeError(error) {
  const message = error?.shortMessage || error?.details || error?.message || String(error);
  if (/User rejected|user rejected|denied transaction signature/i.test(message)) return "The wallet request was cancelled.";
  if (/insufficient funds/i.test(message)) return "The wallet needs Unichain Sepolia ETH to pay testnet gas.";
  if (/TooLittleReceived/i.test(message)) return "The pool changed before confirmation. Refresh and try again.";
  return message.split("\n")[0].slice(0, 220);
}

function syncReplayAvailability() {
  const button = element("replay-demo");
  if (!button) return;
  button.disabled = !benchmarkReady || replayRunning;
  const replayStatus = element("replay-status")?.textContent || "";
  const proofFailed = element("proof-status")?.textContent === "Live verification failed";
  if (
    benchmarkReady
    && !replayRunning
    && /^(Loading|Benchmark loaded|Replay disabled|Ready)/.test(replayStatus)
  ) {
    setText(
      "replay-status",
      liveReady
        ? "Ready · public transaction verified · frozen benchmark loaded"
        : proofFailed
          ? "Ready · frozen benchmark loaded · onchain proof temporarily unavailable"
        : "Ready · frozen benchmark loaded · verifying onchain proof in parallel",
    );
  }
}

function resetReplayVisuals() {
  replayTimers.forEach((timer) => window.clearTimeout(timer));
  replayTimers = [];
  const consolePanel = element("replay-console");
  consolePanel?.classList.remove("is-replaying", "is-complete");
  element("replay-result")?.classList.remove("is-revealed");
  document.querySelectorAll("[data-replay-step]").forEach((step) => step.classList.remove("is-active", "is-done"));
}

function scheduleReplayStep(key, delay, speed) {
  replayTimers.push(window.setTimeout(() => {
    const step = document.querySelector(`[data-replay-step="${key}"]`);
    if (!step) return;
    step.parentElement.querySelectorAll("[data-replay-step].is-active").forEach((active) => {
      active.classList.remove("is-active");
      active.classList.add("is-done");
    });
    step.classList.add("is-active");
  }, delay * speed));
}

function runReplay() {
  if (!benchmarkReady || replayRunning) return;
  resetReplayVisuals();
  replayRunning = true;
  syncReplayAvailability();
  const consolePanel = element("replay-console");
  consolePanel.classList.add("is-replaying");
  setText("replay-status", "Replaying both equivalent execution paths…");

  const speed = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.05 : 1;
  ["backrun-0", "backrun-1", "backrun-2", "backrun-3", "backrun-4"].forEach((key, index) => scheduleReplayStep(key, index * 330, speed));
  ["direct-0", "direct-1", "direct-2"].forEach((key, index) => scheduleReplayStep(key, index * 470, speed));

  replayTimers.push(window.setTimeout(() => {
    document.querySelectorAll("[data-replay-step].is-active").forEach((step) => {
      step.classList.remove("is-active");
      step.classList.add("is-done");
    });
    consolePanel.classList.remove("is-replaying");
    consolePanel.classList.add("is-complete");
    element("replay-result").classList.add("is-revealed");
    setText("replay-status", "Replay complete · same output · same reward · equivalent final reserves");
    element("replay-demo").textContent = "Replay again";
    replayRunning = false;
    syncReplayAvailability();
  }, 1750 * speed));
}

async function loadJson(paths) {
  for (const path of paths) {
    const response = await fetch(path, { cache: "no-store" });
    if (response.ok) return response.json();
  }
  throw new Error(`Unable to load ${paths[0]}`);
}

async function loadBenchmark() {
  const payload = await loadJson([
    "./data/release-results.json",
    "../benchmark/release-candidate-results/raw.json",
  ]);
  const results = payload.rows.map((row) => ({
    size: Number(BigInt(row.origin_input_wei) / 10n ** 18n),
    backrun: Number(row.backrun_total_gas),
    direct: Number(row.direct_total_gas),
  }));
  const buttons = [...document.querySelectorAll("[data-size]")];

  function render(size) {
    const row = results.find((item) => item.size === size);
    if (!row) return;
    const reduction = reductionPercent(row.backrun, row.direct);
    setText("backrun-gas", numberFormat.format(row.backrun));
    setText("direct-gas", numberFormat.format(row.direct));
    setText("gas-saving", reduction >= 0 ? `${reduction.toFixed(2)}% less gas` : `${Math.abs(reduction).toFixed(2)}% more gas`);
    const gasDelta = row.backrun - row.direct;
    setText("gas-saved", gasDelta >= 0
      ? `${numberFormat.format(gasDelta)} gas avoided`
      : `${numberFormat.format(Math.abs(gasDelta))} additional gas`);
    setText("selected-size", `${numberFormat.format(size / 1000)}k`);
    buttons.forEach((button) => button.classList.toggle("active", Number(button.dataset.size) === size));
    if (!replayRunning) {
      element("replay-result")?.classList.add("is-revealed");
      element("replay-console")?.classList.remove("is-complete");
      setText("replay-status", `Selected ${numberFormat.format(size / 1000)}k benchmark`);
    }
  }

  buttons.forEach((button) => {
    button.disabled = false;
    button.addEventListener("click", () => render(Number(button.dataset.size)));
  });
  render(100000);
  benchmarkReady = true;
  syncReplayAvailability();
}

async function readLiveState(blockNumber) {
  const hooks = [manifest.hooks.ab, manifest.hooks.bc, manifest.hooks.ac].map(canonicalAddress);
  const atBlock = blockNumber === undefined ? {} : { blockNumber };
  const [ab, bc, ac, calls, rounds, residual, observedBlock] = await Promise.all([
    publicClient.readContract({ address: hooks[0], abi: hookAbi, functionName: "reserves", ...atBlock }),
    publicClient.readContract({ address: hooks[1], abi: hookAbi, functionName: "reserves", ...atBlock }),
    publicClient.readContract({ address: hooks[2], abi: hookAbi, functionName: "reserves", ...atBlock }),
    publicClient.readContract({ address: canonicalAddress(manifest.coordinator), abi: coordinatorAbi, functionName: "totalFoldCalls", ...atBlock }),
    publicClient.readContract({ address: canonicalAddress(manifest.coordinator), abi: coordinatorAbi, functionName: "totalFoldRounds", ...atBlock }),
    publicClient.readContract({ address: canonicalAddress(manifest.coordinator), abi: coordinatorAbi, functionName: "lastResidualProfit", ...atBlock }),
    blockNumber === undefined ? publicClient.getBlockNumber({ cacheTime: 0 }) : Promise.resolve(blockNumber),
  ]);
  return {
    network: normalizeNetwork([ab[0], ab[1], bc[0], bc[1], ac[0], ac[1]]),
    calls,
    rounds,
    residual,
    blockNumber: observedBlock,
  };
}

function renderLiveState(state) {
  setText("live-rpc-block", numberFormat.format(state.blockNumber));
  setText("live-fold-calls", numberFormat.format(state.calls));
  setText("live-fold-rounds", numberFormat.format(state.rounds));
  setText("live-residual", `${state.residual} wei ETH`);
  setText("live-current-reserves", reserveLine(state.network));
}

function renderManifestSnapshot(data) {
  const explorer = data.explorerBaseUrl.replace(/\/$/, "");
  const official = data.officialPoolManager !== ZERO_ADDRESS
    && data.officialPoolManager.toLowerCase() === data.poolManager.toLowerCase();
  setText("proof-network", `${data.network} · chain ${data.chainId}`);
  setText("proof-manager-kind", official ? "Official Uniswap v4 PoolManager" : "Isolated research PoolManager");
  setText("proof-block", numberFormat.format(data.blockNumber));
  setText("proof-source", data.sourceVerification);
  setExplorerLink("proof-transaction", "tx", data.canonicalDemoTransaction, "Onchain transaction");
  setExplorerLink("proof-manager", "address", data.poolManager);
  setExplorerLink("proof-coordinator", "address", data.coordinator);
  setExplorerLink("proof-router", "address", data.router);
  setExplorerLink("proof-hook-ab", "address", data.hooks.ab);
  setExplorerLink("proof-hook-bc", "address", data.hooks.bc);
  setExplorerLink("proof-hook-ac", "address", data.hooks.ac);
  setText("proof-swap", `${tokenAmount(data.demo.amountIn)} Demo USD-1 → ${tokenAmount(data.demo.amountOut)} Demo ETH`);
  setText("proof-rounds", `${data.demo.foldRounds} verified fold round${data.demo.foldRounds === 1 ? "" : "s"}`);
  setText("proof-reward", `${tokenAmount(data.demo.solverReward)} Demo ETH`);
  setText("proof-residual", `${data.demo.residualProfit} wei Demo ETH`);
  setText("replay-origin-detail", `${tokenAmount(data.demo.amountIn)} Demo USD-1 → ${tokenAmount(data.demo.amountOut)} Demo ETH · block ${numberFormat.format(data.blockNumber)}`);
  setText("replay-user-output", `${tokenAmount(data.demo.amountOut)} Demo ETH`);
  setText("replay-solver-reward", `${tokenAmount(data.demo.solverReward)} Demo ETH`);
  setText("replay-residual", `${data.demo.residualProfit} wei`);
  setText("proof-pre-reserves", reserveLine(data.demo.preReserves));
  setText("proof-post-reserves", reserveLine(data.demo.postReserves));
  const commitLink = element("proof-commit");
  if (commitLink) {
    commitLink.textContent = data.gitCommit.slice(0, 12);
    commitLink.href = `https://github.com/danelerr/arbfold-uhi10/commit/${data.gitCommit}`;
    commitLink.target = "_blank";
  }
  const proofTransaction = element("proof-transaction");
  if (proofTransaction) proofTransaction.href = `${explorer}/tx/${data.canonicalDemoTransaction}`;
  if (data.interactiveDemo?.transaction) {
    setExplorerLink("live-validation-link", "tx", data.interactiveDemo.transaction);
    setText(
      "live-validation-detail",
      ` · ${tokenAmount(data.interactiveDemo.amountIn)} Demo USD-1 → ${tokenAmount(data.interactiveDemo.amountOut)} Demo ETH · ${data.interactiveDemo.foldRounds} round · residual ${data.interactiveDemo.residualProfit}`,
    );
  }
}

async function verifyLiveDeployment(data) {
  const [chainId, receipt, interactiveReceipt, ...codes] = await Promise.all([
    publicClient.getChainId(),
    publicClient.getTransactionReceipt({ hash: data.canonicalDemoTransaction }),
    data.interactiveDemo?.transaction
      ? publicClient.getTransactionReceipt({ hash: data.interactiveDemo.transaction })
      : Promise.resolve(null),
    ...[
      data.poolManager,
      data.coordinator,
      data.router,
      data.hooks.ab,
      data.hooks.bc,
      data.hooks.ac,
    ].map((address) => publicClient.getCode({ address: canonicalAddress(address) })),
  ]);
  if (chainId !== CHAIN_ID) throw new Error(`RPC returned chain ${chainId}, expected ${CHAIN_ID}`);
  if (receipt.status !== "success") throw new Error("canonical transaction did not succeed");
  if (interactiveReceipt && interactiveReceipt.status !== "success") throw new Error("interactive validation transaction did not succeed");
  if (codes.some((code) => !code || code === "0x")) throw new Error("one or more deployed contracts have no bytecode");
  return readLiveState();
}

async function loadOnchainProof() {
  const proofStatus = element("proof-status");
  try {
    manifest = validateManifest(await loadJson([
      "./deployments/unichain-sepolia-1301.json",
      "../deployments/unichain-sepolia-1301.json",
    ]));
    renderManifestSnapshot(manifest);
    const state = await verifyLiveDeployment(manifest);
    renderLiveState(state);
    liveReady = true;
    proofStatus?.classList.remove("pending");
    proofStatus?.classList.add("ready");
    setText("proof-status", "Public deployment verified");
    if (element("live-rpc-status")) element("live-rpc-status").className = "live-status ready";
    setText("live-rpc-status", "Connected to Unichain Sepolia");
    setText("live-simulation-result", "Ready. Deployed router verified through live RPC.");
    setText("proof-pending-detail", "Verified now through RPC: chain ID, canonical receipt, deployed bytecode, live counters and current reserves.");
    if (element("live-refresh")) element("live-refresh").disabled = false;
    if (element("live-simulate")) element("live-simulate").disabled = false;
    refreshWalletAvailability();
    syncReplayAvailability();
  } catch (error) {
    liveReady = false;
    proofStatus?.classList.remove("ready");
    proofStatus?.classList.add("pending");
    setText("proof-status", "Live verification failed");
    if (element("live-rpc-status")) element("live-rpc-status").className = "live-status error";
    setText("live-rpc-status", "RPC verification failed");
    setText("live-simulation-result", `Live simulation unavailable · ${describeError(error)}`);
    setText("proof-pending-detail", `Fail-closed: the page will not claim a live deployment. ${describeError(error)}`);
    setText("live-action-status", describeError(error));
    setText("replay-status", `Ready · benchmark available · onchain proof unavailable: ${describeError(error)}`);
    refreshWalletAvailability();
    syncReplayAvailability();
  }
}

async function refreshLiveState() {
  if (!liveReady) return;
  const state = await readLiveState();
  renderLiveState(state);
}

async function simulateLiveDemo() {
  if (!manifest.rpcSimulation?.account) throw new Error("No public simulation account is configured");
  const amount = parseUnits(parseDemoAmount(element("live-amount").value), TOKEN_DECIMALS);
  const maximumInput = BigInt(manifest.rpcSimulation.maximumInput);
  if (amount > maximumInput) throw new Error("Input exceeds the public dry-run allowance");
  const account = canonicalAddress(manifest.rpcSimulation.account);
  const address = canonicalAddress(manifest.router);
  const args = [
    canonicalAddress(manifest.hooks.ab),
    false,
    amount,
    0n,
    account,
    BigInt(Math.floor(Date.now() / 1000) + 15 * 60),
  ];
  setText("live-simulation-result", "Running the complete deployed swap + fold as an RPC dry-run…");
  const [simulation, gas] = await Promise.all([
    publicClient.simulateContract({ account, address, abi: routerAbi, functionName: "swapExactInput", args }),
    publicClient.estimateContractGas({ account, address, abi: routerAbi, functionName: "swapExactInput", args }),
  ]);
  setText(
    "live-simulation-result",
    `PASS · ${tokenAmount(amount)} Demo USD-1 to ${tokenAmount(simulation.result)} Demo ETH · estimated ${numberFormat.format(gas)} gas · no signature · no state change`,
  );
}

async function switchToUnichain(provider) {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  } catch (error) {
    const code = error?.code ?? error?.cause?.code;
    if (code !== 4902) throw error;
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

async function connectWallet() {
  if (!liveReady) throw new Error("Wait for live RPC verification first");
  const candidate = selectWallet();
  if (!candidate) {
    refreshWalletAvailability();
    throw new Error("No browser wallet detected. A Cast keystore is not exposed to webpages.");
  }
  walletProvider = candidate.provider;
  await walletProvider.request({ method: "eth_requestAccounts" });
  await switchToUnichain(walletProvider);
  const connectedChain = await walletProvider.request({ method: "eth_chainId" });
  if (Number.parseInt(connectedChain, 16) !== CHAIN_ID) {
    throw new Error("Wallet did not switch to Unichain Sepolia");
  }
  const accounts = await walletProvider.request({ method: "eth_accounts" });
  if (!accounts.length) throw new Error("No wallet account is connected");
  walletAccount = canonicalAddress(accounts[0]);
  walletClient = createWalletClient({
    account: walletAccount,
    chain: unichainSepolia,
    transport: custom(walletProvider),
  });
  bindWalletEvents(walletProvider);
  setText("live-wallet-status", abbreviated(walletAccount));
  element("live-wallet-status").className = "live-status ready";
  element("live-connect").textContent = "Wallet connected";
  element("wallet-step-connect")?.classList.remove("is-ready");
  element("wallet-step-connect")?.classList.add("is-complete");
  await refreshWalletState();
}

function walletInputAmount() {
  return parseUnits(parseDemoAmount(element("wallet-amount").value), TOKEN_DECIMALS);
}

async function refreshWalletState() {
  if (!walletAccount || !manifest) return;
  const tokenB = canonicalAddress(manifest.tokens.b);
  const router = canonicalAddress(manifest.router);
  const [eth, balance, allowance] = await Promise.all([
    publicClient.getBalance({ address: walletAccount }),
    publicClient.readContract({ address: tokenB, abi: tokenAbi, functionName: "balanceOf", args: [walletAccount] }),
    publicClient.readContract({ address: tokenB, abi: tokenAbi, functionName: "allowance", args: [walletAccount, router] }),
  ]);
  setText("live-eth-balance", `${Number(formatEther(eth)).toFixed(5)} ETH`);
  setText("live-token-balance", `${tokenAmount(balance)} Demo USD-1`);
  setText("live-allowance", `${tokenAmount(allowance)} Demo USD-1`);
  let amount = 0n;
  try {
    amount = walletInputAmount();
  } catch {
    // The input listener renders the actionable validation message.
  }
  const prepared = amount > 0n && balance >= amount && allowance >= amount;
  element("live-prepare").disabled = actionBusy || prepared;
  element("live-prepare").textContent = prepared ? "Tokens ready" : "Get test tokens";
  element("live-execute").disabled = actionBusy || !prepared;
  element("wallet-step-prepare")?.classList.toggle("is-complete", prepared);
  element("wallet-step-prepare")?.classList.toggle("is-ready", !prepared);
  element("wallet-step-execute")?.classList.toggle("is-ready", prepared);
}

async function sendContract(functionName, address, abi, args) {
  const simulation = await publicClient.simulateContract({
    account: walletAccount,
    address,
    abi,
    functionName,
    args,
  });
  const estimatedGas = await publicClient.estimateContractGas(simulation.request);
  const hash = await walletClient.writeContract({
    ...simulation.request,
    gas: bufferedGasLimit(estimatedGas),
  });
  setText("live-action-status", `Submitted ${abbreviated(hash)}. Waiting for confirmation…`);
  return publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
}

async function prepareDemo() {
  const amount = walletInputAmount();
  const tokenB = canonicalAddress(manifest.tokens.b);
  const router = canonicalAddress(manifest.router);
  const [balance, allowance] = await Promise.all([
    publicClient.readContract({ address: tokenB, abi: tokenAbi, functionName: "balanceOf", args: [walletAccount] }),
    publicClient.readContract({ address: tokenB, abi: tokenAbi, functionName: "allowance", args: [walletAccount, router] }),
  ]);
  if (balance < amount) {
    setText("live-action-status", "Step 1/2: confirm minting valueless Demo USD-1…");
    await sendContract("mint", tokenB, tokenAbi, [walletAccount, amount - balance]);
  }
  if (allowance < amount) {
    setText("live-action-status", "Step 2/2: confirm the bounded Demo USD-1 allowance…");
    await sendContract("approve", tokenB, tokenAbi, [router, DEMO_ALLOWANCE]);
  }
  setText("live-action-status", "Demo assets ready. You can now execute the Demo USD-1 → Demo ETH swap and fold.");
  await refreshWalletState();
}

function decodedEvents(receipt) {
  const events = [];
  for (const log of receipt.logs) {
    for (const abi of [routerAbi, coordinatorAbi]) {
      try {
        events.push(decodeEventLog({ abi, data: log.data, topics: log.topics, strict: true }));
        break;
      } catch {
        // The receipt also contains PoolManager and ERC-20 events; ignore unrelated logs.
      }
    }
  }
  return events;
}

async function executeDemo() {
  const amount = walletInputAmount();
  const router = canonicalAddress(manifest.router);
  const originHook = canonicalAddress(manifest.hooks.ab);
  const tokenB = canonicalAddress(manifest.tokens.b);
  const [balance, allowance] = await Promise.all([
    publicClient.readContract({ address: tokenB, abi: tokenAbi, functionName: "balanceOf", args: [walletAccount] }),
    publicClient.readContract({ address: tokenB, abi: tokenAbi, functionName: "allowance", args: [walletAccount, router] }),
  ]);
  if (balance < amount || allowance < amount) throw new Error("Prepare Demo USD-1 and allowance before executing");

  const before = await readLiveState();
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
  setText("live-action-status", "Quoting the real deployed router…");
  const quote = await publicClient.simulateContract({
    account: walletAccount,
    address: router,
    abi: routerAbi,
    functionName: "swapExactInput",
    args: [originHook, false, amount, 0n, walletAccount, deadline],
  });
  const minimumOut = quote.result * 995n / 1000n;
  setText("live-action-status", `Confirm one atomic transaction. Quoted output: ${tokenAmount(quote.result)} Demo ETH.`);
  const execution = await publicClient.simulateContract({
    account: walletAccount,
    address: router,
    abi: routerAbi,
    functionName: "swapExactInput",
    args: [originHook, false, amount, minimumOut, walletAccount, deadline],
  });
  const estimatedGas = await publicClient.estimateContractGas(execution.request);
  const hash = await walletClient.writeContract({
    ...execution.request,
    gas: bufferedGasLimit(estimatedGas),
  });
  setText("live-action-status", `Broadcast ${abbreviated(hash)}. Waiting for Unichain Sepolia…`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  const after = await readLiveState(receipt.blockNumber);
  if (receipt.status !== "success") throw new Error("The swap + fold transaction reverted");
  if (!networkChanged(before.network, after.network)) throw new Error("Transaction succeeded but network reserves did not change");

  const events = decodedEvents(receipt);
  const swap = events.find((event) => event.eventName === "SwapAndFold");
  const rounds = events.filter((event) => event.eventName === "FoldRound");
  const completed = events.find((event) => event.eventName === "FoldCompleted");
  if (!swap || !completed) throw new Error("Expected ARBFOLD events were not found in the receipt");

  element("live-result").hidden = false;
  setExplorerLink("live-result-tx", "tx", hash, abbreviated(hash));
  setText("live-result-block", numberFormat.format(receipt.blockNumber));
  setText("live-result-gas", numberFormat.format(receipt.gasUsed));
  setText("live-result-output", `${tokenAmount(swap.args.amountOut)} Demo ETH`);
  setText("live-result-rounds", `${completed.args.rounds} (${rounds.length} FoldRound event${rounds.length === 1 ? "" : "s"})`);
  const reward = rounds.reduce((sum, event) => sum + event.args.solverReward, 0n);
  setText("live-result-reward", `${tokenAmount(reward)} Demo ETH`);
  setText("live-result-residual", `${completed.args.residualProfit} wei Demo ETH`);
  setText("live-result-before", reserveLine(before.network));
  setText("live-result-after", reserveLine(after.network));
  setText("live-action-status", "Confirmed: the deployed router executed the user swap and ARBFOLD transition atomically.");
  renderLiveState(after);
  await refreshWalletState();
}

async function runAction(action) {
  if (actionBusy) return;
  actionBusy = true;
  for (const id of ["live-connect", "live-refresh", "live-simulate", "live-prepare", "live-execute"]) {
    if (element(id)) element(id).disabled = true;
  }
  try {
    await action();
  } catch (error) {
    setText("live-action-status", describeError(error));
  } finally {
    actionBusy = false;
    refreshWalletAvailability();
    if (element("live-refresh")) element("live-refresh").disabled = !liveReady;
    if (element("live-simulate")) element("live-simulate").disabled = !liveReady;
    if (walletAccount) await refreshWalletState();
  }
}

element("live-connect")?.addEventListener("click", () => runAction(connectWallet));
element("replay-demo")?.addEventListener("click", runReplay);
element("live-refresh")?.addEventListener("click", () => runAction(refreshLiveState));
element("live-simulate")?.addEventListener("click", () => runAction(simulateLiveDemo));
element("live-prepare")?.addEventListener("click", () => runAction(prepareDemo));
element("live-execute")?.addEventListener("click", () => runAction(executeDemo));

const testnetDialog = element("testnet-dialog");
element("hero-execute")?.addEventListener("click", () => testnetDialog?.showModal());
element("dialog-close")?.addEventListener("click", () => testnetDialog?.close());
testnetDialog?.addEventListener("click", (event) => {
  if (event.target === testnetDialog) testnetDialog.close();
});
element("live-amount").addEventListener("input", () => {
  try {
    parseDemoAmount(element("live-amount").value);
    setText("live-amount-error", "");
  } catch (error) {
    setText("live-amount-error", error.message);
  }
});
element("wallet-amount").addEventListener("input", async () => {
  try {
    parseDemoAmount(element("wallet-amount").value);
    setText("wallet-amount-error", "");
    if (walletAccount) await refreshWalletState();
  } catch (error) {
    setText("wallet-amount-error", error.message);
    element("live-prepare").disabled = true;
    element("live-execute").disabled = true;
    element("wallet-step-prepare")?.classList.remove("is-ready", "is-complete");
    element("wallet-step-execute")?.classList.remove("is-ready");
  }
});

window.addEventListener("eip6963:announceProvider", (event) => {
  const detail = event?.detail;
  if (!detail?.provider?.request) return;
  if (!announcedWallets.some((candidate) => candidate.provider === detail.provider)) announcedWallets.push(detail);
  refreshWalletAvailability();
});
window.dispatchEvent(new Event("eip6963:requestProvider"));
refreshWalletAvailability();
window.setTimeout(refreshWalletAvailability, 500);

Promise.allSettled([loadBenchmark(), loadOnchainProof()]).then((results) => {
  for (const result of results) {
    if (result.status === "rejected") console.error(result.reason);
  }
});
