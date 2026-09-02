import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import {
  BENCHMARK_SCHEMA,
  deriveBenchmarkFacts,
  validateBenchmarkPayload,
} from "../app/benchmark-core.js";
import { validateManifest } from "../app/live-core.js";
import { validateBenchmarkEvidenceWithProvenance } from "./benchmark-provenance.mjs";

const publicMode = process.argv.includes("--public");
const strictMode = process.argv.includes("--strict");
const benchmarkArgument = process.argv.find((argument) => argument.startsWith("--benchmark="));
const benchmarkOverride = benchmarkArgument?.slice("--benchmark=".length);
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

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "arbfold-submission-preflight" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

const [readme, page, packageText, reactApp, benchmarkDemo, swapResult, swapLabDialog, swapComposer, walletHook, finalSubmission, demoScript, videoRunbook, subtitles, checklist, rawText, manifestText] = await Promise.all([
  read("README.md"),
  read("app/index.html"),
  read("package.json"),
  read("app/src/App.tsx"),
  read("app/src/components/BenchmarkDemo.tsx"),
  read("app/src/components/SwapResult.tsx"),
  read("app/src/components/SwapLabDialog.tsx"),
  read("app/src/components/SwapComposer.tsx"),
  read("app/src/hooks/useSwapLab.ts"),
  read("docs/submission/FINAL_SUBMISSION.md"),
  read("docs/submission/DEMO_SCRIPT.md"),
  read("docs/submission/VIDEO_RECORDING_RUNBOOK.md"),
  read("assets/arbfold-demo-en.srt"),
  read("docs/submission/SUBMISSION_CHECKLIST.md"),
  benchmarkOverride
    ? readFile(resolve(benchmarkOverride), "utf8")
    : read("benchmark/optimized-release-candidate-results/raw.json"),
  read("deployments/unichain-sepolia-1301-v0.1.json"),
]);

const packageJson = JSON.parse(packageText);
const validatedEvidence = await validateBenchmarkEvidenceWithProvenance(JSON.parse(rawText), {
  environmentPath: process.env.ARBFOLD_ENVIRONMENT_PATH
    ? resolve(process.env.ARBFOLD_ENVIRONMENT_PATH)
    : undefined,
});
const raw = validatedEvidence.payload;
const benchmarkFacts = deriveBenchmarkFacts(raw);
const manifest = validateManifest(JSON.parse(manifestText));
const pairedOutputsEqual = raw.frozen_grid.every(
  (row) => BigInt(row.reference_user_output) === BigInt(row.direct_user_output),
);
const pairedRewardsEqual = raw.frozen_grid.every(
  (row) => BigInt(row.reference_external_recipient_reward)
    === BigInt(row.direct_external_recipient_reward),
);
const rows = raw.frozen_grid.map((row) => ({
  size: Number(row.input_tokens),
  backrun: Number(row.reference_total_gas),
  direct: Number(row.direct_total_gas),
}));
const canonical = rows.find((row) => row.size === 100_000);
const canonicalEvidence = raw.frozen_grid.find((row) => row.input_tokens === 100_000);
const formerRegressionEvidence = raw.frozen_grid.find((row) => row.input_tokens === 25_000);
const activePublicCopy = [reactApp, benchmarkDemo, swapResult, finalSubmission, demoScript, videoRunbook, subtitles].join("\n");

check("Project ID and v0.1 category are canonical", includesAll(finalSubmission, ["HK-UHI10-1057", "registered as MATURE", "ARBFOLD — Direct State Settlement for Cyclic Arbitrage"]));
check("Public project links are present", includesAll(finalSubmission, [
  "https://github.com/danelerr/arbfold-uhi10",
  "https://danelerr.github.io/arbfold-uhi10/",
]));
check("Canonical v0.1 benchmark matches raw evidence", canonical?.backrun === 544_219
  && canonical?.direct === 375_171
  && benchmarkFacts.canonical_topology.reference_rounds === 2
  && benchmarkFacts.canonical_topology.reference_arbitrage_swaps === 6
  && benchmarkFacts.canonical_topology.reference_reinjections === 2
  && benchmarkFacts.canonical_topology.direct_rounds === 2
  && benchmarkFacts.canonical_topology.direct_fold_calls === 1
  && benchmarkFacts.canonical_topology.residual_wei_a === 0);
