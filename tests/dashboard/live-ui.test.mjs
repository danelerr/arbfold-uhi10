import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../../app/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../../app/app.js", import.meta.url), "utf8");

test("demo exposes a compact comparison and modal signed execution path", () => {
  for (const id of ["replay-demo", "replay-result", "hero-execute", "testnet-dialog", "dialog-close", "live-simulate", "execute-live", "live-connect", "wallet-provider-help", "live-prepare", "wallet-amount", "live-execute", "live-result-tx"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /<dialog id="testnet-dialog"/);
  assert.doesNotMatch(html, /Live network state|Wallet balances and allowance|REJECTED CLAIM/);
  assert.match(html, /type="module" src="\.\/app\.js\?v=receipt-state-2"/);
  assert.match(app, /showModal\(\)/);
  assert.match(app, /testnetDialog\.close\(\)/);
});

test("live application verifies state and waits for signed receipts", () => {
  assert.match(app, /runReplay/);
  assert.match(app, /button\.disabled = !benchmarkReady \|\| replayRunning/);
  assert.doesNotMatch(app, /if \(!benchmarkReady \|\| !liveReady \|\| replayRunning\) return/);
  assert.match(app, /verifyLiveDeployment/);
  assert.match(app, /simulateLiveDemo/);
  assert.match(app, /waitForTransactionReceipt/);
  assert.match(app, /networkChanged/);
  assert.match(app, /eip6963:requestProvider/);
  assert.match(app, /eip6963:announceProvider/);
  assert.match(app, /No browser wallet detected/);
  assert.match(app, /custom\(walletProvider\)/);
  assert.match(app, /eth_chainId/);
  assert.match(app, /estimateContractGas/);
  assert.match(app, /gas: bufferedGasLimit\(estimatedGas\)/);
  assert.match(app, /DEMO_ALLOWANCE/);
  assert.match(app, /getBlockNumber\(\{ cacheTime: 0 \}\)/);
  assert.match(app, /blockNumber === undefined \? \{\} : \{ blockNumber \}/);
  assert.match(app, /readLiveState\(receipt\.blockNumber\)/);
});
