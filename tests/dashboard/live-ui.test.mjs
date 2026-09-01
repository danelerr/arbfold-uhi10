import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

const [html, packageText, main, app, benchmark, dialog, composer, result, hook, live, labCore, finalSubmission, demoScript, videoRunbook, subtitles] = await Promise.all([
  read("../../app/index.html"),
  read("../../package.json"),
  read("../../app/src/main.tsx"),
  read("../../app/src/App.tsx"),
  read("../../app/src/components/BenchmarkDemo.tsx"),
  read("../../app/src/components/SwapLabDialog.tsx"),
  read("../../app/src/components/SwapComposer.tsx"),
  read("../../app/src/components/SwapResult.tsx"),
  read("../../app/src/hooks/useSwapLab.ts"),
  read("../../app/src/lib/arbfold.ts"),
  read("../../app/swap-lab-core.js"),
  read("../../docs/submission/FINAL_SUBMISSION.md"),
  read("../../docs/submission/DEMO_SCRIPT.md"),
  read("../../docs/submission/VIDEO_RECORDING_RUNBOOK.md"),
  read("../../assets/arbfold-demo-en.srt"),
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

test("Swap Lab explains the tokens, pools, cycle and contextual signed path", () => {
  for (const id of [
    "replay-demo",
    "replay-result",
    "hero-execute",
    "swap-lab-dialog",
    "swap-lab-close",
    "lab-amount",
    "lab-primary-action",
    "swap-lab-result",
  ]) {
    assert.match(`${benchmark}\n${dialog}\n${composer}\n${result}`, new RegExp(`id=["']${id}["']`));
  }
  assert.match(dialog, /<dialog/);
  assert.match(dialog, /Three valueless test tokens/);
  assert.match(dialog, /ARFX \/ ARFY/);
  assert.match(dialog, /ARFX \/ ARFZ/);
  assert.match(dialog, /ARFY \/ ARFZ/);
  assert.match(composer, /After your swap, ARBFOLD checks this cycle/);
  assert.match(composer, /If completing this cycle returns more/);
  assert.match(composer, /Your swap moves one pool/);
  assert.match(composer, /ARBFOLD checks all three pools/);
  assert.match(composer, /Instead of replaying three arbitrage swaps/);
  assert.match(composer, /Explore another route/);
  assert.match(composer, /Allow this demo swap/);
  assert.match(composer, /Run swap \+ ARBFOLD/);
  assert.match(composer, /button steps remain/);
  assert.match(composer, /Final button step/);
  assert.match(benchmark, /Controlled Foundry Benchmark/);
  assert.match(benchmark, /iterative reference/);
  assert.match(benchmark, /Round \$\{index \+ 1\}: 3 arbitrage swaps/);
  assert.match(benchmark, /ARBFOLD · one fold\(\) call/);
  assert.match(benchmark, /Direct settlement round/);
  assert.match(benchmark, /Don’t replay every leg/);
  assert.match(benchmark, /runtime-checked direct settlement rounds/);
  assert.match(benchmark, /1k–4k execute zero fold rounds and cost more/);
  assert.match(benchmark, /5k–200k was cheaper in the tested canonical path/);
  assert.match(benchmark, /This is not a universal claim/);
  assert.doesNotMatch(`${benchmark}\n${result}`, /Solver reward/);
  assert.match(`${benchmark}\n${result}`, /Fixed execution reward/);
  assert.match(benchmark, /The public testnet is mutable/);
  assert.doesNotMatch(`${app}\n${benchmark}\n${dialog}\n${composer}\n${result}`, /Demo A|Demo B|Demo C|Normal swap|swapExactInputPlain|Live network state|Wallet balances and allowance|REJECTED CLAIM/);
  assert.doesNotMatch(`${dialog}\n${composer}`, /allowance|uint256\.max|progress|session-strip/);
});

test("live application treats the signed receipt as final and refreshes state best-effort", () => {
  assert.match(benchmark, /function replay\(\)/);
  assert.match(app, /verifyDeployment/);
  assert.match(dialog, /showModal\(\)/);
  assert.match(dialog, /\.close\(\)/);
  assert.match(hook, /waitForTransactionReceipt/);
  assert.match(hook, /eip6963:requestProvider/);
  assert.match(hook, /eip6963:announceProvider/);
  assert.match(hook, /No compatible wallet was detected/);
  assert.match(hook, /custom\(provider\)/);
  assert.match(hook, /eth_chainId/);
  assert.match(hook, /estimateContractGas/);
  assert.match(hook, /gas: bufferedGasLimit\(estimatedGas\)/);
  assert.match(hook, /sendTokenTransaction\("approve", inputToken, \[router, parsedAmount\]\)/);
  assert.match(hook, /parsedAmount - balances\[inputRole\]/);
  assert.match(hook, /actionLock\.current/);
  assert.match(hook, /Checking your current balance and one-use permission/);
  assert.match(hook, /latestAllowance < parsedAmount/);
  assert.match(hook, /latestBalance < parsedAmount/);
  assert.match(hook, /latestAllowance - parsedAmount/);
  assert.match(hook, /\[inputRole\]: parsedAmount/);
  assert.match(live, /ERC20InsufficientAllowance/);
  assert.match(live, /0xfb8f41b2/);
  assert.doesNotMatch(hook, /uint256\.max|MaxUint256|DEMO_ALLOWANCE/);
  assert.match(labCore, /a: "ARFX"/);
  assert.match(labCore, /b: "ARFY"/);
  assert.match(labCore, /c: "ARFZ"/);
  assert.match(live, /getBlockNumber\(\{ cacheTime: 0 \}\)/);
  assert.match(live, /blockNumber === undefined \? \{\} : \{ blockNumber \}/);
  assert.match(live, /functionName: "network"/);
  assert.match(live, /functionName: "tokenA"/);
  assert.match(live, /functionName: "hookAB"/);
  assert.match(live, /token and hook roles do not match/);
  assert.match(hook, /Promise\.allSettled/);
  const resultIndex = hook.indexOf("setResult(nextResult)");
  assert.ok(resultIndex >= 0);
  assert.ok(resultIndex < hook.indexOf("Promise.allSettled", resultIndex));
  assert.doesNotMatch(hook, /readLiveState\(manifest, receipt\.blockNumber\)/);
  assert.match(result, /Runtime-checked fold round/);
  assert.match(result, /Residual remained above the threshold/);
  assert.match(result, /Final remaining arbitrage/);
});

test("active release copy cannot regress to stale counts, rewards, or v0 headlines", () => {
  const activeCopy = [app, benchmark, result, finalSubmission, demoScript, videoRunbook, subtitles].join("\n");
  for (const stale of [
    "83 current Solidity tests",
    "83 passing Solidity tests",
    "61 passing core tests",
    "Same solver reward",
  ]) {
    assert.doesNotMatch(activeCopy, new RegExp(stale, "i"));
  }
  assert.match(app, /82 Solidity tests/);
  assert.match(subtitles, /544,219 gas versus 375,171/);
  assert.match(subtitles, /409,402 gas versus 329,777/);
  assert.match(subtitles, /1k through 4k execute zero fold rounds/);
  assert.match(subtitles, /196 of 196 actionable/);
  assert.match(subtitles, /tested canonical path/);
  assert.match(subtitles, /fixed external-recipient reward/);
  assert.match(subtitles, /public v0.1 deployment/);
  assert.match(subtitles, /historical v0 research deployment/);
  assert.doesNotMatch(subtitles, /ARBFOLD uses 19\.12% less|At 25k, ARBFOLD uses 0\.98% more/);
});