check("Reviewed v0.1 evidence schema is active", raw.schema === BENCHMARK_SCHEMA
  && benchmarkFacts.unique_paths.join(",") === "0,1,2,3,4,5"
  && validatedEvidence.provenance.selected_compiler_configuration === "no-ir-runs-200");
check("Paired user outputs recompute from raw evidence", pairedOutputsEqual && raw.mechanical_gates.all_frozen_outputs_equal === pairedOutputsEqual);
check("Paired fixed rewards recompute from raw evidence", pairedRewardsEqual && raw.mechanical_gates.all_frozen_rewards_equal === pairedRewardsEqual);
check("Canonical uint256 evidence remains exact", canonicalEvidence?.reference_user_output === "30220363129338304386"
  && canonicalEvidence.direct_user_output === "30220363129338304386"
  && canonicalEvidence.reference_external_recipient_reward === "85849039116169484"
  && canonicalEvidence.direct_external_recipient_reward === "85849039116169484");
check("Invalid steady-state measurement is absent", !("storage_transition_matrix" in raw));
check("Canonical v0.1 claim matches exact raw evidence", canonicalEvidence?.gas_reduction_percent === "31.062495"
  && finalSubmission.includes("31.06% less"));
check("25k regression removal matches exact raw evidence", formerRegressionEvidence?.gas_reduction_percent === "19.449099"
  && finalSubmission.includes("19.45% less"));
check("Complete five-size grid is displayed", rows.length === 5 && includesAll(benchmarkDemo, ["rows.map", "data-size={row.size}"]));
check("Dashboard states the canonical sweep boundary", includesAll(benchmarkDemo, [
  "1k–4k execute zero fold rounds and cost more",
  "5k–200k was cheaper in the tested canonical path",
  "This is not a universal claim",
])
  && benchmarkFacts.dense_sweep.first_actionable_tokens === 5_000
  && benchmarkFacts.dense_sweep.actionable_rows === 196
  && benchmarkFacts.dense_sweep.cheaper_actionable_rows === 196
  && JSON.stringify(benchmarkFacts.dense_sweep.zero_round_ranges)
    === JSON.stringify([{ start_tokens: 1_000, end_tokens: 4_000 }])
  && !benchmarkDemo.includes("Solver reward"));
check("Active v0.1 copy has current counts and reward terminology", !/(?:83 current Solidity tests|83 passing Solidity tests|61 passing core tests|Same solver reward)/i.test(activePublicCopy)
  && includesAll(activePublicCopy, ["82 Solidity tests", "fixed external-recipient reward"]));
check("Subtitles state the current v0.1 evidence boundaries", includesAll(subtitles, [
  "544,219 gas versus 375,171",
  "409,402 gas versus 329,777",
  "1k through 4k",
  "196 of 196 actionable",
  "workloads were cheaper in the tested canonical path",
  "public v0.1 deployment",
  "historical v0 research deployment",
]) && !includesAll(subtitles, ["19.12% less gas in the delivered core"])
  && !/At 25k, ARBFOLD uses 0\.98% more gas/.test(subtitles));
check("Interactive demo remains the first claim", includesAll(benchmarkDemo, ["Don’t replay every leg.", "Settle the equivalent state.", "Replay demo", "Open Swap Lab"]));
check("Dashboard uses React, Vite and TypeScript", includesAll(page, ["id=\"root\"", "/src/main.tsx"])
  && Boolean(packageJson.dependencies?.react)
  && Boolean(packageJson.devDependencies?.vite)
  && Boolean(packageJson.devDependencies?.typescript));
