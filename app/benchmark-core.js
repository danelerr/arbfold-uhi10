export const BENCHMARK_SCHEMA = "arbfold-v0.1-optimized-release-candidate-v4";
export const MAX_UINT256_DECIMAL =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";
export const RESIDUAL_THRESHOLD_WEI_A = "1000000000000";

export const BENCHMARK_TOP_LEVEL_FIELDS = Object.freeze([
  "schema",
  "source_tree_sha256",
  "residual_threshold_wei_a",
  "frozen_grid",
  "dense_sweep",
  "dense_sweep_summary",
  "six_path_matrix",
  "compiler_matrix",
  "mechanical_gates",
]);

export const FROZEN_INPUTS = Object.freeze([10_000, 25_000, 50_000, 100_000, 200_000]);
export const PATH_LABELS = Object.freeze([
  "ARFX -> ARFY (internal A -> B)",
  "ARFY -> ARFX (internal B -> A)",
  "ARFY -> ARFZ (internal B -> C)",
  "ARFZ -> ARFY (internal C -> B)",
  "ARFX -> ARFZ (internal A -> C)",
  "ARFZ -> ARFX (internal C -> A)",
]);
export const SIX_PATH_INPUTS = Object.freeze([2, 5_000, 5_000, 5_000, 2, 5_000]);

export const PAIRED_DECIMAL_FIELDS = Object.freeze([
  "reference_user_output",
  "direct_user_output",
  "reference_external_recipient_reward",
  "direct_external_recipient_reward",
]);

export const CONSUMER_RECOMPUTED_GATES = Object.freeze([
  "all_frozen_outputs_equal",
  "all_frozen_rewards_equal",
  "all_frozen_residuals_equal_and_within_threshold",
  "all_frozen_final_reserves_within_one_wei",
  "twenty_five_k_cheaper",
  "all_five_cheaper",
]);

const INTRINSIC_GAS = 21_000;
const TOKEN_WEI = 1_000_000_000_000_000_000n;
const PERCENT_SCALE = 1_000_000n;
const RESIDUAL_THRESHOLD = BigInt(RESIDUAL_THRESHOLD_WEI_A);
const EIP_170_RUNTIME_BYTECODE_LIMIT = 24_576;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const RESERVE_FIELDS = Object.freeze(["ab_a", "ab_b", "bc_b", "bc_c", "ac_a", "ac_c"]);
const BYTECODE_FIELDS = Object.freeze(["coordinator", "hook", "router", "reference_router"]);
const MEASURED_COMPILER_FIELDS = Object.freeze([
  "name",
  "status",
  "via_ir",
  "optimizer_runs",
  "canonical_reference_total_gas",
  "canonical_direct_total_gas",
  "canonical_gas_reduction_percent",
  "deployed_bytecode_bytes",
]);
const FAILED_COMPILER_FIELDS = Object.freeze([
  "name",
  "status",
  "via_ir",
  "optimizer_runs",
  "error",
  "error_sha256",
]);
const REVIEWED_COMPILER_MATRIX = Object.freeze([
  {
    name: "no-ir-runs-200",
    status: "measured",
    via_ir: false,
    optimizer_runs: 200,
    canonical_reference_total_gas: 544_219,
    canonical_direct_total_gas: 375_171,
    deployed_bytecode_bytes: {
      coordinator: 10_058,
      hook: 14_728,
      router: 4_489,
      reference_router: 6_982,
    },
  },
  {
    name: "no-ir-runs-1000",
    status: "measured",
    via_ir: false,
    optimizer_runs: 1_000,
    canonical_reference_total_gas: 539_032,
    canonical_direct_total_gas: 373_059,
    deployed_bytecode_bytes: {
      coordinator: 10_703,
      hook: 15_624,
      router: 4_910,
      reference_router: 7_422,
    },
  },
  {
    name: "via-ir-runs-200",
    status: "measured",
    via_ir: true,
    optimizer_runs: 200,
    canonical_reference_total_gas: 523_349,
    canonical_direct_total_gas: 373_253,
    deployed_bytecode_bytes: {
      coordinator: 8_686,
      hook: 11_236,
      router: 3_218,
      reference_router: 5_664,
    },
  },
  {
    name: "via-ir-runs-1000",
    status: "compile-failed",
    via_ir: true,
    optimizer_runs: 1_000,
    error: "memoryguard was present.",
    error_sha256: "d93755cf520ca3d897a68b17421bae55b501f0373bd67c842cf8af6f82a821e7",
  },
]);
const FULL_ROW_NONNEGATIVE_SAFE_INTEGER_FIELDS = Object.freeze([
  "input_tokens",
  "reference_total_gas",
  "direct_total_gas",
  "reference_execution_gas",
  "direct_execution_gas",
  "reference_calldata_gas",
  "direct_calldata_gas",
  "reference_rounds",
  "direct_rounds",
  "reference_arbitrage_swaps",
  "reference_reinjections",
  "direct_fold_calls",
  "direct_to_reference_bps",
  "reference_residual",
  "direct_residual",
  "equivalence_tolerance_wei",
]);
const DENSE_SUMMARY_FIELDS = Object.freeze([
  "first_actionable_tokens",
  "actionable_rows",
  "cheaper_actionable_rows",
  "zero_round_ranges",
  "regression_ranges",
  "round_regions",
]);
const REVIEWED_DENSE_SUMMARY = Object.freeze({
  first_actionable_tokens: 5_000,
  actionable_rows: 196,
  cheaper_actionable_rows: 196,
  zero_round_ranges: [{ start_tokens: 1_000, end_tokens: 4_000 }],
  regression_ranges: [{ start_tokens: 1_000, end_tokens: 4_000 }],
  round_regions: {
    0: [{ start_tokens: 1_000, end_tokens: 4_000 }],
    1: [{ start_tokens: 5_000, end_tokens: 36_000 }],
    2: [{ start_tokens: 37_000, end_tokens: 200_000 }],
  },
});

