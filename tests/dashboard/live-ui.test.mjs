import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../../app/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../../app/app.js", import.meta.url), "utf8");

test("dashboard exposes no-wallet and signed live execution paths", () => {
  for (const id of ["replay-demo", "replay-result", "live-simulate", "live-connect", "live-prepare", "live-execute", "live-result-tx"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /type="module" src="\.\/app\.js"/);
});

test("live application verifies state and waits for signed receipts", () => {
  assert.match(app, /runReplay/);
  assert.match(app, /button\.disabled = !benchmarkReady \|\| replayRunning/);
  assert.doesNotMatch(app, /if \(!benchmarkReady \|\| !liveReady \|\| replayRunning\) return/);
  assert.match(app, /verifyLiveDeployment/);
  assert.match(app, /simulateLiveDemo/);
  assert.match(app, /waitForTransactionReceipt/);
  assert.match(app, /networkChanged/);
});
