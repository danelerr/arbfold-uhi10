import { readFile } from "node:fs/promises";
import { createPublicClient, decodeEventLog, getAddress, http, parseAbi } from "viem";
import { bufferedGasLimit, normalizeNetwork, validateManifest } from "../app/live-core.js";

const rpcUrl = process.env.UNICHAIN_SEPOLIA_RPC_URL || "https://sepolia.unichain.org";
const manifest = validateManifest(JSON.parse(await readFile(
  new URL("../deployments/unichain-sepolia-1301.json", import.meta.url),
  "utf8",
)));
const chain = {
  id: 1301,
  name: "Unichain Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
};
const client = createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 3 }) });
const hookAbi = parseAbi(["function reserves() view returns (uint256 reserve0, uint256 reserve1)"]);
const coordinatorAbi = parseAbi([
  "function totalFoldCalls() view returns (uint256)",
  "function totalFoldRounds() view returns (uint256)",
  "function lastResidualProfit() view returns (uint256)",
  "event FoldRound(address indexed originHook, address indexed solver, uint256 indexed round, bool reverse, uint256 threatenedProfit, uint256 solverReward)",
  "event FoldCompleted(address indexed originHook, address indexed solver, uint256 rounds, uint256 residualProfit)",
]);
const tokenAbi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);
const routerAbi = parseAbi([
  "function swapExactInput(address hook, bool zeroForOne, uint256 amountIn, uint256 minAmountOut, address solver, uint256 deadline) returns (uint256 amountOut)",
  "event SwapAndFold(address indexed payer, address indexed hook, address indexed solver, bool zeroForOne, uint256 amountIn, uint256 amountOut)",
]);

