import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

const [html, packageText, main, app, benchmark, dialog, composer, result, hook, live, labCore] = await Promise.all([
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
  assert.match(dialog, /Estos son tres tokens de prueba sin valor/);
  assert.match(dialog, /ARFX \/ ARFY/);
  assert.match(dialog, /ARFX \/ ARFZ/);
  assert.match(dialog, /ARFY \/ ARFZ/);
  assert.match(composer, /Después de tu swap, ARBFOLD revisa este ciclo/);
  assert.match(composer, /Si recorrer este ciclo devolviera más/);
  assert.match(composer, /Tu swap mueve un pool/);
  assert.match(composer, /ARBFOLD revisa el ciclo de tres pools/);
  assert.match(composer, /En lugar de reproducir tres swaps de arbitraje/);
  assert.match(composer, /Explorar otra ruta/);
  assert.match(composer, /Permitir este swap/);
  assert.match(composer, /Ejecutar swap \+ ARBFOLD/);
  assert.match(benchmark, /Controlled Foundry Benchmark/);
  assert.match(benchmark, /3-swap backrun/);
  assert.match(benchmark, /La testnet pública es mutable/);
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
  assert.match(hook, /No se detectó una wallet compatible/);
  assert.match(hook, /custom\(provider\)/);
  assert.match(hook, /eth_chainId/);
  assert.match(hook, /estimateContractGas/);
  assert.match(hook, /gas: bufferedGasLimit\(estimatedGas\)/);
  assert.match(hook, /sendTokenTransaction\("approve", inputToken, \[router, parsedAmount\]\)/);
  assert.match(hook, /parsedAmount - balances\[inputRole\]/);
  assert.doesNotMatch(hook, /uint256\.max|MaxUint256|DEMO_ALLOWANCE/);
  assert.match(labCore, /a: "ARFY"/);
  assert.match(labCore, /b: "ARFX"/);
  assert.match(labCore, /c: "ARFZ"/);
  assert.match(live, /getBlockNumber\(\{ cacheTime: 0 \}\)/);
  assert.match(live, /blockNumber === undefined \? \{\} : \{ blockNumber \}/);
  assert.match(live, /functionName: "network"/);
  assert.match(live, /functionName: "tokenA"/);
  assert.match(live, /functionName: "hookAB"/);
  assert.match(live, /token and hook roles do not match/);
  assert.match(hook, /Promise\.allSettled/);
  assert.ok(hook.indexOf("setResult(nextResult)") < hook.indexOf("Promise.allSettled"));
  assert.doesNotMatch(hook, /readLiveState\(manifest, receipt\.blockNumber\)/);
});
