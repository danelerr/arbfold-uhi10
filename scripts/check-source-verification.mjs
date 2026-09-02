import { readFile } from "node:fs/promises";
import {
  assertSourceCreationReceipt,
  sourceVerificationTargets,
  validateManifest,
} from "../app/live-core.js";

const manifestPath = new URL("../deployments/unichain-sepolia-1301-v0.1.json", import.meta.url);
const manifest = validateManifest(JSON.parse(await readFile(manifestPath, "utf8")));
const targets = sourceVerificationTargets(manifest);
const rpcUrl = process.env.ARBFOLD_UNICHAIN_RPC ?? "https://sepolia.unichain.org";

async function receiptFor(target) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "arbfold-source-verification-check" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: target.key,
      method: "eth_getTransactionReceipt",
      params: [target.creationTransaction],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${target.key}: RPC returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`${target.key}: RPC ${payload.error.message ?? "receipt error"}`);
  assertSourceCreationReceipt(target, payload.result);
}

async function checkTarget(target) {
  const url = `${manifest.sourceVerificationEvidence.apiBaseUrl}/${manifest.chainId}/${target.address.toLowerCase()}`;
  const response = await fetch(url, {
    headers: { "user-agent": "arbfold-source-verification-check" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${target.key}: Sourcify returned HTTP ${response.status}`);
  const observed = await response.json();
  if (String(observed.chainId) !== String(manifest.chainId)
    || observed.address?.toLowerCase() !== target.address.toLowerCase()
    || observed.match !== "match"
    || observed.creationMatch !== "match"
    || observed.runtimeMatch !== "match") {
    throw new Error(`${target.key}: Sourcify no longer reports a complete creation/runtime match`);
  }
  await receiptFor(target);
  return target.key;
}

const checked = await Promise.all(targets.map(checkTarget));
console.log(`PASS: ${checked.length}/${targets.length} active ARBFOLD contracts have matching creation/runtime source and bound successful creation receipts`);