function decodedEvents(receipt) {
  const events = [];
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

const addresses = [
  manifest.poolManager,
  manifest.coordinator,
  manifest.router,
  manifest.hooks.ab,
  manifest.hooks.bc,
  manifest.hooks.ac,
].map((address) => getAddress(address.toLowerCase()));

const [chainId, receipt, interactiveReceipt, allowanceReceipt, ...codes] = await Promise.all([
  client.getChainId(),
  client.getTransactionReceipt({ hash: manifest.canonicalDemoTransaction }),
  manifest.interactiveDemo?.transaction
    ? client.getTransactionReceipt({ hash: manifest.interactiveDemo.transaction })
    : Promise.resolve(null),
  manifest.rpcSimulation?.allowanceTransaction
    ? client.getTransactionReceipt({ hash: manifest.rpcSimulation.allowanceTransaction })
    : Promise.resolve(null),
  ...addresses.map((address) => client.getCode({ address })),
]);
if (chainId !== manifest.chainId) throw new Error(`chain mismatch: ${chainId}`);
if (receipt.status !== "success") throw new Error("canonical transaction is not successful");
if (interactiveReceipt && interactiveReceipt.status !== "success") throw new Error("interactive validation is not successful");
if (allowanceReceipt && allowanceReceipt.status !== "success") throw new Error("public RPC allowance transaction is not successful");
if (codes.some((code) => !code || code === "0x")) throw new Error("missing deployed bytecode");
if (allowanceReceipt && (
  allowanceReceipt.from.toLowerCase() !== manifest.rpcSimulation.account.toLowerCase()
  || allowanceReceipt.to?.toLowerCase() !== manifest.tokens.b.toLowerCase()
  || Number(allowanceReceipt.blockNumber) !== manifest.rpcSimulation.allowanceBlock
)) {
  throw new Error("public RPC allowance evidence mismatch");
}
if (interactiveReceipt) {
  const evidence = manifest.interactiveDemo;
  const events = decodedEvents(interactiveReceipt);
  const swap = events.find((event) => event.eventName === "SwapAndFold");
  const foldRounds = events.filter((event) => event.eventName === "FoldRound");
  const completed = events.find((event) => event.eventName === "FoldCompleted");
  const reward = foldRounds.reduce((sum, event) => sum + event.args.solverReward, 0n);
  if (!swap || !completed) throw new Error("interactive validation is missing ARBFOLD events");
  if (interactiveReceipt.from.toLowerCase() !== evidence.user.toLowerCase()
    || interactiveReceipt.to?.toLowerCase() !== manifest.router.toLowerCase()
    || Number(interactiveReceipt.blockNumber) !== evidence.blockNumber) {
    throw new Error("interactive validation sender or router mismatch");
  }
  if (swap.args.payer.toLowerCase() !== evidence.user.toLowerCase()
    || swap.args.hook.toLowerCase() !== manifest.hooks.ab.toLowerCase()
    || swap.args.solver.toLowerCase() !== evidence.user.toLowerCase()
    || swap.args.amountIn !== BigInt(evidence.amountIn)
    || swap.args.amountOut !== BigInt(evidence.amountOut)) {
    throw new Error("interactive validation swap evidence mismatch");
  }
  if (foldRounds.length !== evidence.foldRounds
    || completed.args.rounds !== BigInt(evidence.foldRounds)
    || completed.args.originHook.toLowerCase() !== manifest.hooks.ab.toLowerCase()
    || completed.args.solver.toLowerCase() !== evidence.user.toLowerCase()
    || completed.args.residualProfit !== BigInt(evidence.residualProfit)
    || reward !== BigInt(evidence.solverReward)) {
    throw new Error("interactive validation fold evidence mismatch");
  }
}

const [ab, bc, ac, calls, rounds, residual, block] = await Promise.all([
  client.readContract({ address: getAddress(manifest.hooks.ab.toLowerCase()), abi: hookAbi, functionName: "reserves" }),
  client.readContract({ address: getAddress(manifest.hooks.bc.toLowerCase()), abi: hookAbi, functionName: "reserves" }),
  client.readContract({ address: getAddress(manifest.hooks.ac.toLowerCase()), abi: hookAbi, functionName: "reserves" }),
  client.readContract({ address: getAddress(manifest.coordinator.toLowerCase()), abi: coordinatorAbi, functionName: "totalFoldCalls" }),
  client.readContract({ address: getAddress(manifest.coordinator.toLowerCase()), abi: coordinatorAbi, functionName: "totalFoldRounds" }),
  client.readContract({ address: getAddress(manifest.coordinator.toLowerCase()), abi: coordinatorAbi, functionName: "lastResidualProfit" }),
  client.getBlockNumber(),
]);
const state = normalizeNetwork([ab[0], ab[1], bc[0], bc[1], ac[0], ac[1]]);
const simulationAccount = getAddress(manifest.rpcSimulation.account.toLowerCase());
const simulationAmount = 1_000n * 10n ** 18n;
const maximumSimulationAmount = BigInt(manifest.rpcSimulation.maximumInput);
const [simulationBalance, simulationAllowance, simulation] = await Promise.all([
  client.readContract({
    address: getAddress(manifest.tokens.b.toLowerCase()),
    abi: tokenAbi,
    functionName: "balanceOf",
    args: [simulationAccount],
  }),
  client.readContract({
    address: getAddress(manifest.tokens.b.toLowerCase()),
    abi: tokenAbi,
    functionName: "allowance",
    args: [simulationAccount, getAddress(manifest.router.toLowerCase())],
  }),
  client.simulateContract({
    account: simulationAccount,
    address: getAddress(manifest.router.toLowerCase()),
    abi: routerAbi,
    functionName: "swapExactInput",
    args: [
      getAddress(manifest.hooks.ab.toLowerCase()),
      false,
      simulationAmount,
      0n,
      simulationAccount,
      BigInt(Math.floor(Date.now() / 1_000) + 900),
    ],
  }),
]);
if (simulationBalance < maximumSimulationAmount || simulationAllowance < maximumSimulationAmount) {
  throw new Error("public RPC dry-run account is not prepared");
}
if (simulation.result <= 0n) throw new Error("public RPC dry-run returned no output");
const signedMinimumOut = simulation.result * 995n / 1000n;
const signedSimulation = await client.simulateContract({
  account: simulationAccount,
  address: getAddress(manifest.router.toLowerCase()),
  abi: routerAbi,
  functionName: "swapExactInput",
  args: [
    getAddress(manifest.hooks.ab.toLowerCase()),
    false,
    simulationAmount,
    signedMinimumOut,
    simulationAccount,
    BigInt(Math.floor(Date.now() / 1_000) + 900),
  ],
});
const signedGasEstimate = await client.estimateContractGas(signedSimulation.request);
if (signedSimulation.result < signedMinimumOut) throw new Error("signed path violates its minimum output");
if (bufferedGasLimit(signedGasEstimate) <= signedGasEstimate) throw new Error("signed path gas buffer was not applied");

console.log("PASS: ARBFOLD live demo deployment verified");
console.log(`chain=${chainId} block=${block} canonicalTx=${manifest.canonicalDemoTransaction}`);
console.log(`foldCalls=${calls} foldRounds=${rounds} residualWeiA=${residual}`);
console.log(`AB=${state.abA}/${state.abB} BC=${state.bcB}/${state.bcC} AC=${state.acA}/${state.acC}`);
console.log(`dryRunInput=${simulationAmount} dryRunOutput=${simulation.result}`);
console.log(`signedPathMinOut=${signedMinimumOut} signedPathGas=${signedGasEstimate} bufferedGas=${bufferedGasLimit(signedGasEstimate)}`);
