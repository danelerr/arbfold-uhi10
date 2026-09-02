import { readFile } from "node:fs/promises";
import { createPublicClient, decodeEventLog, getAddress, http, keccak256, parseAbi } from "viem";
import {
  assertNetworkSnapshot,
  assertRuntimeBytecodeIdentity,
  bufferedGasLimit,
  normalizeNetwork,
  runtimeBytecodeTargets,
  validateManifest,
} from "../app/live-core.js";

const rpcUrl = process.env.UNICHAIN_SEPOLIA_RPC_URL || "https://sepolia.unichain.org";
const manifest = validateManifest(JSON.parse(await readFile(
  new URL("../deployments/unichain-sepolia-1301-v0.1.json", import.meta.url),
  "utf8",
)));
const chain = {
  id: 1301,
  name: "Unichain Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
};
const client = createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 3 }) });
const coordinatorAbi = parseAbi([
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
const tokenAbi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);
const routerAbi = parseAbi([
  "function manager() view returns (address)",
  "function coordinator() view returns (address)",
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

const bytecodeTargets = runtimeBytecodeTargets(manifest).map((target) => ({
  ...target,
  address: getAddress(target.address.toLowerCase()),
}));

const [chainId, receipt, interactiveReceipt, allowanceReceipt, ...codes] = await Promise.all([
  client.getChainId(),
  client.getTransactionReceipt({ hash: manifest.canonicalDemoTransaction }),
  manifest.interactiveDemo?.transaction
    ? client.getTransactionReceipt({ hash: manifest.interactiveDemo.transaction })
    : Promise.resolve(null),
  manifest.rpcSimulation?.allowanceTransaction
    ? client.getTransactionReceipt({ hash: manifest.rpcSimulation.allowanceTransaction })
    : Promise.resolve(null),
  ...bytecodeTargets.map(({ address }) => client.getCode({ address })),
]);
if (chainId !== manifest.chainId) throw new Error(`chain mismatch: ${chainId}`);
if (receipt.status !== "success") throw new Error("canonical transaction is not successful");
if (interactiveReceipt && interactiveReceipt.status !== "success") throw new Error("interactive validation is not successful");
if (allowanceReceipt && allowanceReceipt.status !== "success") throw new Error("public RPC allowance transaction is not successful");
codes.forEach((code, index) => {
  assertRuntimeBytecodeIdentity(bytecodeTargets[index], code, keccak256(code ?? "0x"));
});
if (allowanceReceipt && (
  allowanceReceipt.from.toLowerCase() !== manifest.rpcSimulation.account.toLowerCase()
  || allowanceReceipt.to?.toLowerCase() !== manifest.tokens.b.toLowerCase()
  || Number(allowanceReceipt.blockNumber) !== manifest.rpcSimulation.allowanceBlock
)) {
  throw new Error("public RPC allowance evidence mismatch");
}
const canonicalEvents = decodedEvents(receipt);
const canonicalSwaps = canonicalEvents.filter((event) => event.eventName === "SwapAndFold");
const canonicalRounds = canonicalEvents.filter((event) => event.eventName === "FoldRound");
const canonicalCompletions = canonicalEvents.filter((event) => event.eventName === "FoldCompleted");
const canonicalReward = canonicalRounds.reduce((sum, event) => sum + event.args.solverReward, 0n);
if (canonicalSwaps.length !== 1
  || canonicalCompletions.length !== 1
  || canonicalRounds.length !== manifest.demo.foldRounds) {
  throw new Error("canonical transaction has the wrong ARBFOLD event topology");
}
const canonicalSwap = canonicalSwaps[0];
const canonicalCompleted = canonicalCompletions[0];
if (receipt.from.toLowerCase() !== manifest.demo.user.toLowerCase()
  || receipt.to?.toLowerCase() !== manifest.router.toLowerCase()
  || Number(receipt.blockNumber) !== manifest.blockNumber
  || canonicalSwap.args.payer.toLowerCase() !== manifest.demo.user.toLowerCase()
  || canonicalSwap.args.hook.toLowerCase() !== manifest.demo.originHook.toLowerCase()
  || canonicalSwap.args.solver.toLowerCase() !== manifest.demo.solver.toLowerCase()
  || canonicalSwap.args.zeroForOne !== manifest.demo.zeroForOne
  || canonicalSwap.args.amountIn !== BigInt(manifest.demo.amountIn)
  || canonicalSwap.args.amountOut !== BigInt(manifest.demo.amountOut)
  || canonicalCompleted.args.originHook.toLowerCase() !== manifest.demo.originHook.toLowerCase()
  || canonicalCompleted.args.solver.toLowerCase() !== manifest.demo.solver.toLowerCase()
  || canonicalCompleted.args.rounds !== BigInt(manifest.demo.foldRounds)
  || canonicalCompleted.args.residualProfit !== BigInt(manifest.demo.residualProfit)
  || canonicalReward !== BigInt(manifest.demo.solverReward)) {
  throw new Error("canonical transaction semantics mismatch");
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

const canonicalBlock = BigInt(manifest.blockNumber);
const coordinator = getAddress(manifest.coordinator.toLowerCase());
const router = getAddress(manifest.router.toLowerCase());
const [network, calls, rounds, residual, block, coordinatorManager, routerManager, routerCoordinator, tokenA, tokenB, tokenC, hookAB, hookBC, hookAC, preNetwork, postNetwork] = await Promise.all([
  client.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "network" }),
  client.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "totalFoldCalls" }),
  client.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "totalFoldRounds" }),
  client.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "lastResidualProfit" }),
  client.getBlockNumber(),
  client.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "manager" }),
  client.readContract({ address: router, abi: routerAbi, functionName: "manager" }),
  client.readContract({ address: router, abi: routerAbi, functionName: "coordinator" }),
  client.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "tokenA" }),
  client.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "tokenB" }),
  client.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "tokenC" }),
  client.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "hookAB" }),
  client.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "hookBC" }),
  client.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "hookAC" }),
  client.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "network", blockNumber: canonicalBlock - 1n }),
  client.readContract({ address: coordinator, abi: coordinatorAbi, functionName: "network", blockNumber: canonicalBlock }),
]);
const expectedBindings = [
  manifest.poolManager,
  manifest.poolManager,
  manifest.coordinator,
  manifest.tokens.a,
  manifest.tokens.b,
  manifest.tokens.c,
  manifest.hooks.ab,
  manifest.hooks.bc,
  manifest.hooks.ac,
].map((address) => getAddress(address.toLowerCase()));
const observedBindings = [
  coordinatorManager,
  routerManager,
  routerCoordinator,
  tokenA,
  tokenB,
  tokenC,
  hookAB,
  hookBC,
  hookAC,
].map((address) => getAddress(address.toLowerCase()));
if (observedBindings.some((address, index) => address !== expectedBindings[index])) {
  throw new Error("live coordinator/router bindings mismatch");
}
assertNetworkSnapshot("Canonical pre-state", normalizeNetwork(preNetwork), manifest.demo.preReserves);
assertNetworkSnapshot("Canonical post-state", normalizeNetwork(postNetwork), manifest.demo.postReserves);
const state = normalizeNetwork(network);
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

console.log("PASS: ARBFOLD v0.1 live demo deployment verified");
console.log(`chain=${chainId} block=${block} canonicalTx=${manifest.canonicalDemoTransaction}`);
console.log(`foldCalls=${calls} foldRounds=${rounds} residualWeiA=${residual}`);
console.log(`AB=${state.abA}/${state.abB} BC=${state.bcB}/${state.bcC} AC=${state.acA}/${state.acC}`);
console.log(`dryRunInput=${simulationAmount} dryRunOutput=${simulation.result}`);
console.log(`signedPathMinOut=${signedMinimumOut} signedPathGas=${signedGasEstimate} bufferedGas=${bufferedGasLimit(signedGasEstimate)}`);