check("Wallet integration uses EIP-6963", includesAll(walletHook, ["eip6963:requestProvider", "eip6963:announceProvider", "custom(provider)"]));
check("Swap Lab explains the valueless assets and cycle", includesAll(`${swapLabDialog}\n${swapComposer}`, [
  "Three valueless test tokens",
  "ARFX / ARFY",
  "ARFX / ARFZ",
  "ARFY / ARFZ",
  "After your swap, ARBFOLD checks this cycle",
]));
check("Canonical transaction is linked from the manifest", reactApp.includes("manifest.canonicalDemoTransaction"));
check("Canonical v0.1 transaction is documented", finalSubmission.includes(manifest.canonicalDemoTransaction));
check("Deployment uses Unichain Sepolia", manifest.chainId === 1301 && manifest.network === "unichain-sepolia");
check("Deployment is explicitly research-only", manifest.researchOnly === true);
check("README publishes the v0.1 workload boundary", includesAll(readme, ["31.06% less gas", "1k–4k", "196 actionable"]));
check("Dashboard is marked complete", checklist.includes("Public dashboard | Complete and public"));
check("Manual submission fields remain explicit", finalSubmission.includes("## Personal fields"));

if (publicMode) {
  try {
    const cacheKey = Date.now();
    const [publicPage, publicManifest, publicReadme, publicBenchmark] = await Promise.all([
      fetchText(`https://danelerr.github.io/arbfold-uhi10/?preflight=${cacheKey}`),
      fetchText(`https://danelerr.github.io/arbfold-uhi10/deployments/unichain-sepolia-1301-v0.1.json?preflight=${cacheKey}`),
      fetchText(`https://raw.githubusercontent.com/danelerr/arbfold-uhi10/main/README.md?preflight=${cacheKey}`),
      fetchText(`https://danelerr.github.io/arbfold-uhi10/data/release-results.json?preflight=${cacheKey}`),
    ]);
    const servedManifest = validateManifest(JSON.parse(publicManifest));
    validateBenchmarkPayload(JSON.parse(publicBenchmark));
    const bundlePath = publicPage.match(/<script[^>]+src="(\.\/assets\/index-[^"]+\.js)"/)?.[1];
    const publicBundle = bundlePath
      ? await fetchText(new URL(bundlePath, "https://danelerr.github.io/arbfold-uhi10/").href)
      : "";
    check("Public dashboard serves a Vite application bundle", Boolean(bundlePath) && publicBundle.length > 100_000);
    check("Public dashboard serves the current verification bundle", includesAll(publicBundle, [
      "Don’t replay every leg",
      "runtime bytecode does not match the published manifest",
    ]));
    check("Public manifest matches canonical transaction", servedManifest.canonicalDemoTransaction === manifest.canonicalDemoTransaction);
    check("Public manifest matches v0.1 coordinator", servedManifest.coordinator === manifest.coordinator);
    check("Public manifest exactly matches the reviewed local release", sha256(publicManifest) === sha256(manifestText));
    check("Public repository serves the reviewed README", sha256(publicReadme) === sha256(readme));
    check("Public benchmark exactly matches the lossless reviewed evidence", sha256(publicBenchmark) === sha256(rawText));
  } catch (error) {
    failures.push(`Public artifact verification: ${error.message}`);
  }

  try {
    const [tagCommitText, mainCommitText] = await Promise.all([
      fetchText("https://api.github.com/repos/danelerr/arbfold-uhi10/commits/uhi10-submission"),
      fetchText("https://api.github.com/repos/danelerr/arbfold-uhi10/commits/main"),
    ]);
    const tagCommit = JSON.parse(tagCommitText);
    const mainCommit = JSON.parse(mainCommitText);
    check("Public submission tag resolves to current main", /^[0-9a-f]{40}$/.test(tagCommit.sha)
      && tagCommit.sha === mainCommit.sha);
  } catch (error) {
    failures.push(`Public submission tag verification: ${error.message}`);
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
