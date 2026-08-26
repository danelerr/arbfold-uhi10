import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

const [html, packageText, main, app, benchmark, dialog, hook, live] = await Promise.all([
  read("../../app/index.html"),
  read("../../package.json"),
  read("../../app/src/main.tsx"),
  read("../../app/src/App.tsx"),
  read("../../app/src/components/BenchmarkDemo.tsx"),
  read("../../app/src/components/TestnetDialog.tsx"),
  read("../../app/src/hooks/useArbFoldDemo.ts"),
  read("../../app/src/lib/arbfold.ts"),
]);
const pkg = JSON.parse(packageText);

test("dashboard is a React, Vite and TypeScript application", () => {
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /src="\/src\/main\.tsx"/);
  assert.match(main, /createRoot/);
  assert.match(main, /<StrictMode>/);
  assert.equal(typeof pkg.dependencies.react, "string");
  assert.equal(typeof pkg.dependencies["react-dom"], "string");
  assert.equal(typeof pkg.devDependencies.vite, "string");
  assert.equal(typeof pkg.devDependencies.typescript, "string");
  assert.doesNotMatch(html, /app\.js/);
});

test("demo exposes a compact comparison and an understandable signed path", () => {
  for (const id of [
    "replay-demo",
    "replay-result",
    "hero-execute",
    "testnet-dialog",
    "dialog-close",
    "live-simulate",
    "execute-live",
    "live-connect",
    "wallet-provider-help",
    "live-prepare",
    "wallet-amount",
    "live-execute",
    "live-result-tx",
  ]) {
    assert.match(`${benchmark}\n${dialog}`, new RegExp(`id=["']${id}["']`));
  }
  assert.match(dialog, /<dialog/);
  assert.match(dialog, /You spend/);
  assert.match(dialog, /Estimated receive/);
  assert.match(dialog, /No real assets are involved/);
  assert.match(dialog, /one transaction/i);
  assert.match(dialog, /const stage: DemoStage/);
  assert.match(dialog, /ARFX/);
  assert.match(dialog, /ARFY/);
  assert.doesNotMatch(`${app}\n${benchmark}\n${dialog}`, /Live network state|Wallet balances and allowance|REJECTED CLAIM/);
  assert.doesNotMatch(dialog, /Router spending limit|Your Demo USD-1|Demo ETH/);
});

test("live application verifies state and waits for signed receipts", () => {
  assert.match(benchmark, /function replay\(\)/);
  assert.match(app, /verifyDeployment/);
  assert.match(dialog, /showModal\(\)/);
  assert.match(dialog, /\.close\(\)/);
  assert.match(hook, /waitForTransactionReceipt/);
  assert.match(hook, /networkChanged/);
  assert.match(hook, /eip6963:requestProvider/);
  assert.match(hook, /eip6963:announceProvider/);
  assert.match(hook, /No browser wallet detected/);
  assert.match(hook, /custom\(provider\)/);
  assert.match(hook, /eth_chainId/);
  assert.match(hook, /estimateContractGas/);
  assert.match(hook, /gas: bufferedGasLimit\(estimatedGas\)/);
  assert.match(hook, /DEMO_ALLOWANCE/);
  assert.match(live, /getBlockNumber\(\{ cacheTime: 0 \}\)/);
  assert.match(live, /blockNumber === undefined \? \{\} : \{ blockNumber \}/);
  assert.match(hook, /readLiveState\(manifest, receipt\.blockNumber\)/);
});
