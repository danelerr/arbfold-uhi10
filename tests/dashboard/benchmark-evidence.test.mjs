import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import {
  BENCHMARK_SCHEMA,
  CONSUMER_RECOMPUTED_GATES,
  deriveBenchmarkFacts,
  formatGasReductionPercent,
  isCanonicalUintDecimal,
  MAX_UINT256_DECIMAL,
  PAIRED_DECIMAL_FIELDS,
  PATH_LABELS,
  RESIDUAL_THRESHOLD_WEI_A,
  validateBenchmarkPayload,
} from "../../app/benchmark-core.js";
import { validateBenchmarkEvidenceWithProvenance } from "../../scripts/benchmark-provenance.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const RAW_PATH = resolve(ROOT, "benchmark/optimized-release-candidate-results/raw.json");
const UINT256_OVERFLOW = (BigInt(MAX_UINT256_DECIMAL) + 1n).toString();

async function rawText() {
  return readFile(RAW_PATH, "utf8");
}

function clone(value) {
  return structuredClone(value);
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function expectInvalid(payload, pattern = /Invalid ARBFOLD v0\.1 benchmark evidence/) {
  assert.throws(() => validateBenchmarkPayload(payload), pattern);
}

function makeDirectPathMoreExpensive(payload, rowIndex) {
  const row = payload.frozen_grid[rowIndex];
  row.direct_total_gas = row.reference_total_gas + 1;
  row.direct_execution_gas = row.direct_total_gas - 21_000 - row.direct_calldata_gas;
  row.absolute_gas_saved = -1;
  row.direct_to_reference_bps = Number(
    (BigInt(row.direct_total_gas) * 10_000n) / BigInt(row.reference_total_gas),
  );
  row.gas_reduction_percent = formatGasReductionPercent(
    row.reference_total_gas,
    row.direct_total_gas,
  );
  return payload;
}

function mutationForGate(payload, gate) {
  const mutated = clone(payload);
  const row = mutated.frozen_grid[0];
  if (gate === "all_frozen_outputs_equal") {
    row.direct_user_output = String(BigInt(row.direct_user_output) + 1n);
  } else if (gate === "all_frozen_rewards_equal") {
    row.direct_external_recipient_reward = String(
      BigInt(row.direct_external_recipient_reward) + 1n,
    );
  } else if (gate === "all_frozen_residuals_equal_and_within_threshold") {
    row.direct_residual = row.reference_residual + 1;
  } else if (gate === "all_frozen_final_reserves_within_one_wei") {
    row.equivalence_tolerance_wei = 2;
  } else if (gate === "twenty_five_k_cheaper") {
    makeDirectPathMoreExpensive(mutated, 1);
  } else if (gate === "all_five_cheaper") {
    makeDirectPathMoreExpensive(mutated, 0);
  } else {
    throw new Error(`unknown gate ${gate}`);
  }
  return mutated;
}

function runVideo(evidencePath, extraEnv = {}) {
  return spawnSync("bash", ["scripts/video-proof.sh", "--evidence-only"], {
    cwd: ROOT,
    env: { ...process.env, ARBFOLD_BENCHMARK_PATH: evidencePath, ...extraEnv },
    encoding: "utf8",
  });
}

function runPreflight(evidencePath, extraEnv = {}) {
  return spawnSync(process.execPath, [
    "scripts/submission-preflight.mjs",
    `--benchmark=${evidencePath}`,
  ], { cwd: ROOT, encoding: "utf8", env: { ...process.env, ...extraEnv } });
}

async function expectConsumersReject(directory, name, payload) {
  const path = join(directory, `${name}.json`);
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`);
  const video = runVideo(path);
  assert.notEqual(video.status, 0, `${name}: video-proof unexpectedly passed`);
  assert.doesNotMatch(video.stdout, /PASS/, `${name}: video-proof printed PASS`);
  const preflight = runPreflight(path);
  assert.notEqual(preflight.status, 0, `${name}: preflight unexpectedly passed`);
  assert.doesNotMatch(
    preflight.stdout,
    /STATUS READY(?:_FOR_MANUAL_FINISH|_TO_SUBMIT)?/,
    `${name}: preflight printed a ready status`,
  );
}

function withMutation(payload, mutate) {
  const mutated = clone(payload);
  mutate(mutated);
  return mutated;
}

test("v5 loader accepts lossless evidence and rejects legacy or incomplete evidence", async () => {
  const payload = JSON.parse(await rawText());
  assert.equal(validateBenchmarkPayload(payload), payload);
  assert.equal(payload.schema, BENCHMARK_SCHEMA);
  assert.equal(payload.residual_threshold_wei_a, RESIDUAL_THRESHOLD_WEI_A);
  assert.deepEqual(deriveBenchmarkFacts(payload).unique_paths, [0, 1, 2, 3, 4, 5]);

  for (const schema of [
    "arbfold-v0.1-optimized-release-candidate-v1",
    "arbfold-v0.1-optimized-release-candidate-v2",
    "arbfold-v0.1-optimized-release-candidate-v3",
    "arbfold-v0.1-optimized-release-candidate-v4",
  ]) {
    expectInvalid(withMutation(payload, (value) => { value.schema = schema; }), /schema must be/);
  }
  expectInvalid(withMutation(payload, (value) => { delete value.frozen_grid; }), /frozen_grid/);
  expectInvalid({
    schema: BENCHMARK_SCHEMA,
    rows: payload.frozen_grid,
    mechanical_gates: payload.mechanical_gates,
  }, /legacy rows|residual_threshold|frozen_grid/);
  expectInvalid(withMutation(payload, (value) => { value.frozen_grid.pop(); }), /exactly five rows/);
  expectInvalid(withMutation(payload, (value) => {
    value.frozen_grid.push(clone(value.frozen_grid[0]));
  }), /exactly five rows/);
  expectInvalid(withMutation(payload, (value) => {
    [value.frozen_grid[0], value.frozen_grid[1]] = [value.frozen_grid[1], value.frozen_grid[0]];
  }), /frozen order|input_tokens/);
  expectInvalid(withMutation(payload, (value) => {
    value.residual_threshold_wei_a = "999999999999";
  }), /residual_threshold/);
});

test("v5 provenance and compiler matrix are mandatory and source-bound", async () => {
  const payload = JSON.parse(await rawText());
  await assert.doesNotReject(() => validateBenchmarkEvidenceWithProvenance(payload));

  expectInvalid(withMutation(payload, (value) => { delete value.source_tree_sha256; }), /field set/);
  expectInvalid(withMutation(payload, (value) => { value.source_tree_sha256 = "not-a-digest"; }), /source_tree_sha256/);
  expectInvalid(withMutation(payload, (value) => { value.unreviewed = true; }), /field set/);
  await assert.rejects(
    () => validateBenchmarkEvidenceWithProvenance(withMutation(payload, (value) => {
      value.source_tree_sha256 = "0".repeat(64);
    })),
    /does not match the source manifest/,
  );

  for (const [name, mutate] of [
    ["missing matrix", (value) => { delete value.compiler_matrix; }],
    ["empty matrix", (value) => { value.compiler_matrix = []; }],
    ["fictional matrix", (value) => {
      value.compiler_matrix = [{ name: "fictional", status: "measured" }];
    }],
    ["reordered matrix", (value) => {
      [value.compiler_matrix[0], value.compiler_matrix[1]] = [
        value.compiler_matrix[1], value.compiler_matrix[0],
      ];
    }],
    ["duplicate configuration", (value) => {
      value.compiler_matrix[1] = clone(value.compiler_matrix[0]);
    }],
    ["contradictory via_ir", (value) => { value.compiler_matrix[0].via_ir = true; }],
    ["contradictory optimizer runs", (value) => {
      value.compiler_matrix[0].optimizer_runs = 1_000;
    }],
    ["invalid status", (value) => { value.compiler_matrix[0].status = "invented"; }],
    ["invalid gas", (value) => { value.compiler_matrix[1].canonical_direct_total_gas = 0; }],
    ["contradictory percentage", (value) => {
      value.compiler_matrix[2].canonical_gas_reduction_percent = "99.999999";
    }],
    ["missing bytecode", (value) => {
      delete value.compiler_matrix[0].deployed_bytecode_bytes.router;
    }],
    ["zero bytecode", (value) => {
      value.compiler_matrix[1].deployed_bytecode_bytes.hook = 0;
    }],
    ["negative bytecode", (value) => {
      value.compiler_matrix[2].deployed_bytecode_bytes.coordinator = -1;
    }],
    ["false error hash", (value) => {
      value.compiler_matrix[3].error_sha256 = "0".repeat(64);
    }],
  ]) {
    expectInvalid(withMutation(payload, mutate), /compiler_matrix/, name);
  }

  const directory = await mkdtemp(join(tmpdir(), "arbfold-environment-mismatch-"));
  try {
    const environmentPath = join(directory, "environment.json");
    const environment = JSON.parse(await readFile(resolve(
      ROOT,
      "benchmark/optimized-release-candidate-results/environment.json",
    ), "utf8"));
    environment.selected_compiler_configuration = "via-ir-runs-200";
    await writeFile(environmentPath, `${JSON.stringify(environment, null, 2)}\n`);
    await assert.rejects(
      () => validateBenchmarkEvidenceWithProvenance(payload, { environmentPath }),
      /selected compiler configuration/,
    );
    const validPath = join(directory, "valid.json");
    await writeFile(validPath, `${JSON.stringify(payload, null, 2)}\n`);
    const video = runVideo(validPath, { ARBFOLD_ENVIRONMENT_PATH: environmentPath });
    assert.notEqual(video.status, 0);
    assert.doesNotMatch(video.stdout, /PASS/);
    const preflight = runPreflight(validPath, { ARBFOLD_ENVIRONMENT_PATH: environmentPath });
    assert.notEqual(preflight.status, 0);
    assert.doesNotMatch(
      preflight.stdout,
      /STATUS READY(?:_FOR_MANUAL_FINISH|_TO_SUBMIT)?/,
    );

    const realManifest = await readFile(resolve(
      ROOT,
      "benchmark/optimized-release-candidate-results/source-manifest.sha256",
    ), "utf8");
    const incompleteManifest = `${realManifest.split("\n").slice(1, -1).join("\n")}\n`;
    const incompleteManifestPath = join(directory, "source-manifest.sha256");
    const incompleteEnvironmentPath = join(directory, "incomplete-environment.json");
    const incompletePayload = clone(payload);
    const incompleteEnvironment = JSON.parse(await readFile(resolve(
      ROOT,
      "benchmark/optimized-release-candidate-results/environment.json",
    ), "utf8"));
    const incompleteDigest = sha256(incompleteManifest);
    incompletePayload.source_tree_sha256 = incompleteDigest;
    incompleteEnvironment.source_tree_sha256 = incompleteDigest;
    await Promise.all([
      writeFile(incompleteManifestPath, incompleteManifest),
      writeFile(
        incompleteEnvironmentPath,
        `${JSON.stringify(incompleteEnvironment, null, 2)}\n`,
      ),
    ]);
    await assert.rejects(
      () => validateBenchmarkEvidenceWithProvenance(incompletePayload, {
        environmentPath: incompleteEnvironmentPath,
        manifestPath: incompleteManifestPath,
      }),
      /path set/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("uint256 and input identity validation is lossless in every section", async () => {
  const payload = JSON.parse(await rawText());
  assert.equal(isCanonicalUintDecimal("0"), true);
  assert.equal(isCanonicalUintDecimal(MAX_UINT256_DECIMAL), true);
  assert.equal(isCanonicalUintDecimal(UINT256_OVERFLOW), false);
  assert.equal(isCanonicalUintDecimal("9".repeat(1_000)), false);

  for (let rowIndex = 0; rowIndex < payload.frozen_grid.length; rowIndex += 1) {
    for (const [left, right] of [
      ["reference_user_output", "direct_user_output"],
      ["reference_external_recipient_reward", "direct_external_recipient_reward"],
    ]) {
      for (const boundary of ["0", MAX_UINT256_DECIMAL]) {
        const accepted = clone(payload);
        accepted.frozen_grid[rowIndex][left] = boundary;
        accepted.frozen_grid[rowIndex][right] = boundary;
        assert.doesNotThrow(() => validateBenchmarkPayload(accepted));
      }
    }
    for (const field of PAIRED_DECIMAL_FIELDS) {
      for (const invalid of [UINT256_OVERFLOW, "9".repeat(1_000)]) {
        expectInvalid(withMutation(payload, (value) => {
          value.frozen_grid[rowIndex][field] = invalid;
        }), new RegExp(field));
      }
      for (const delta of [-1n, 1n]) {
        expectInvalid(withMutation(payload, (value) => {
          value.frozen_grid[rowIndex][field] = String(
            BigInt(value.frozen_grid[rowIndex][field]) + delta,
          );
        }), /unequal user output|unequal fixed external-recipient reward/);
      }
    }
  }

  for (const [section, indexes] of [
    ["frozen_grid", [0, 1, 2, 3, 4]],
    ["dense_sweep", [0, 99, 199]],
    ["six_path_matrix", [0, 1, 2, 3, 4, 5]],
  ]) {
    for (const rowIndex of indexes) {
      for (const invalid of [undefined, "", "01", "1e18", UINT256_OVERFLOW]) {
        const mutated = clone(payload);
        if (invalid === undefined) delete mutated[section][rowIndex].input_wei;
        else mutated[section][rowIndex].input_wei = invalid;
        expectInvalid(mutated, /input_wei/);
      }
      expectInvalid(withMutation(payload, (value) => {
        value[section][rowIndex].input_wei = String(BigInt(value[section][rowIndex].input_wei) + 1n);
      }), /input_wei contradicts input_tokens/);
    }
  }
});

test("all five frozen rows enforce gas arithmetic and half-even percentages", async () => {
  const payload = JSON.parse(await rawText());
  assert.equal(formatGasReductionPercent(512, 511), "0.195312");
  assert.equal(formatGasReductionPercent(512, 509), "0.585938");

  for (let rowIndex = 0; rowIndex < payload.frozen_grid.length; rowIndex += 1) {
    const row = payload.frozen_grid[rowIndex];
    for (const [field, value] of [
      ["gas_reduction_percent", "99.999999"],
      ["reference_total_gas", row.reference_total_gas + 1],
      ["direct_total_gas", row.direct_total_gas + 1],
      ["absolute_gas_saved", row.absolute_gas_saved + 1],
      ["direct_to_reference_bps", row.direct_to_reference_bps + 1],
    ]) {
      expectInvalid(withMutation(payload, (subject) => {
        subject.frozen_grid[rowIndex][field] = value;
      }), new RegExp(field));
    }
  }

  const unsafe = clone(payload);
  unsafe.frozen_grid[0].reference_execution_gas = Number.MAX_SAFE_INTEGER;
  unsafe.frozen_grid[0].reference_total_gas = Number.MAX_SAFE_INTEGER;
  expectInvalid(unsafe, /safe integer range/);
  expectInvalid(makeDirectPathMoreExpensive(clone(payload), 0), /all_five_cheaper/);
  expectInvalid(makeDirectPathMoreExpensive(clone(payload), 1), /twenty_five_k_cheaper/);
});

test("round topology, canonical path and residual policy fail closed", async () => {
  const payload = JSON.parse(await rawText());
  for (let rowIndex = 0; rowIndex < payload.frozen_grid.length; rowIndex += 1) {
    for (const [field, mutate, pattern] of [
      ["reference_rounds", (row) => { row.reference_rounds += 1; }, /reference_arbitrage_swaps|topology/],
      ["reference_arbitrage_swaps", (row) => { row.reference_arbitrage_swaps += 1; }, /reference_arbitrage_swaps/],
      ["reference_reinjections", (row) => { row.reference_reinjections += 1; }, /reference_reinjections/],
      ["direct_rounds", (row) => { row.direct_rounds += 1; }, /direct_rounds/],
      ["direct_fold_calls", (row) => { row.direct_fold_calls = 2; }, /fold call/],
      ["path", (row) => { row.path = 0; }, /unexpected path/],
      ["path_label", (row) => { row.path_label = "fabricated"; }, /path_label/],
    ]) {
      expectInvalid(withMutation(payload, (value) => {
        mutate(value.frozen_grid[rowIndex]);
      }), pattern, field);
    }
    for (const [name, mutate] of [
      ["residual mismatch", (row) => { row.direct_residual = row.reference_residual + 1; }],
      ["residual over threshold", (row) => {
        row.reference_residual = Number(RESIDUAL_THRESHOLD_WEI_A) + 1;
        row.direct_residual = Number(RESIDUAL_THRESHOLD_WEI_A) + 1;
      }],
    ]) {
      expectInvalid(withMutation(payload, (value) => {
        mutate(value.frozen_grid[rowIndex]);
      }), /residual/, name);
    }
    for (const field of ["reference_residual", "direct_residual", "equivalence_tolerance_wei"]) {
      for (const mode of ["missing", "null", "negative", "fractional"]) {
        const mutated = clone(payload);
        if (mode === "missing") delete mutated.frozen_grid[rowIndex][field];
        if (mode === "null") mutated.frozen_grid[rowIndex][field] = null;
        if (mode === "negative") mutated.frozen_grid[rowIndex][field] = -1;
        if (mode === "fractional") mutated.frozen_grid[rowIndex][field] = 0.5;
        expectInvalid(mutated, new RegExp(field));
      }
    }
  }
  expectInvalid(withMutation(payload, (value) => {
    value.frozen_grid[3].reference_residual = 1;
    value.frozen_grid[3].direct_residual = 1;
  }), /canonical 100k residual/);
});

test("dense sweep is mandatory, ordered, arithmetically derived and summary-bound", async () => {
  const payload = JSON.parse(await rawText());
  const mutations = [
    ["missing", (value) => { delete value.dense_sweep; }],
    ["empty", (value) => { value.dense_sweep = []; }],
    ["short", (value) => { value.dense_sweep.pop(); }],
    ["long", (value) => { value.dense_sweep.push(clone(value.dense_sweep.at(-1))); }],
    ["duplicate", (value) => { value.dense_sweep[1] = clone(value.dense_sweep[0]); }],
    ["reordered", (value) => {
      [value.dense_sweep[10], value.dense_sweep[11]] = [value.dense_sweep[11], value.dense_sweep[10]];
    }],
    ["wrong-step", (value) => {
      value.dense_sweep[10].input_tokens += 1;
      value.dense_sweep[10].input_wei = `${BigInt(value.dense_sweep[10].input_tokens) * 10n ** 18n}`;
    }],
    ["reference-total", (value) => { value.dense_sweep[50].reference_total_gas += 1; }],
    ["direct-total", (value) => { value.dense_sweep[50].direct_total_gas += 1; }],
    ["absolute-saved", (value) => { value.dense_sweep[50].absolute_gas_saved += 1; }],
    ["percent", (value) => { value.dense_sweep[50].gas_reduction_percent = "99.999999"; }],
    ["rounds", (value) => { value.dense_sweep[50].direct_rounds = 3; }],
  ];
  for (const [name, mutate] of mutations) {
    expectInvalid(withMutation(payload, mutate), /dense_sweep/, name);
  }

  const summaryMutations = {
    first_actionable_tokens: (summary) => { summary.first_actionable_tokens = 6_000; },
    actionable_rows: (summary) => { summary.actionable_rows = 0; },
    cheaper_actionable_rows: (summary) => { summary.cheaper_actionable_rows = 0; },
    zero_round_ranges: (summary) => { summary.zero_round_ranges = []; },
    regression_ranges: (summary) => { summary.regression_ranges = []; },
    round_regions: (summary) => { summary.round_regions = {}; },
  };
  for (const [field, mutate] of Object.entries(summaryMutations)) {
    expectInvalid(withMutation(payload, (value) => {
      mutate(value.dense_sweep_summary);
    }), /dense_sweep_summary/, field);
  }
});

test("six-path matrix requires unique ordered canonical routes and complete mechanics", async () => {
  const payload = JSON.parse(await rawText());
  for (const [name, mutate] of [
    ["missing", (value) => { delete value.six_path_matrix; }],
    ["short", (value) => { value.six_path_matrix.pop(); }],
    ["duplicate-path", (value) => { value.six_path_matrix[1] = clone(value.six_path_matrix[0]); }],
    ["wrong-label", (value) => { value.six_path_matrix[3].path_label = PATH_LABELS[2]; }],
    ["wrong-input", (value) => {
      value.six_path_matrix[4].input_tokens = 3;
      value.six_path_matrix[4].input_wei = `${3n * 10n ** 18n}`;
    }],
    ["round-mismatch", (value) => { value.six_path_matrix[5].direct_rounds += 1; }],
    ["gas-mismatch", (value) => { value.six_path_matrix[2].absolute_gas_saved += 1; }],
    ["output-mismatch", (value) => {
      value.six_path_matrix[0].direct_user_output = String(
        BigInt(value.six_path_matrix[0].direct_user_output) + 1n,
      );
    }],
    ["residual-mismatch", (value) => { value.six_path_matrix[1].direct_residual = 1; }],
  ]) {
    expectInvalid(withMutation(payload, mutate), /six_path_matrix/, name);
  }
});

test("every publication gate rejects missing, false or contradictory evidence", async () => {
  const payload = JSON.parse(await rawText());
  for (const gate of CONSUMER_RECOMPUTED_GATES) {
    expectInvalid(withMutation(payload, (value) => {
      delete value.mechanical_gates[gate];
    }), /reviewed gate set/);
    expectInvalid(withMutation(payload, (value) => {
      value.mechanical_gates[gate] = false;
    }), new RegExp(gate));
    expectInvalid(mutationForGate(payload, gate), new RegExp(`${gate}|residual|tolerance|unequal`));
  }
});

test("Vite dev and dashboard build serve the exact optimized v0.1 evidence", async (context) => {
  const sourceText = await rawText();
  const server = await createServer({
    configFile: resolve(ROOT, "vite.config.ts"),
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  context.after(async () => server.close());
  await server.listen();
  const address = server.httpServer?.address();
  assert.ok(address && typeof address === "object");
  const response = await fetch(`http://127.0.0.1:${address.port}/data/release-results.json`);
  assert.equal(response.status, 200);
  const devText = await response.text();

  const build = spawnSync(process.execPath, ["scripts/build-dashboard.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
  const builtText = await readFile(resolve(ROOT, "dist/data/release-results.json"), "utf8");
  assert.equal(devText, sourceText);
  assert.equal(builtText, sourceText);
  assert.equal(sha256(devText), sha256(builtText));
  const validated = validateBenchmarkPayload(JSON.parse(devText));
  const canonical = validated.frozen_grid.find((row) => row.input_tokens === 100_000);
  assert.equal(canonical.reference_total_gas, 544_219);
  assert.equal(canonical.direct_total_gas, 375_171);
});

test("video proof and preflight reject every audited bypass without PASS or READY", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "arbfold-post-resolution-"));
  try {
    const payload = JSON.parse(await rawText());
    const validPath = join(directory, "valid.json");
    await writeFile(validPath, `${JSON.stringify(payload, null, 2)}\n`);
    const validVideo = runVideo(validPath);
    assert.equal(validVideo.status, 0, `${validVideo.stdout}\n${validVideo.stderr}`);
    assert.doesNotMatch(`${validVideo.stdout}\n${validVideo.stderr}`, /null/);
    assert.match(validVideo.stdout, /PASS/);
    const validPreflight = runPreflight(validPath);
    assert.equal(validPreflight.status, 0, `${validPreflight.stdout}\n${validPreflight.stderr}`);
    assert.match(validPreflight.stdout, /STATUS READY_FOR_MANUAL_FINISH/);

    const mutations = [];
    const add = (name, mutate, { portableInvalid = true } = {}) => {
      mutations.push([name, withMutation(payload, mutate), portableInvalid]);
    };
    for (let rowIndex = 0; rowIndex < payload.frozen_grid.length; rowIndex += 1) {
      const row = payload.frozen_grid[rowIndex];
      for (const [field, value] of [
        ["gas_reduction_percent", "99.999999"],
        ["reference_total_gas", row.reference_total_gas + 1],
        ["direct_total_gas", row.direct_total_gas + 1],
        ["absolute_gas_saved", row.absolute_gas_saved + 1],
        ["direct_to_reference_bps", row.direct_to_reference_bps + 1],
      ]) {
        add(`frozen-${rowIndex}-${field}`, (subject) => {
          subject.frozen_grid[rowIndex][field] = value;
        });
      }
    }
    add("input-wei-mismatch", (value) => { value.frozen_grid[0].input_wei = "0"; });
    add("input-wei-missing", (value) => { delete value.frozen_grid[0].input_wei; });
    add("input-wei-malformed", (value) => { value.dense_sweep[0].input_wei = "1e21"; });
    add("input-wei-overflow", (value) => {
      value.six_path_matrix[0].input_wei = UINT256_OVERFLOW;
    });
    add("reference-rounds", (value) => { value.frozen_grid[3].reference_rounds = 999; });
    add("reference-swaps", (value) => { value.frozen_grid[3].reference_arbitrage_swaps = 999; });
    add("reference-reinjections", (value) => { value.frozen_grid[3].reference_reinjections = 999; });
    add("direct-rounds", (value) => { value.frozen_grid[3].direct_rounds = 999; });
    add("direct-fold-calls", (value) => { value.frozen_grid[3].direct_fold_calls = 999; });
    add("path-label", (value) => { value.frozen_grid[3].path_label = "fabricated"; });
    add("residual-mismatch", (value) => { value.frozen_grid[1].direct_residual += 1; });
    add("residual-threshold", (value) => {
      value.frozen_grid[1].reference_residual = Number(RESIDUAL_THRESHOLD_WEI_A) + 1;
      value.frozen_grid[1].direct_residual = Number(RESIDUAL_THRESHOLD_WEI_A) + 1;
    });
    add("canonical-residual", (value) => {
      value.frozen_grid[3].reference_residual = 1;
      value.frozen_grid[3].direct_residual = 1;
    });
    add("missing-residual", (value) => { delete value.frozen_grid[0].direct_residual; });
    add("null-residual", (value) => { value.frozen_grid[0].direct_residual = null; });
    add("negative-residual", (value) => { value.frozen_grid[0].direct_residual = -1; });
    add("fractional-residual", (value) => { value.frozen_grid[0].direct_residual = 0.5; });
    add("missing-tolerance", (value) => { delete value.frozen_grid[0].equivalence_tolerance_wei; });
    add("reserve-mismatch", (value) => {
      value.frozen_grid[0].direct_final_reserves.ab_a = String(
        BigInt(value.frozen_grid[0].direct_final_reserves.ab_a) + 1_000_000_000_000n,
      );
    });
    add("reserve-number-not-lossless-string", (value) => {
      value.frozen_grid[0].direct_final_reserves.ab_a = 330641290468338554407;
    });
    add("missing-sweep", (value) => { delete value.dense_sweep; });
    add("empty-sweep", (value) => { value.dense_sweep = []; });
    add("short-sweep", (value) => { value.dense_sweep.pop(); });
    add("long-sweep", (value) => { value.dense_sweep.push(clone(value.dense_sweep.at(-1))); });
    add("duplicate-sweep", (value) => { value.dense_sweep[1] = clone(value.dense_sweep[0]); });
    add("reordered-sweep", (value) => {
      [value.dense_sweep[10], value.dense_sweep[11]] = [value.dense_sweep[11], value.dense_sweep[10]];
    });
    add("wrong-sweep-step", (value) => {
      value.dense_sweep[10].input_tokens += 1;
      value.dense_sweep[10].input_wei = `${BigInt(value.dense_sweep[10].input_tokens) * 10n ** 18n}`;
    });
    add("dense-gas", (value) => { value.dense_sweep[100].absolute_gas_saved += 1; });
    for (const field of [
      "first_actionable_tokens",
      "actionable_rows",
      "cheaper_actionable_rows",
      "zero_round_ranges",
      "regression_ranges",
      "round_regions",
    ]) {
      add(`summary-${field}`, (value) => { value.dense_sweep_summary[field] = null; });
    }
    add("missing-path-matrix", (value) => { delete value.six_path_matrix; });
    add("missing-path", (value) => { value.six_path_matrix.pop(); });
    add("duplicate-path", (value) => { value.six_path_matrix[1] = clone(value.six_path_matrix[0]); });
    add("path-label-six", (value) => { value.six_path_matrix[3].path_label = "fabricated"; });
    add("path-mechanics", (value) => { value.six_path_matrix[5].direct_rounds += 1; });
    add("uint256-overflow", (value) => {
      value.frozen_grid[4].reference_user_output = UINT256_OVERFLOW;
    });
    add("source-tree-missing", (value) => { delete value.source_tree_sha256; });
    add("source-tree-malformed", (value) => { value.source_tree_sha256 = "not-a-digest"; });
    add(
      "source-tree-fabricated",
      (value) => { value.source_tree_sha256 = "0".repeat(64); },
      { portableInvalid: false },
    );
    add("compiler-matrix-missing", (value) => { delete value.compiler_matrix; });
    add("compiler-matrix-empty", (value) => { value.compiler_matrix = []; });
    add("compiler-matrix-fictional", (value) => {
      value.compiler_matrix = [{ name: "fictional", status: "measured" }];
    });
    add("compiler-matrix-reordered", (value) => {
      [value.compiler_matrix[0], value.compiler_matrix[1]] = [
        value.compiler_matrix[1], value.compiler_matrix[0],
      ];
    });
    add("compiler-matrix-duplicate", (value) => {
      value.compiler_matrix[1] = clone(value.compiler_matrix[0]);
    });
    add("compiler-matrix-via-ir", (value) => { value.compiler_matrix[0].via_ir = true; });
    add("compiler-matrix-runs", (value) => { value.compiler_matrix[0].optimizer_runs = 1_000; });
    add("compiler-matrix-status", (value) => { value.compiler_matrix[0].status = "invented"; });
    add("compiler-matrix-gas", (value) => {
      value.compiler_matrix[1].canonical_direct_total_gas = 0;
    });
    add("compiler-matrix-percent", (value) => {
      value.compiler_matrix[2].canonical_gas_reduction_percent = "99.999999";
    });
    add("compiler-matrix-bytecode-missing", (value) => {
      delete value.compiler_matrix[0].deployed_bytecode_bytes.router;
    });
    add("compiler-matrix-bytecode-zero", (value) => {
      value.compiler_matrix[1].deployed_bytecode_bytes.hook = 0;
    });
    add("compiler-matrix-bytecode-negative", (value) => {
      value.compiler_matrix[2].deployed_bytecode_bytes.coordinator = -1;
    });
    add("compiler-matrix-error-hash", (value) => {
      value.compiler_matrix[3].error_sha256 = "0".repeat(64);
    });
    for (const gate of CONSUMER_RECOMPUTED_GATES) {
      add(`missing-gate-${gate}`, (value) => { delete value.mechanical_gates[gate]; });
      add(`false-gate-${gate}`, (value) => { value.mechanical_gates[gate] = false; });
      mutations.push([`contradictory-gate-${gate}`, mutationForGate(payload, gate)]);
    }

    context.diagnostic(`publication consumer mutation fixtures: ${mutations.length}`);
    assert.ok(mutations.length > 0);
    for (const [name, mutated, portableInvalid] of mutations) {
      if (portableInvalid !== false) expectInvalid(mutated);
      else assert.doesNotThrow(() => validateBenchmarkPayload(mutated));
      await expectConsumersReject(directory, name, mutated);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