function invalid(detail) {
  throw new Error(`Invalid ARBFOLD v0.1 benchmark evidence: ${detail}`);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateExactFieldSet(value, expectedFields, detail) {
  if (!isRecord(value)) invalid(`${detail} is not an object`);
  const observed = Object.keys(value).sort();
  const expected = [...expectedFields].sort();
  if (observed.length !== expected.length
    || !observed.every((field, index) => field === expected[index])) {
    const missing = expected.filter((field) => !observed.includes(field));
    const unexpected = observed.filter((field) => !expected.includes(field));
    invalid(`${detail} has an invalid field set (missing: ${missing.join(",") || "none"}; unexpected: ${unexpected.join(",") || "none"})`);
  }
}

export function isCanonicalUintDecimal(value) {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) return false;
  if (value.length !== MAX_UINT256_DECIMAL.length) {
    return value.length < MAX_UINT256_DECIMAL.length;
  }
  return value <= MAX_UINT256_DECIMAL;
}

function assertNonnegativeSafeInteger(value, detail) {
  if (!Number.isSafeInteger(value) || value < 0) invalid(detail);
}

function assertPositiveSafeInteger(value, detail) {
  if (!Number.isSafeInteger(value) || value <= 0) invalid(detail);
}

function assertSignedSafeInteger(value, detail) {
  if (!Number.isSafeInteger(value)) invalid(detail);
}

function validateInputIdentity(row, rowIndex, section) {
  assertPositiveSafeInteger(row.input_tokens, `${section} row ${rowIndex} has invalid input_tokens`);
  if (!isCanonicalUintDecimal(row.input_wei)) {
    invalid(`${section} row ${rowIndex} has invalid input_wei`);
  }
  const expected = BigInt(row.input_tokens) * TOKEN_WEI;
  if (BigInt(row.input_wei) !== expected) {
    invalid(`${section} row ${rowIndex} input_wei contradicts input_tokens`);
  }
}

