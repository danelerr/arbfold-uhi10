import { readFile } from "node:fs/promises";
import { reductionPercent, validateManifest } from "../app/live-core.js";

const publicMode = process.argv.includes("--public");
const strictMode = process.argv.includes("--strict");
const failures = [];
const checks = [];

async function read(relativePath) {
  return readFile(new URL(relativePath, new URL("../", import.meta.url)), "utf8");
}

function check(name, condition, detail = "") {
  if (condition) {
    checks.push(name);
    return;
  }
  failures.push(detail ? `${name}: ${detail}` : name);
}

function includesAll(source, values) {
  return values.every((value) => source.includes(value));
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "arbfold-submission-preflight" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

const [readme, page, packageText, reactApp, benchmarkDemo, testnetDialog, walletHook, finalSubmission, checklist, rawText, manifestText] = await Promise.all([
  read("README.md"),
  read("app/index.html"),
  read("package.json"),
  read("app/src/App.tsx"),
  read("app/src/components/BenchmarkDemo.tsx"),
  read("app/src/components/TestnetDialog.tsx"),
  read("app/src/hooks/useArbFoldDemo.ts"),
  read("docs/FINAL_SUBMISSION.md"),
  read("docs/SUBMISSION_CHECKLIST.md"),
  read("benchmark/release-candidate-results/raw.json"),
  read("deployments/unichain-sepolia-1301.json"),
]);

const packageJson = JSON.parse(packageText);
const raw = JSON.parse(rawText);
const manifest = validateManifest(JSON.parse(manifestText));
const rows = raw.rows.map((row) => ({
  size: Number(BigInt(row.origin_input_wei) / 10n ** 18n),
  backrun: Number(row.backrun_total_gas),
  direct: Number(row.direct_total_gas),
}));
const canonical = rows.find((row) => row.size === 100_000);
const regression = rows.find((row) => row.size === 25_000);
const canonicalReduction = reductionPercent(canonical.backrun, canonical.direct);
const regressionIncrease = Math.abs(reductionPercent(regression.backrun, regression.direct));

check("Project ID is canonical", includesAll(finalSubmission, ["HK-UHI10-1057", "registered as MATURE", "ARBFOLD — Gas-Efficient Defensive Rebalancing"]));
check("Public project links are present", includesAll(finalSubmission, [
  "https://github.com/danelerr/arbfold-uhi10",
  "https://danelerr.github.io/arbfold-uhi10/",
]));
check("Canonical benchmark row is unchanged", canonical?.backrun === 544_187 && canonical?.direct === 440_128);
check("Canonical claim matches raw evidence", canonicalReduction.toFixed(2) === "19.12" && finalSubmission.includes("19.12% less"));
check("25k regression remains disclosed", regressionIncrease.toFixed(2) === "0.98" && finalSubmission.includes("0.98% more"));
check("Complete five-size grid is displayed", rows.length === 5 && includesAll(benchmarkDemo, ["rows.map", "data-size={row.size}"]));
check("Interactive demo remains the first claim", includesAll(benchmarkDemo, ["3 arbitrage swaps.", "1 verified transition.", "Replay demo", "Run on testnet"]));
check("Dashboard uses React, Vite and TypeScript", includesAll(page, ["id=\"root\"", "/src/main.tsx"])
  && Boolean(packageJson.dependencies?.react)
  && Boolean(packageJson.devDependencies?.vite)
  && Boolean(packageJson.devDependencies?.typescript));
check("Wallet integration uses EIP-6963", includesAll(walletHook, ["eip6963:requestProvider", "eip6963:announceProvider", "custom(provider)"]));
check("Testnet receipt explains the assets", includesAll(testnetDialog, ["You spend", "Estimated receive", "No real assets are involved."]));
check("Canonical transaction is linked from the manifest", reactApp.includes("manifest.canonicalDemoTransaction"));
check("Browser-signed transaction is documented", finalSubmission.includes(manifest.interactiveDemo.transaction));
check("Deployment uses Unichain Sepolia", manifest.chainId === 1301 && manifest.network === "unichain-sepolia");
check("Deployment is explicitly research-only", manifest.researchOnly === true);
check("README publishes the workload boundary", includesAll(readme, ["19.12% less gas", "0.98% more at 25k"]));
check("Dashboard is marked complete", checklist.includes("Public dashboard | Complete and public"));
check("Manual submission fields remain explicit", finalSubmission.includes("## Personal fields"));

if (publicMode) {
  try {
    const cacheKey = Date.now();
    const [publicPage, publicManifest, publicReadme] = await Promise.all([
      fetchText(`https://danelerr.github.io/arbfold-uhi10/?preflight=${cacheKey}`),
      fetchText(`https://danelerr.github.io/arbfold-uhi10/deployments/unichain-sepolia-1301.json?preflight=${cacheKey}`),
      fetchText(`https://raw.githubusercontent.com/danelerr/arbfold-uhi10/main/README.md?preflight=${cacheKey}`),
    ]);
    const servedManifest = validateManifest(JSON.parse(publicManifest));
    check("Public dashboard serves a Vite application bundle", /<script[^>]+src="\.\/assets\/index-[^"]+\.js"/.test(publicPage));
    check("Public manifest matches canonical transaction", servedManifest.canonicalDemoTransaction === manifest.canonicalDemoTransaction);
    check("Public manifest matches browser-signed transaction", servedManifest.interactiveDemo.transaction === manifest.interactiveDemo.transaction);
    check("Public repository serves current claim", includesAll(publicReadme, ["19.12% less gas", "0.98% more at 25k"]));
  } catch (error) {
    failures.push(`Public artifact verification: ${error.message}`);
  }
}

const manualFields = [...new Set(finalSubmission.match(/\[DANIEL:[^\]]+\]/g) || [])];

console.log(`AUTOMATED_CHECKS ${checks.length}/${checks.length + failures.length} ${failures.length ? "FAIL" : "PASS"}`);
for (const name of checks) console.log(`PASS ${name}`);
for (const failure of failures) console.error(`FAIL ${failure}`);
console.log(`MANUAL_PENDING ${manualFields.length}`);
for (const field of manualFields) console.log(`PENDING ${field}`);

if (failures.length) {
  console.error("STATUS AUTOMATED_FAILURE");
  process.exitCode = 1;
} else if (strictMode && manualFields.length) {
  console.error("STATUS BLOCKED_BY_MANUAL_FIELDS");
  process.exitCode = 2;
} else {
  console.log(manualFields.length ? "STATUS READY_FOR_MANUAL_FINISH" : "STATUS READY_TO_SUBMIT");
}