function validateReserveShape(value, rowIndex, section, field) {
  if (!isRecord(value)) invalid(`${section} row ${rowIndex} has invalid ${field}`);
  const keys = Object.keys(value).sort();
  const expectedKeys = [...RESERVE_FIELDS].sort();
  if (keys.length !== expectedKeys.length
    || !keys.every((key, index) => key === expectedKeys[index])) {
    invalid(`${section} row ${rowIndex} has invalid ${field} fields`);
  }
  for (const reserve of RESERVE_FIELDS) {
    const observed = value[reserve];
    // Reserve JSON remains numeric in schema v4. Shape and the published
    // tolerance are enforced here; one-wei reserve deltas remain checked
    // losslessly by Python and by the source-bound Forge assertions.
    if (typeof observed !== "number" || !Number.isFinite(observed)
      || !Number.isInteger(observed) || observed < 0) {
      invalid(`${section} row ${rowIndex} has invalid ${field}.${reserve}`);
    }
  }
}

function roundHalfEven(numerator, denominator) {
  let quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const doubled = remainder * 2n;
  if (doubled > denominator || (doubled === denominator && quotient % 2n === 1n)) {
    quotient += 1n;
  }
  return quotient;
}

export function formatGasReductionPercent(referenceTotalGas, directTotalGas) {
  assertNonnegativeSafeInteger(referenceTotalGas, "reference gas must be a non-negative safe integer");
  assertNonnegativeSafeInteger(directTotalGas, "direct gas must be a non-negative safe integer");
  if (referenceTotalGas === 0) invalid("reference gas must be greater than zero");

  const delta = BigInt(referenceTotalGas) - BigInt(directTotalGas);
  const negative = delta < 0n;
  const magnitude = negative ? -delta : delta;
  const scaled = roundHalfEven(
    magnitude * 100n * PERCENT_SCALE,
    BigInt(referenceTotalGas),
  );
  const whole = scaled / PERCENT_SCALE;
  const fraction = (scaled % PERCENT_SCALE).toString().padStart(6, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function expectedDirectToReferenceBps(referenceTotalGas, directTotalGas) {
  const expected = (BigInt(directTotalGas) * 10_000n) / BigInt(referenceTotalGas);
  if (expected > BigInt(Number.MAX_SAFE_INTEGER)) {
    invalid("direct/reference basis points exceed JavaScript's safe integer range");
  }
  return Number(expected);
}

function validateGasArithmetic(row, rowIndex, section, { decomposed }) {
  assertPositiveSafeInteger(
    row.reference_total_gas,
    `${section} row ${rowIndex} has invalid reference_total_gas`,
  );
  assertNonnegativeSafeInteger(
    row.direct_total_gas,
    `${section} row ${rowIndex} has invalid direct_total_gas`,
  );
  assertSignedSafeInteger(
    row.absolute_gas_saved,
    `${section} row ${rowIndex} has invalid absolute_gas_saved`,
  );
  if (typeof row.gas_reduction_percent !== "string") {
    invalid(`${section} row ${rowIndex} has invalid gas_reduction_percent`);
  }

  if (decomposed) {
    for (const field of [
      "reference_execution_gas",
      "direct_execution_gas",
      "reference_calldata_gas",
      "direct_calldata_gas",
      "direct_to_reference_bps",
    ]) {
      assertNonnegativeSafeInteger(row[field], `${section} row ${rowIndex} has invalid ${field}`);
    }
    const expectedReferenceTotal = INTRINSIC_GAS
      + row.reference_execution_gas + row.reference_calldata_gas;
    const expectedDirectTotal = INTRINSIC_GAS
      + row.direct_execution_gas + row.direct_calldata_gas;
    if (!Number.isSafeInteger(expectedReferenceTotal) || !Number.isSafeInteger(expectedDirectTotal)) {
      invalid(`${section} row ${rowIndex} gas decomposition exceeds JavaScript's safe integer range`);
    }
    if (row.reference_total_gas !== expectedReferenceTotal) {
      invalid(`${section} row ${rowIndex} has incoherent reference_total_gas`);
    }
    if (row.direct_total_gas !== expectedDirectTotal) {
      invalid(`${section} row ${rowIndex} has incoherent direct_total_gas`);
    }
    const expectedBps = expectedDirectToReferenceBps(
      row.reference_total_gas,
      row.direct_total_gas,
    );
    if (row.direct_to_reference_bps !== expectedBps) {
      invalid(`${section} row ${rowIndex} has incoherent direct_to_reference_bps`);
    }
  }

  if (row.absolute_gas_saved !== row.reference_total_gas - row.direct_total_gas) {
    invalid(`${section} row ${rowIndex} has incoherent absolute_gas_saved`);
  }
  const expectedPercent = formatGasReductionPercent(
    row.reference_total_gas,
    row.direct_total_gas,
  );
  if (row.gas_reduction_percent !== expectedPercent) {
    invalid(`${section} row ${rowIndex} has incoherent gas_reduction_percent`);
  }
}

function validateExactPairs(row, rowIndex, section) {
  for (const field of PAIRED_DECIMAL_FIELDS) {
    if (!isCanonicalUintDecimal(row[field])) {
      invalid(`${section} row ${rowIndex} has invalid ${field}`);
    }
  }
  if (row.reference_user_output !== row.direct_user_output) {
    invalid(`${section} row ${rowIndex} has unequal user output`);
  }
  if (row.reference_external_recipient_reward !== row.direct_external_recipient_reward) {
    invalid(`${section} row ${rowIndex} has unequal fixed external-recipient reward`);
  }
}

function validateFullRow(row, rowIndex, section, { kind, expectedPath }) {
  if (!isRecord(row)) invalid(`${section} row ${rowIndex} is not an object`);
  if (row.kind !== kind) invalid(`${section} row ${rowIndex} has invalid kind`);
  if (!Number.isSafeInteger(row.path) || row.path < 0 || row.path >= PATH_LABELS.length) {
    invalid(`${section} row ${rowIndex} has invalid path`);
  }
  if (expectedPath !== undefined && row.path !== expectedPath) {
    invalid(`${section} row ${rowIndex} has unexpected path`);
  }
  if (row.path_label !== PATH_LABELS[row.path]) {
    invalid(`${section} row ${rowIndex} has non-canonical path_label`);
  }
  validateInputIdentity(row, rowIndex, section);

  for (const field of FULL_ROW_NONNEGATIVE_SAFE_INTEGER_FIELDS) {
    assertNonnegativeSafeInteger(row[field], `${section} row ${rowIndex} has invalid ${field}`);
  }
  if (row.reference_rounds <= 0) {
    invalid(`${section} row ${rowIndex} must contain an actionable reference round`);
  }
  if (row.reference_arbitrage_swaps !== 3 * row.reference_rounds) {
    invalid(`${section} row ${rowIndex} has incoherent reference_arbitrage_swaps`);
  }
  if (row.reference_reinjections !== row.reference_rounds) {
    invalid(`${section} row ${rowIndex} has incoherent reference_reinjections`);
  }
  if (row.direct_rounds !== row.reference_rounds) {
    invalid(`${section} row ${rowIndex} has incoherent direct_rounds`);
  }
  if (row.direct_fold_calls !== 1) {
    invalid(`${section} row ${rowIndex} must contain exactly one direct fold call`);
  }

  validateGasArithmetic(row, rowIndex, section, { decomposed: true });
  validateExactPairs(row, rowIndex, section);

  if (row.reference_residual !== row.direct_residual) {
    invalid(`${section} row ${rowIndex} has unequal reference/direct residual`);
  }
  if (BigInt(row.direct_residual) > RESIDUAL_THRESHOLD) {
    invalid(`${section} row ${rowIndex} residual exceeds the published threshold`);
  }

  validateReserveShape(row.reference_final_reserves, rowIndex, section, "reference_final_reserves");
  validateReserveShape(row.direct_final_reserves, rowIndex, section, "direct_final_reserves");
  if (row.equivalence_tolerance_wei > 1) {
    invalid(`${section} row ${rowIndex} exceeds the one-wei equivalence tolerance`);
  }
}

function contiguousRanges(values, step = 1_000) {
  if (values.length === 0) return [];
  const ranges = [];
  let start = values[0];
  let previous = values[0];
  for (const value of values.slice(1)) {
    if (value !== previous + step) {
      ranges.push({ start_tokens: start, end_tokens: previous });
      start = value;
    }
    previous = value;
  }
  ranges.push({ start_tokens: start, end_tokens: previous });
  return ranges;
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => deepEqual(value, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && deepEqual(left[key], right[key]));
}

export function deriveDenseSweepSummary(rows) {
  if (!Array.isArray(rows) || rows.length !== 200) {
    invalid("dense_sweep must contain exactly 200 rows");
  }

  rows.forEach((row, index) => {
    if (!isRecord(row)) invalid(`dense_sweep row ${index} is not an object`);
    const expectedInput = (index + 1) * 1_000;
    validateInputIdentity(row, index, "dense_sweep");
    if (row.input_tokens !== expectedInput) {
      invalid(`dense_sweep row ${index} breaks the 1k ordered workload grid`);
    }
    assertNonnegativeSafeInteger(
      row.direct_rounds,
      `dense_sweep row ${index} has invalid direct_rounds`,
    );
    if (row.direct_rounds > 2) {
      invalid(`dense_sweep row ${index} exceeds the reviewed round topology`);
    }
    validateGasArithmetic(row, index, "dense_sweep", { decomposed: false });
  });

  const actionable = rows.filter((row) => row.direct_rounds > 0);
  const zeroRoundTokens = rows
    .filter((row) => row.direct_rounds === 0)
    .map((row) => row.input_tokens);
  const regressionTokens = rows
    .filter((row) => row.absolute_gas_saved < 0)
    .map((row) => row.input_tokens);
  const roundValues = [...new Set(rows.map((row) => row.direct_rounds))].sort((a, b) => a - b);
  return {
    first_actionable_tokens: actionable.length ? actionable[0].input_tokens : null,
    actionable_rows: actionable.length,
    cheaper_actionable_rows: actionable.filter((row) => row.absolute_gas_saved > 0).length,
    zero_round_ranges: contiguousRanges(zeroRoundTokens),
    regression_ranges: contiguousRanges(regressionTokens),
    round_regions: Object.fromEntries(roundValues.map((rounds) => [
      String(rounds),
      contiguousRanges(
        rows.filter((row) => row.direct_rounds === rounds).map((row) => row.input_tokens),
      ),
    ])),
  };
}

function validateDenseSweep(payload) {
  const derived = deriveDenseSweepSummary(payload.dense_sweep);
  if (!isRecord(payload.dense_sweep_summary)) invalid("dense_sweep_summary is missing");
  const publishedKeys = Object.keys(payload.dense_sweep_summary).sort();
  const expectedKeys = [...DENSE_SUMMARY_FIELDS].sort();
  if (publishedKeys.length !== expectedKeys.length
    || !publishedKeys.every((key, index) => key === expectedKeys[index])) {
    invalid("dense_sweep_summary has an invalid field set");
  }
  if (!deepEqual(payload.dense_sweep_summary, derived)) {
    invalid("dense_sweep_summary contradicts the 200 measured rows");
  }
  if (!deepEqual(derived, REVIEWED_DENSE_SUMMARY)) {
    invalid("dense_sweep contradicts the reviewed canonical sweep boundary");
  }
  return derived;
}

function recomputeGates(rows) {
  return {
    all_frozen_outputs_equal: rows.every(
      (row) => row.reference_user_output === row.direct_user_output,
    ),
    all_frozen_rewards_equal: rows.every(
      (row) => row.reference_external_recipient_reward
        === row.direct_external_recipient_reward,
    ),
    all_frozen_residuals_equal_and_within_threshold: rows.every(
      (row) => row.reference_residual === row.direct_residual
        && BigInt(row.direct_residual) <= RESIDUAL_THRESHOLD,
    ),
    // This recomputes the published tolerance claim only. Actual reserve-pair
    // equivalence remains established by Forge and the source manifest.
    all_frozen_final_reserves_within_one_wei: rows.every(
      (row) => row.equivalence_tolerance_wei <= 1,
    ),
    twenty_five_k_cheaper: rows.find(
      (row) => row.input_tokens === 25_000,
    ).absolute_gas_saved > 0,
    all_five_cheaper: rows.every((row) => row.absolute_gas_saved > 0),
  };
}

function validateFrozenGrid(payload) {
  if (!Array.isArray(payload.frozen_grid) || payload.frozen_grid.length !== FROZEN_INPUTS.length) {
    invalid("frozen_grid must contain exactly five rows");
  }
  payload.frozen_grid.forEach((row, index) => {
    validateFullRow(row, index, "frozen_grid", { kind: "grid", expectedPath: 1 });
  });
  const inputs = payload.frozen_grid.map((row) => row.input_tokens);
  if (!inputs.every((value, index) => value === FROZEN_INPUTS[index])) {
    invalid("frozen_grid inputs do not match the frozen order");
  }
  const canonical = payload.frozen_grid[3];
  if (canonical.reference_rounds !== 2
    || canonical.reference_arbitrage_swaps !== 6
    || canonical.reference_reinjections !== 2
    || canonical.direct_rounds !== 2
    || canonical.direct_fold_calls !== 1) {
    invalid("canonical 100k row contradicts the reviewed 2/6/2 versus 2/1 topology");
  }
  if (canonical.reference_residual !== 0 || canonical.direct_residual !== 0) {
    invalid("canonical 100k residual must be zero");
  }
}

function validateSixPathMatrix(payload) {
  if (!Array.isArray(payload.six_path_matrix) || payload.six_path_matrix.length !== 6) {
    invalid("six_path_matrix must contain exactly six rows");
  }
  payload.six_path_matrix.forEach((row, index) => {
    validateFullRow(row, index, "six_path_matrix", { kind: "path", expectedPath: index });
    if (row.input_tokens !== SIX_PATH_INPUTS[index]) {
      invalid(`six_path_matrix row ${index} has unexpected input_tokens`);
    }
  });
}

function validateCompilerMatrix(payload) {
  if (!Array.isArray(payload.compiler_matrix) || payload.compiler_matrix.length !== 4) {
    invalid("compiler_matrix must contain exactly four configurations");
  }

  payload.compiler_matrix.forEach((row, index) => {
    const reviewed = REVIEWED_COMPILER_MATRIX[index];
    const expectedFields = reviewed.status === "measured"
      ? MEASURED_COMPILER_FIELDS
      : FAILED_COMPILER_FIELDS;
    validateExactFieldSet(row, expectedFields, `compiler_matrix row ${index}`);

    if (row.name !== reviewed.name
      || row.status !== reviewed.status
      || row.via_ir !== reviewed.via_ir
      || row.optimizer_runs !== reviewed.optimizer_runs) {
      invalid(`compiler_matrix row ${index} has an unexpected configuration`);
    }

    if (row.status === "measured") {
      assertPositiveSafeInteger(
        row.canonical_reference_total_gas,
        `compiler_matrix row ${index} has invalid canonical_reference_total_gas`,
      );
      assertPositiveSafeInteger(
        row.canonical_direct_total_gas,
        `compiler_matrix row ${index} has invalid canonical_direct_total_gas`,
      );
      const expectedPercent = formatGasReductionPercent(
        row.canonical_reference_total_gas,
        row.canonical_direct_total_gas,
      );
      if (row.canonical_gas_reduction_percent !== expectedPercent) {
        invalid(`compiler_matrix row ${index} has incoherent gas reduction percentage`);
      }
      if (row.canonical_reference_total_gas !== reviewed.canonical_reference_total_gas
        || row.canonical_direct_total_gas !== reviewed.canonical_direct_total_gas) {
        invalid(`compiler_matrix row ${index} contradicts the frozen compiler experiment`);
      }

      validateExactFieldSet(
        row.deployed_bytecode_bytes,
        BYTECODE_FIELDS,
        `compiler_matrix row ${index} deployed_bytecode_bytes`,
      );
      for (const field of BYTECODE_FIELDS) {
        const size = row.deployed_bytecode_bytes[field];
        assertPositiveSafeInteger(
          size,
          `compiler_matrix row ${index} has invalid ${field} bytecode size`,
        );
        if (size > EIP_170_RUNTIME_BYTECODE_LIMIT) {
          invalid(`compiler_matrix row ${index} ${field} exceeds the EIP-170 runtime limit`);
        }
        if (size !== reviewed.deployed_bytecode_bytes[field]) {
          invalid(`compiler_matrix row ${index} contradicts the frozen bytecode measurement`);
        }
      }
      return;
    }

    if (typeof row.error !== "string" || row.error.length === 0) {
      invalid(`compiler_matrix row ${index} has an invalid compile error`);
    }
    if (!SHA256_HEX.test(row.error_sha256)) {
      invalid(`compiler_matrix row ${index} has an invalid error_sha256`);
    }
    if (row.error !== reviewed.error || row.error_sha256 !== reviewed.error_sha256) {
      invalid(`compiler_matrix row ${index} contradicts the frozen compile failure`);
    }
  });

  const canonical = payload.frozen_grid[3];
  const selected = payload.compiler_matrix[0];
  if (selected.canonical_reference_total_gas !== canonical.reference_total_gas
    || selected.canonical_direct_total_gas !== canonical.direct_total_gas
    || selected.canonical_gas_reduction_percent !== canonical.gas_reduction_percent) {
    invalid("selected compiler configuration contradicts the canonical 100k frozen row");
  }
}

export function deriveBenchmarkFacts(payload) {
  const canonical = payload.frozen_grid[3];
  const dense = deriveDenseSweepSummary(payload.dense_sweep);
  return {
    canonical_topology: {
      reference_rounds: canonical.reference_rounds,
      reference_arbitrage_swaps: canonical.reference_arbitrage_swaps,
      reference_reinjections: canonical.reference_reinjections,
      direct_rounds: canonical.direct_rounds,
      direct_fold_calls: canonical.direct_fold_calls,
      residual_wei_a: canonical.direct_residual,
    },
    dense_sweep: dense,
    unique_paths: payload.six_path_matrix.map((row) => row.path),
  };
}

export function validateBenchmarkPayload(payload) {
  if (!isRecord(payload)) invalid("payload is not an object");
  if (payload.schema !== BENCHMARK_SCHEMA) invalid(`schema must be ${BENCHMARK_SCHEMA}`);
  if (Object.hasOwn(payload, "rows")) invalid("legacy rows payload is not accepted");
  if (Object.hasOwn(payload, "storage_transition_matrix")) {
    invalid("invalid steady-state matrix is present");
  }
  validateExactFieldSet(payload, BENCHMARK_TOP_LEVEL_FIELDS, "payload");
  if (typeof payload.source_tree_sha256 !== "string"
    || !SHA256_HEX.test(payload.source_tree_sha256)) {
    invalid("source_tree_sha256 must be a lowercase 64-character SHA-256 digest");
  }
  if (payload.residual_threshold_wei_a !== RESIDUAL_THRESHOLD_WEI_A) {
    invalid(`residual_threshold_wei_a must be ${RESIDUAL_THRESHOLD_WEI_A}`);
  }

  validateFrozenGrid(payload);
  validateDenseSweep(payload);
  validateSixPathMatrix(payload);
  validateCompilerMatrix(payload);

  const gates = payload.mechanical_gates;
  if (!isRecord(gates)) invalid("mechanical_gates is missing");
  const publishedGateNames = Object.keys(gates).sort();
  const expectedGateNames = [...CONSUMER_RECOMPUTED_GATES].sort();
  if (publishedGateNames.length !== expectedGateNames.length
    || !publishedGateNames.every((name, index) => name === expectedGateNames[index])) {
    invalid("mechanical_gates does not match the reviewed gate set");
  }

  const recomputed = recomputeGates(payload.frozen_grid);
  for (const gate of CONSUMER_RECOMPUTED_GATES) {
    if (recomputed[gate] !== true) invalid(`${gate} does not hold in frozen_grid`);
    if (gates[gate] !== recomputed[gate]) invalid(`${gate} contradicts frozen_grid`);
  }
  return payload;
}
