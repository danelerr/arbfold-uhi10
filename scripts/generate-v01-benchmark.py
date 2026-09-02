#!/usr/bin/env python3
"""Generate versioned ARBFOLD v0.1 benchmark evidence from Forge logs.

The frozen five-point gas values come from the unchanged clean-core gas test.
The v0.1 reporting tests provide mechanical state, dense-sweep, route-matrix,
and paired output/reward measurements. Historical v0 artifacts are read but
never modified. Steady-state telemetry gas is intentionally not measured by
this release because it requires a cross-transaction harness.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import pathlib
import platform
import re
import subprocess
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "contracts"
OUT = ROOT / "benchmark" / "optimized-release-candidate-results"
HISTORICAL_RAW = ROOT / "benchmark" / "release-candidate-results" / "raw.json"
INTRINSIC_GAS = 21_000
WEI = 10**18
RAW_SCHEMA = "arbfold-v0.1-optimized-release-candidate-v5"
ENVIRONMENT_SCHEMA = "arbfold-v0.1-environment-v5"
RESIDUAL_THRESHOLD_WEI_A = 10**12
TOP_LEVEL_FIELDS = {
    "schema",
    "source_tree_sha256",
    "residual_threshold_wei_a",
    "frozen_grid",
    "dense_sweep",
    "dense_sweep_summary",
    "six_path_matrix",
    "compiler_matrix",
    "mechanical_gates",
}
RELEVANT_PROVENANCE_PATHS = (
    "contracts/src",
    "contracts/test",
    "contracts/foundry.toml",
    "scripts/generate-v01-benchmark.py",
)

REPORT_TESTS = (
    "test_ReportCleanCoreGasGrid|test_ReportV01FrozenGrid|test_ReportV01DenseSweep|"
    "test_ReportV01SixPathMatrix"
)

ROW_KEYS = {
    "PATH": "path",
    "INPUT": "input_wei",
    "REFERENCE_ROUNDS": "reference_rounds",
    "DIRECT_ROUNDS": "direct_rounds",
    "REFERENCE_ARBITRAGE_SWAPS": "reference_arbitrage_swaps",
    "REFERENCE_REINJECTIONS": "reference_reinjections",
    "DIRECT_FOLD_CALLS": "direct_fold_calls",
    "REFERENCE_EXECUTION_GAS": "reference_execution_gas",
    "DIRECT_EXECUTION_GAS": "direct_execution_gas",
    "REFERENCE_CALLDATA_GAS": "reference_calldata_gas",
    "DIRECT_CALLDATA_GAS": "direct_calldata_gas",
    "REFERENCE_TOTAL_GAS": "reference_total_gas",
    "DIRECT_TOTAL_GAS": "direct_total_gas",
    "ABSOLUTE_GAS_SAVED": "absolute_gas_saved",
    "DIRECT_TO_REFERENCE_BPS": "direct_to_reference_bps",
    "REFERENCE_USER_OUTPUT": "reference_user_output",
    "DIRECT_USER_OUTPUT": "direct_user_output",
    "REFERENCE_EXTERNAL_RECIPIENT_REWARD": "reference_external_recipient_reward",
    "DIRECT_EXTERNAL_RECIPIENT_REWARD": "direct_external_recipient_reward",
    "REFERENCE_RESIDUAL": "reference_residual",
    "DIRECT_RESIDUAL": "direct_residual",
    "REFERENCE_AB_A": "reference_ab_a",
    "REFERENCE_AB_B": "reference_ab_b",
    "REFERENCE_BC_B": "reference_bc_b",
    "REFERENCE_BC_C": "reference_bc_c",
    "REFERENCE_AC_A": "reference_ac_a",
    "REFERENCE_AC_C": "reference_ac_c",
    "DIRECT_AB_A": "direct_ab_a",
    "DIRECT_AB_B": "direct_ab_b",
    "DIRECT_BC_B": "direct_bc_b",
    "DIRECT_BC_C": "direct_bc_c",
    "DIRECT_AC_A": "direct_ac_a",
    "DIRECT_AC_C": "direct_ac_c",
    "EQUIVALENCE_TOLERANCE": "equivalence_tolerance_wei",
}

PATHS = {
    0: "ARFX -> ARFY (internal A -> B)",
    1: "ARFY -> ARFX (internal B -> A)",
    2: "ARFY -> ARFZ (internal B -> C)",
    3: "ARFZ -> ARFY (internal C -> B)",
    4: "ARFX -> ARFZ (internal A -> C)",
    5: "ARFZ -> ARFX (internal C -> A)",
}

PAIRED_DECIMAL_FIELDS = (
    "reference_user_output",
    "direct_user_output",
    "reference_external_recipient_reward",
    "direct_external_recipient_reward",
)
CANONICAL_UINT_DECIMAL = re.compile(r"^(0|[1-9][0-9]*)$")
SHA256_HEX = re.compile(r"^[0-9a-f]{64}$")
MAX_UINT256 = 2**256 - 1
MAX_UINT256_DECIMAL = str(MAX_UINT256)
MEASURED_COMPILER_FIELDS = {
    "name",
    "status",
    "via_ir",
    "optimizer_runs",
    "canonical_reference_total_gas",
    "canonical_direct_total_gas",
    "canonical_gas_reduction_percent",
    "deployed_bytecode_bytes",
}
FAILED_COMPILER_FIELDS = {
    "name",
    "status",
    "via_ir",
    "optimizer_runs",
    "error",
    "error_sha256",
}
BYTECODE_FIELDS = {"coordinator", "hook", "router", "reference_router"}
REVIEWED_COMPILER_MATRIX = (
    {
        "name": "no-ir-runs-200",
        "status": "measured",
        "via_ir": False,
        "optimizer_runs": 200,
        "reference": 544_219,
        "direct": 375_171,
        "bytecode": {"coordinator": 10_058, "hook": 14_728, "router": 4_489, "reference_router": 6_982},
    },
    {
        "name": "no-ir-runs-1000",
        "status": "measured",
        "via_ir": False,
        "optimizer_runs": 1_000,
        "reference": 539_032,
        "direct": 373_059,
        "bytecode": {"coordinator": 10_703, "hook": 15_624, "router": 4_910, "reference_router": 7_422},
    },
    {
        "name": "via-ir-runs-200",
        "status": "measured",
        "via_ir": True,
        "optimizer_runs": 200,
        "reference": 523_349,
        "direct": 373_253,
        "bytecode": {"coordinator": 8_686, "hook": 11_236, "router": 3_218, "reference_router": 5_664},
    },
    {
        "name": "via-ir-runs-1000",
        "status": "compile-failed",
        "via_ir": True,
        "optimizer_runs": 1_000,
        "error": "memoryguard was present.",
        "error_sha256": "d93755cf520ca3d897a68b17421bae55b501f0373bd67c842cf8af6f82a821e7",
    },
)


def run(command: list[str], *, env: dict[str, str] | None = None) -> str:
    merged = os.environ.copy()
    if env:
        merged.update(env)
    completed = subprocess.run(
        command,
        cwd=CONTRACTS,
        env=merged,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    if completed.returncode:
        raise RuntimeError(f"command failed ({completed.returncode}): {' '.join(command)}\n{completed.stdout}")
    return completed.stdout


def reproducible_forge_log(output: str) -> str:
    """Remove wall/CPU timings while preserving measurements and diagnostics."""
    normalized = re.sub(
        r"finished in [0-9.]+(?:ms|s)(?: \([0-9.]+(?:ms|s) CPU time\))?",
        "finished in <elapsed>",
        output,
    )
    return re.sub(
        r"in [0-9.]+(?:ms|s) \([0-9.]+(?:ms|s) CPU time\)",
        "in <elapsed>",
        normalized,
    )


def git(*args: str, cwd: pathlib.Path = ROOT) -> str:
    return subprocess.check_output(["git", *args], cwd=cwd, text=True).strip()


def parse_clean_rows(output: str) -> list[dict[str, int]]:
    rows: list[dict[str, int]] = []
    current: dict[str, int] | None = None
    for raw_line in output.splitlines():
        line = raw_line.strip()
        match = re.match(r"CLEAN_CORE_(SIZE|BACKRUN_TOTAL|DIRECT_TOTAL|GAS_RATIO_BPS)\s+(-?\d+)$", line)
        if not match:
            continue
        key, value = match.group(1), int(match.group(2))
        if key == "SIZE":
            current = {"input_wei": value}
            rows.append(current)
        elif current is not None:
            current[key.lower()] = value
    if len(rows) != 5 or any(len(row) != 4 for row in rows):
        raise RuntimeError(f"expected five complete frozen rows, got {rows}")
    return rows


def parse_v01_rows(output: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for raw_line in output.splitlines():
        line = raw_line.strip()
        match = re.match(r"V01_([A-Z_]+)\s+(.+)$", line)
        if not match:
            continue
        label, raw_value = match.groups()
        if label == "ROW_KIND":
            current = {"kind": raw_value}
            continue
        if current is None:
            continue
        if label == "ROW_END":
            missing = set(ROW_KEYS.values()) - current.keys()
            if missing:
                raise RuntimeError(f"incomplete v0.1 benchmark row; missing {sorted(missing)}")
            rows.append(current)
            current = None
            continue
        key = ROW_KEYS.get(label)
        if key is None:
            raise RuntimeError(f"unknown v0.1 log label: {label}")
        current[key] = int(raw_value)
    if current is not None:
        raise RuntimeError("unterminated v0.1 benchmark row")
    return rows


def parse_sweep_rows(output: str) -> list[dict[str, int]]:
    rows: list[dict[str, int]] = []
    current: dict[str, int] | None = None
    labels = {
        "INPUT": "input_wei",
        "REFERENCE_TOTAL": "reference_total_gas",
        "DIRECT_TOTAL": "direct_total_gas",
        "ROUNDS": "direct_rounds",
    }
    for raw_line in output.splitlines():
        match = re.match(r"\s*V01_SWEEP_(INPUT|REFERENCE_TOTAL|DIRECT_TOTAL|ROUNDS)\s+(\d+)$", raw_line)
        if not match:
            continue
        label, raw_value = match.groups()
        if label == "INPUT":
            if current is not None:
                rows.append(current)
            current = {}
        assert current is not None
        current[labels[label]] = int(raw_value)
    if current is not None:
        rows.append(current)
    if any(len(row) != 4 for row in rows):
        raise RuntimeError("incomplete dense sweep gas row")
    return rows


def reserve_objects(row: dict[str, Any]) -> None:
    row["reference_final_reserves"] = {
        "ab_a": canonical_uint_decimal(row.pop("reference_ab_a")),
        "ab_b": canonical_uint_decimal(row.pop("reference_ab_b")),
        "bc_b": canonical_uint_decimal(row.pop("reference_bc_b")),
        "bc_c": canonical_uint_decimal(row.pop("reference_bc_c")),
        "ac_a": canonical_uint_decimal(row.pop("reference_ac_a")),
        "ac_c": canonical_uint_decimal(row.pop("reference_ac_c")),
    }
    row["direct_final_reserves"] = {
        "ab_a": canonical_uint_decimal(row.pop("direct_ab_a")),
        "ab_b": canonical_uint_decimal(row.pop("direct_ab_b")),
        "bc_b": canonical_uint_decimal(row.pop("direct_bc_b")),
        "bc_c": canonical_uint_decimal(row.pop("direct_bc_c")),
        "ac_a": canonical_uint_decimal(row.pop("direct_ac_a")),
        "ac_c": canonical_uint_decimal(row.pop("direct_ac_c")),
    }


def reduction(reference: int, direct: int) -> str:
    if reference <= 0 or direct < 0:
        raise ValueError("gas totals must use a positive reference and non-negative direct value")
    delta = reference - direct
    negative = delta < 0
    numerator = abs(delta) * 100 * 1_000_000
    quotient, remainder = divmod(numerator, reference)
    if remainder * 2 > reference or (remainder * 2 == reference and quotient % 2 == 1):
        quotient += 1
    whole, fraction = divmod(quotient, 1_000_000)
    return f"{'-' if negative else ''}{whole}.{fraction:06d}"


def is_canonical_uint_decimal(value: Any) -> bool:
    if not isinstance(value, str) or CANONICAL_UINT_DECIMAL.fullmatch(value) is None:
        return False
    return len(value) < len(MAX_UINT256_DECIMAL) or (
        len(value) == len(MAX_UINT256_DECIMAL) and value <= MAX_UINT256_DECIMAL
    )


def canonical_uint_decimal(value: Any) -> str:
    """Serialize uint256 evidence without crossing a JavaScript number boundary."""
    if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > MAX_UINT256:
        raise ValueError(f"expected an in-range uint256 integer, got {value!r}")
    rendered = str(value)
    if not CANONICAL_UINT_DECIMAL.fullmatch(rendered):
        raise ValueError(f"non-canonical uint decimal: {rendered!r}")
    return rendered


def paired_equivalence_gates(rows: list[dict[str, Any]]) -> dict[str, bool]:
    """Derive equality gates only from independently recorded paired values."""
    if not rows:
        raise ValueError("paired evidence requires at least one row")
    for row in rows:
        for field in PAIRED_DECIMAL_FIELDS:
            value = row.get(field)
            if not is_canonical_uint_decimal(value):
                raise ValueError(f"invalid paired decimal field {field}: {value!r}")
    return {
        "all_frozen_outputs_equal": all(
            row["reference_user_output"] == row["direct_user_output"] for row in rows
        ),
        "all_frozen_rewards_equal": all(
            row["reference_external_recipient_reward"] == row["direct_external_recipient_reward"]
            for row in rows
        ),
    }


def finalize_row(row: dict[str, Any]) -> None:
    row["input_tokens"] = row["input_wei"] // WEI
    row["gas_reduction_percent"] = reduction(row["reference_total_gas"], row["direct_total_gas"])
    row["path_label"] = PATHS[row["path"]]
    reserve_objects(row)
    for field in PAIRED_DECIMAL_FIELDS:
        row[field] = canonical_uint_decimal(row[field])
    row["input_wei"] = canonical_uint_decimal(row["input_wei"])


def merge_frozen_gas(clean: list[dict[str, int]], v01_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    details = {row["input_wei"]: row for row in v01_rows if row["kind"] == "grid"}
    merged: list[dict[str, Any]] = []
    for gas_row in clean:
        row = details[gas_row["input_wei"]]
        row["reference_total_gas"] = gas_row["backrun_total"]
        row["direct_total_gas"] = gas_row["direct_total"]
        row["reference_execution_gas"] = (
            row["reference_total_gas"] - INTRINSIC_GAS - row["reference_calldata_gas"]
        )
        row["direct_execution_gas"] = row["direct_total_gas"] - INTRINSIC_GAS - row["direct_calldata_gas"]
        row["absolute_gas_saved"] = row["reference_total_gas"] - row["direct_total_gas"]
        row["direct_to_reference_bps"] = row["direct_total_gas"] * 10_000 // row["reference_total_gas"]
        finalize_row(row)
        merged.append(row)
    return merged


def contiguous_ranges(values: list[int], step: int = 1_000) -> list[dict[str, int]]:
    if not values:
        return []
    ranges: list[dict[str, int]] = []
    start = previous = values[0]
    for value in values[1:]:
        if value != previous + step:
            ranges.append({"start_tokens": start, "end_tokens": previous})
            start = value
        previous = value
    ranges.append({"start_tokens": start, "end_tokens": previous})
    return ranges


def derive_sweep_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    actionable = [row for row in rows if row["direct_rounds"] > 0]
    zero_round_tokens = [row["input_tokens"] for row in rows if row["direct_rounds"] == 0]
    regression_tokens = [row["input_tokens"] for row in rows if row["absolute_gas_saved"] < 0]
    return {
        "first_actionable_tokens": actionable[0]["input_tokens"] if actionable else None,
        "zero_round_ranges": contiguous_ranges(zero_round_tokens),
        "regression_ranges": contiguous_ranges(regression_tokens),
        "actionable_rows": len(actionable),
        "cheaper_actionable_rows": sum(row["absolute_gas_saved"] > 0 for row in actionable),
        "round_regions": {
            str(rounds): contiguous_ranges(
                [row["input_tokens"] for row in rows if row["direct_rounds"] == rounds]
            )
            for rounds in sorted({row["direct_rounds"] for row in rows})
        },
    }


def validate_generated_input_identity(row: dict[str, Any], section: str, index: int) -> None:
    input_tokens = row.get("input_tokens")
    input_wei = row.get("input_wei")
    if (
        isinstance(input_tokens, bool)
        or not isinstance(input_tokens, int)
        or input_tokens <= 0
        or not is_canonical_uint_decimal(input_wei)
        or int(input_wei) != input_tokens * WEI
    ):
        raise RuntimeError(f"{section} row {index} has inconsistent input identity")


def validate_generated_full_row(
    row: dict[str, Any], section: str, index: int, expected_kind: str, expected_path: int
) -> None:
    validate_generated_input_identity(row, section, index)
    if row.get("kind") != expected_kind or row.get("path") != expected_path:
        raise RuntimeError(f"{section} row {index} has inconsistent kind/path")
    if row.get("path_label") != PATHS[expected_path]:
        raise RuntimeError(f"{section} row {index} has inconsistent path label")
    rounds = row.get("reference_rounds")
    if (
        isinstance(rounds, bool)
        or not isinstance(rounds, int)
        or rounds <= 0
        or row.get("reference_arbitrage_swaps") != 3 * rounds
        or row.get("reference_reinjections") != rounds
        or row.get("direct_rounds") != rounds
        or row.get("direct_fold_calls") != 1
    ):
        raise RuntimeError(f"{section} row {index} has inconsistent round topology")
    if row.get("reference_total_gas") != (
        INTRINSIC_GAS + row.get("reference_execution_gas", -1) + row.get("reference_calldata_gas", -1)
    ) or row.get("direct_total_gas") != (
        INTRINSIC_GAS + row.get("direct_execution_gas", -1) + row.get("direct_calldata_gas", -1)
    ):
        raise RuntimeError(f"{section} row {index} has inconsistent total gas")
    if row.get("absolute_gas_saved") != row["reference_total_gas"] - row["direct_total_gas"]:
        raise RuntimeError(f"{section} row {index} has inconsistent gas saving")
    if row.get("gas_reduction_percent") != reduction(
        row["reference_total_gas"], row["direct_total_gas"]
    ):
        raise RuntimeError(f"{section} row {index} has inconsistent gas percentage")
    if row.get("reference_user_output") != row.get("direct_user_output") or row.get(
        "reference_external_recipient_reward"
    ) != row.get("direct_external_recipient_reward"):
        raise RuntimeError(f"{section} row {index} has inconsistent paired values")
    if (
        row.get("reference_residual") != row.get("direct_residual")
        or isinstance(row.get("direct_residual"), bool)
        or not isinstance(row.get("direct_residual"), int)
        or not 0 <= row["direct_residual"] <= RESIDUAL_THRESHOLD_WEI_A
    ):
        raise RuntimeError(f"{section} row {index} violates the residual policy")
    reference_reserves = row.get("reference_final_reserves", {})
    direct_reserves = row.get("direct_final_reserves", {})
    reserve_fields = ("ab_a", "ab_b", "bc_b", "bc_c", "ac_a", "ac_c")
    if set(reference_reserves) != set(reserve_fields) or set(direct_reserves) != set(reserve_fields):
        raise RuntimeError(f"{section} row {index} has incomplete reserves")
    if any(
        not is_canonical_uint_decimal(reserves.get(field))
        for reserves in (reference_reserves, direct_reserves)
        for field in reserve_fields
    ):
        raise RuntimeError(f"{section} row {index} has a non-canonical reserve")
    max_delta = max(
        abs(int(reference_reserves[field]) - int(direct_reserves[field])) for field in reserve_fields
    )
    if row.get("equivalence_tolerance_wei") != max_delta or max_delta > 1:
        raise RuntimeError(f"{section} row {index} has inconsistent reserve tolerance")


def validate_generated_compiler_matrix(raw: dict[str, Any]) -> None:
    rows = raw.get("compiler_matrix")
    if not isinstance(rows, list) or len(rows) != len(REVIEWED_COMPILER_MATRIX):
        raise RuntimeError("generated compiler_matrix must contain four configurations")
    for index, (row, reviewed) in enumerate(zip(rows, REVIEWED_COMPILER_MATRIX)):
        expected_fields = (
            MEASURED_COMPILER_FIELDS
            if reviewed["status"] == "measured"
            else FAILED_COMPILER_FIELDS
        )
        if not isinstance(row, dict) or set(row) != expected_fields:
            raise RuntimeError(f"compiler_matrix row {index} has an invalid field set")
        if any(
            row.get(field) != reviewed[field]
            for field in ("name", "status", "via_ir", "optimizer_runs")
        ):
            raise RuntimeError(f"compiler_matrix row {index} has an unexpected configuration")
        if row["status"] == "measured":
            reference = row.get("canonical_reference_total_gas")
            direct = row.get("canonical_direct_total_gas")
            if (
                isinstance(reference, bool)
                or not isinstance(reference, int)
                or reference <= 0
                or isinstance(direct, bool)
                or not isinstance(direct, int)
                or direct <= 0
            ):
                raise RuntimeError(f"compiler_matrix row {index} has invalid gas")
            if row.get("canonical_gas_reduction_percent") != reduction(reference, direct):
                raise RuntimeError(f"compiler_matrix row {index} has inconsistent percentage")
            if reference != reviewed["reference"] or direct != reviewed["direct"]:
                raise RuntimeError(
                    f"compiler_matrix row {index} contradicts the frozen compiler experiment"
                )
            bytecode = row.get("deployed_bytecode_bytes")
            if not isinstance(bytecode, dict) or set(bytecode) != BYTECODE_FIELDS:
                raise RuntimeError(f"compiler_matrix row {index} has incomplete bytecode sizes")
            for field in BYTECODE_FIELDS:
                size = bytecode.get(field)
                if (
                    isinstance(size, bool)
                    or not isinstance(size, int)
                    or not 0 < size <= 24_576
                    or size != reviewed["bytecode"][field]
                ):
                    raise RuntimeError(
                        f"compiler_matrix row {index} has invalid {field} bytecode size"
                    )
            continue
        error = row.get("error")
        error_sha256 = row.get("error_sha256")
        if (
            not isinstance(error, str)
            or not error
            or not isinstance(error_sha256, str)
            or SHA256_HEX.fullmatch(error_sha256) is None
            or hashlib.sha256(error.encode()).hexdigest() != error_sha256
            or error != reviewed["error"]
            or error_sha256 != reviewed["error_sha256"]
        ):
            raise RuntimeError(f"compiler_matrix row {index} has invalid compile failure evidence")

    canonical = raw["frozen_grid"][3]
    selected = rows[0]
    if (
        selected["canonical_reference_total_gas"] != canonical["reference_total_gas"]
        or selected["canonical_direct_total_gas"] != canonical["direct_total_gas"]
        or selected["canonical_gas_reduction_percent"]
        != canonical["gas_reduction_percent"]
    ):
        raise RuntimeError("selected compiler configuration contradicts the 100k row")


def validate_generated_payload(raw: dict[str, Any]) -> None:
    if raw.get("schema") != RAW_SCHEMA:
        raise RuntimeError("generated raw has the wrong schema")
    if set(raw) != TOP_LEVEL_FIELDS:
        raise RuntimeError("generated raw has an invalid top-level field set")
    source_digest = raw.get("source_tree_sha256")
    if not isinstance(source_digest, str) or SHA256_HEX.fullmatch(source_digest) is None:
        raise RuntimeError("generated raw has an invalid source_tree_sha256")
    if raw.get("residual_threshold_wei_a") != str(RESIDUAL_THRESHOLD_WEI_A):
        raise RuntimeError("generated raw has the wrong residual threshold")
    frozen = raw.get("frozen_grid")
    if not isinstance(frozen, list) or [row.get("input_tokens") for row in frozen] != [
        10_000,
        25_000,
        50_000,
        100_000,
        200_000,
    ]:
        raise RuntimeError("generated frozen grid is incomplete or out of order")
    for index, row in enumerate(frozen):
        validate_generated_full_row(row, "frozen_grid", index, "grid", 1)
    canonical = frozen[3]
    if (
        canonical["reference_rounds"],
        canonical["reference_arbitrage_swaps"],
        canonical["reference_reinjections"],
        canonical["direct_rounds"],
        canonical["direct_fold_calls"],
        canonical["direct_residual"],
    ) != (2, 6, 2, 2, 1, 0):
        raise RuntimeError("generated canonical row contradicts the reviewed topology")

    sweep = raw.get("dense_sweep")
    if not isinstance(sweep, list) or len(sweep) != 200:
        raise RuntimeError("generated dense sweep must contain 200 rows")
    for index, row in enumerate(sweep):
        validate_generated_input_identity(row, "dense_sweep", index)
        if row["input_tokens"] != (index + 1) * 1_000:
            raise RuntimeError(f"dense_sweep row {index} is out of order")
        if row.get("absolute_gas_saved") != row.get("reference_total_gas") - row.get(
            "direct_total_gas"
        ) or row.get("gas_reduction_percent") != reduction(
            row["reference_total_gas"], row["direct_total_gas"]
        ):
            raise RuntimeError(f"dense_sweep row {index} has inconsistent gas arithmetic")
        if row.get("direct_rounds") not in (0, 1, 2):
            raise RuntimeError(f"dense_sweep row {index} has inconsistent direct_rounds")
    derived_summary = derive_sweep_summary(sweep)
    if raw.get("dense_sweep_summary") != derived_summary:
        raise RuntimeError("dense_sweep_summary contradicts its rows")
    if (
        derived_summary["first_actionable_tokens"] != 5_000
        or derived_summary["actionable_rows"] != 196
        or derived_summary["cheaper_actionable_rows"] != 196
        or derived_summary["zero_round_ranges"] != [{"start_tokens": 1_000, "end_tokens": 4_000}]
    ):
        raise RuntimeError("generated dense sweep contradicts the reviewed workload boundary")

    paths = raw.get("six_path_matrix")
    expected_inputs = (2, 5_000, 5_000, 5_000, 2, 5_000)
    if not isinstance(paths, list) or len(paths) != 6:
        raise RuntimeError("generated six-path matrix is incomplete")
    for index, row in enumerate(paths):
        validate_generated_full_row(row, "six_path_matrix", index, "path", index)
        if row["input_tokens"] != expected_inputs[index]:
            raise RuntimeError(f"six_path_matrix row {index} has unexpected input")
    validate_generated_compiler_matrix(raw)


def compact_token_value(value: int) -> str:
    return f"{value // 1_000}k" if value % 1_000 == 0 else f"{value:,}"


def format_ranges(ranges: list[dict[str, int]]) -> str:
    if not ranges:
        return "none"
    rendered = []
    for item in ranges:
        start = compact_token_value(item["start_tokens"])
        end = compact_token_value(item["end_tokens"])
        rendered.append(start if start == end else f"{start}–{end}")
    return ", ".join(rendered)


def bytecode_sizes() -> dict[str, int]:
    artifacts = {
        "coordinator": CONTRACTS / "out" / "ArbFoldCoordinator.sol" / "ArbFoldCoordinator.json",
        "hook": CONTRACTS / "out" / "ArbFoldHook.sol" / "ArbFoldHook.json",
        "router": CONTRACTS / "out" / "ArbFoldRouter.sol" / "ArbFoldRouter.json",
        "reference_router": CONTRACTS
        / "out"
        / "CleanCoreBenchmarkHarnesses.sol"
        / "CleanCoreAtomicBackrunRouter.json",
    }
    sizes: dict[str, int] = {}
    for name, path in artifacts.items():
        artifact = json.loads(path.read_text(encoding="utf-8"))
        object_hex = artifact["deployedBytecode"]["object"]
        sizes[name] = (len(object_hex) - 2) // 2 if object_hex.startswith("0x") else len(object_hex) // 2
    return sizes


def compiler_matrix() -> list[dict[str, Any]]:
    candidates = [
        ("no-ir-runs-200", []),
        ("no-ir-runs-1000", ["--optimizer-runs", "1000"]),
        ("via-ir-runs-200", ["--via-ir", "--optimizer-runs", "200"]),
        ("via-ir-runs-1000", ["--via-ir", "--optimizer-runs", "1000"]),
    ]
    results: list[dict[str, Any]] = []
    for name, flags in candidates:
        command = [
            "forge",
            "test",
            "--offline",
            *flags,
            "--match-test",
            "test_ReportCleanCoreGasGrid",
            "-vv",
        ]
        try:
            output = run(command, env={"FOUNDRY_PROFILE": "release"})
        except RuntimeError as error:
            message = str(error)
            stable_error = message.splitlines()[-1]
            results.append(
                {
                    "name": name,
                    "via_ir": "--via-ir" in flags,
                    "optimizer_runs": 1000 if "1000" in flags else 200,
                    "status": "compile-failed",
                    "error": stable_error,
                    "error_sha256": hashlib.sha256(stable_error.encode()).hexdigest(),
                }
            )
            continue
        canonical = next(row for row in parse_clean_rows(output) if row["input_wei"] == 100_000 * WEI)
        results.append(
            {
                "name": name,
                "status": "measured",
                "via_ir": "--via-ir" in flags,
                "optimizer_runs": 1000 if "1000" in flags else 200,
                "canonical_reference_total_gas": canonical["backrun_total"],
                "canonical_direct_total_gas": canonical["direct_total"],
                "canonical_gas_reduction_percent": reduction(canonical["backrun_total"], canonical["direct_total"]),
                "deployed_bytecode_bytes": bytecode_sizes(),
            }
        )
    return results


def source_manifest() -> tuple[str, str]:
    paths = sorted(
        [*CONTRACTS.glob("src/*.sol"), *CONTRACTS.glob("test/*.sol"), CONTRACTS / "foundry.toml", pathlib.Path(__file__)]
    )
    lines: list[str] = []
    for path in paths:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        lines.append(f"{digest}  {path.relative_to(ROOT)}")
    text = "\n".join(lines) + "\n"
    return text, hashlib.sha256(text.encode()).hexdigest()


def local_timezone_name() -> str:
    localtime = pathlib.Path("/etc/localtime")
    try:
        target = localtime.resolve().as_posix()
        marker = "/zoneinfo/"
        if marker in target:
            return target.split(marker, 1)[1]
    except OSError:
        pass
    return str(dt.datetime.now().astimezone().tzinfo)


def stable_generated_at(source_tree_sha256: str) -> str:
    previous = OUT / "environment.json"
    if previous.is_file():
        try:
            value = json.loads(previous.read_text(encoding="utf-8"))
            if value.get("source_tree_sha256") == source_tree_sha256 and value.get("generated_at"):
                return str(value["generated_at"])
        except (json.JSONDecodeError, OSError):
            pass
    return dt.datetime.now().astimezone().isoformat()


def stable_commit_base(source_tree_sha256: str) -> str:
    """Keep the commit that first bound an unchanged measurement source tree."""
    previous = OUT / "environment.json"
    if previous.is_file():
        try:
            value = json.loads(previous.read_text(encoding="utf-8"))
            commit_base = value.get("commit_base")
            if (
                value.get("source_tree_sha256") == source_tree_sha256
                and isinstance(commit_base, str)
                and re.fullmatch(r"[0-9a-f]{40}", commit_base)
            ):
                return commit_base
        except (json.JSONDecodeError, OSError):
            pass
    return git("rev-parse", "HEAD")


def environment(source_tree_sha256: str, commands: list[str]) -> dict[str, Any]:
    forge_version = run(["forge", "--version"]).splitlines()[0]
    provenance_diff = git("diff", "--binary", "--", *RELEVANT_PROVENANCE_PATHS)
    return {
        "schema": ENVIRONMENT_SCHEMA,
        "generated_at": stable_generated_at(source_tree_sha256),
        "timezone": local_timezone_name(),
        "platform": platform.platform(),
        "forge_version": forge_version,
        "solidity_version": "0.8.26",
        "evm_target": "cancun",
        "optimizer_enabled": True,
        "optimizer_runs": 200,
        "via_ir": False,
        "selected_compiler_configuration": "no-ir-runs-200",
        "selection_rationale": (
            "Retains the already validated compilation pipeline and compares both paths under identical settings; "
            "alternative configurations are reported, not selected by relative percentage."
        ),
        "commit_base": stable_commit_base(source_tree_sha256),
        "branch": git("branch", "--show-current"),
        "dirty_state_relevant_to_measurement": git(
            "status", "--short", "--", *RELEVANT_PROVENANCE_PATHS
        ).splitlines(),
        "tracked_measurement_diff_sha256": hashlib.sha256(provenance_diff.encode()).hexdigest(),
        "source_tree_sha256": source_tree_sha256,
        "openzeppelin_uniswap_hooks_commit": git("rev-parse", "HEAD", cwd=CONTRACTS / "lib" / "openzeppelin-uniswap-hooks"),
        "gas_accounting": "intrinsic + calldata + measured EVM execution",
        "frozen_grid_token_units": [10_000, 25_000, 50_000, 100_000, 200_000],
        "dense_sweep": {"start_tokens": 1_000, "end_tokens": 200_000, "step_tokens": 1_000},
        "state_tolerance_wei": 1,
        "residual_threshold_wei_a": str(RESIDUAL_THRESHOLD_WEI_A),
        "commands": commands,
    }


def persist_artifacts(artifacts: dict[pathlib.Path, str], *, check: bool) -> None:
    """Write generated evidence, or compare it without mutating the release."""
    if check:
        mismatches = []
        for path, rendered in artifacts.items():
            if path.is_file() and path.read_text(encoding="utf-8") == rendered:
                continue
            try:
                mismatches.append(path.relative_to(ROOT).as_posix())
            except ValueError:
                mismatches.append(path.as_posix())
        if mismatches:
            raise RuntimeError(
                "generated evidence differs from committed artifacts: " + ", ".join(mismatches)
            )
        return

    OUT.mkdir(parents=True, exist_ok=True)
    for path, rendered in artifacts.items():
        path.write_text(rendered, encoding="utf-8")


def validate_generated_environment(
    raw: dict[str, Any], value: dict[str, Any], source_tree_sha256: str
) -> None:
    selected = raw["compiler_matrix"][0]
    if value.get("schema") != ENVIRONMENT_SCHEMA:
        raise RuntimeError("generated environment has the wrong schema")
    if (
        value.get("source_tree_sha256") != source_tree_sha256
        or raw.get("source_tree_sha256") != source_tree_sha256
    ):
        raise RuntimeError("generated raw/environment provenance digest is inconsistent")
    if (
        value.get("selected_compiler_configuration") != selected["name"]
        or value.get("optimizer_enabled") is not True
        or value.get("optimizer_runs") != selected["optimizer_runs"]
        or value.get("via_ir") is not selected["via_ir"]
    ):
        raise RuntimeError("generated environment contradicts the selected compiler row")
    if value.get("residual_threshold_wei_a") != raw["residual_threshold_wei_a"]:
        raise RuntimeError("generated environment contradicts the residual threshold")


def markdown_table(rows: list[dict[str, Any]], fields: list[tuple[str, str]]) -> str:
    header = "| " + " | ".join(label for label, _ in fields) + " |"
    separator = "|" + "|".join("---:" for _ in fields) + "|"
    body = ["| " + " | ".join(str(row[key]) for _, key in fields) + " |" for row in rows]
    return "\n".join([header, separator, *body])


def build_report(raw: dict[str, Any], historical: dict[str, Any]) -> str:
    grid = raw["frozen_grid"]
    comparison = []
    old = {int(row["origin_input_wei"]): row for row in historical["rows"]}
    for row in grid:
        v0 = old[int(row["input_wei"])]
        comparison.append(
            {
                "input_tokens": row["input_tokens"],
                "v0_direct": v0["direct_total_gas"],
                "v01_direct": row["direct_total_gas"],
                "direct_delta": row["direct_total_gas"] - v0["direct_total_gas"],
            }
        )
    path_rows = [
        {
            "path": row["path_label"],
            "input": row["input_tokens"],
            "rounds": row["direct_rounds"],
            "reference": row["reference_total_gas"],
            "direct": row["direct_total_gas"],
            "reduction": row["gas_reduction_percent"] + "%",
        }
        for row in raw["six_path_matrix"]
    ]
    compiler_rows = []
    for row in raw["compiler_matrix"]:
        if row["status"] == "measured":
            compiler_rows.append(
                {
                    "name": row["name"],
                    "status": "measured",
                    "reference": row["canonical_reference_total_gas"],
                    "direct": row["canonical_direct_total_gas"],
                    "coordinator": row["deployed_bytecode_bytes"]["coordinator"],
                }
            )
        else:
            compiler_rows.append(
                {"name": row["name"], "status": "compile failed", "reference": "—", "direct": "—", "coordinator": "—"}
            )
    sweep = raw["dense_sweep_summary"]
    return f"""# ARBFOLD v0.1 optimized release-candidate benchmark

Generated from the v0.1 source manifest in this directory. Historical v0 evidence remains unchanged.

## Promotion gate

- Frozen mechanical equivalence: **PASS** (all six final reserves match within the measured tolerance).
- Paired user-output equality: **{'PASS' if raw['mechanical_gates']['all_frozen_outputs_equal'] else 'FAIL'}**.
- Paired fixed external-recipient reward equality: **{'PASS' if raw['mechanical_gates']['all_frozen_rewards_equal'] else 'FAIL'}**.
- Reference/direct residual equality and threshold (`<= {raw['residual_threshold_wei_a']}` wei internal A): **{'PASS' if raw['mechanical_gates']['all_frozen_residuals_equal_and_within_threshold'] else 'FAIL'}**.
- 25k regression removed: **{'PASS' if next(r for r in grid if r['input_tokens'] == 25_000)['absolute_gas_saved'] > 0 else 'FAIL'}**.
- All five frozen workloads cheaper than the recompiled reference: **{'PASS' if all(r['absolute_gas_saved'] > 0 for r in grid) else 'FAIL'}**.
- Claims/reserves/backing and persistent-delta checks: enforced by the benchmark and release suite.

Canonical paired values are serialized as canonical decimal strings so every
JavaScript consumer can preserve exact uint256 precision. At 100k, user output
is `{next(r for r in grid if r['input_tokens'] == 100_000)['reference_user_output']}`
and the fixed external-recipient reward is
`{next(r for r in grid if r['input_tokens'] == 100_000)['reference_external_recipient_reward']}`.
Schema v4 also serializes every `input_wei` in the frozen grid, dense sweep and
six-path matrix as a canonical decimal string and checks it against the token
workload without crossing JavaScript's safe-integer boundary.

## Frozen grid — first call

{markdown_table(grid, [('Input', 'input_tokens'), ('Reference total', 'reference_total_gas'), ('ARBFOLD v0.1 total', 'direct_total_gas'), ('Gas saved', 'absolute_gas_saved'), ('Reduction', 'gas_reduction_percent'), ('Rounds', 'direct_rounds'), ('Tolerance (wei)', 'equivalence_tolerance_wei')])}

Percentages in the `Reduction` column are percentage values. Total gas is intrinsic + calldata + measured EVM execution.

## v0 direct path vs v0.1 direct path

{markdown_table(comparison, [('Input', 'input_tokens'), ('v0 direct', 'v0_direct'), ('v0.1 direct', 'v01_direct'), ('v0.1 - v0', 'direct_delta')])}

## Dense canonical sweep

- Range: 1k–200k, step 1k, identical snapshots.
- First actionable workload: **{sweep['first_actionable_tokens']} tokens**.
- Zero-round range(s): **{format_ranges(sweep['zero_round_ranges'])}**.
- Regression range(s): **{format_ranges(sweep['regression_ranges'])}**.
- Cheaper actionable rows: **{sweep['cheaper_actionable_rows']} / {sweep['actionable_rows']}**.

Zero-round calls are not settlement failures. They show that calling `fold()` without an actionable cycle is avoidable work; route preselection remains a separate optimization.

## Six path/direction sample

The matrix uses path-specific actionable inputs that keep every reference leg inside the published swap domain. It is supplementary evidence, not a universal gas claim.

{markdown_table(path_rows, [('Path', 'path'), ('Input', 'input'), ('Rounds', 'rounds'), ('Reference', 'reference'), ('Direct', 'direct'), ('Reduction', 'reduction')])}

## Steady-state telemetry boundary

Steady-state telemetry gas has not been measured with a cross-transaction harness and is not claimed in this release. A future measurement must establish nonzero telemetry state before the measured transaction begins, for example with two real Anvil transactions or RPC prestate applied before measurement.

## Compiler experiment

{markdown_table(compiler_rows, [('Configuration', 'name'), ('Status', 'status'), ('Reference @100k', 'reference'), ('Direct @100k', 'direct'), ('Coordinator bytes', 'coordinator')])}

The release keeps `no-ir-runs-200`: it preserves the validated compiler pipeline, stays below the EIP-170 runtime limit, and does not choose settings merely to maximize a relative percentage.

## Interpretation boundary

One `fold()` call can process multiple direct settlement rounds. At the canonical workload, the iterative reference executes two cyclic arbitrage rounds: six swaps and two profit reinjections. One ARBFOLD call applies two runtime-checked direct settlement rounds and reaches equivalent final reserves within measured tolerance while paying a fixed external-recipient reward.

This establishes an execution-gas advantage in the tested actionable workloads. It does not establish universal arbitrage detection, material LP-net uplift, ordering priority, a global defensive-rebalancing optimum, or production readiness.

## Reproduce

```bash
cd {ROOT}
python3 scripts/generate-v01-benchmark.py --check

cd contracts
forge fmt --check
forge test --offline
FOUNDRY_PROFILE=release forge test --offline
```
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="regenerate in memory, compare committed evidence and fail on drift or failed gates",
    )
    args = parser.parse_args()

    matrix = compiler_matrix()
    command = ["forge", "test", "--offline", "--match-test", REPORT_TESTS, "-vv"]
    output = run(command, env={"FOUNDRY_PROFILE": "release"})
    clean = parse_clean_rows(output)
    parsed = parse_v01_rows(output)

    frozen = merge_frozen_gas(clean, parsed)
    sweep_rows = parse_sweep_rows(output)
    path_rows = [row for row in parsed if row["kind"] == "path"]
    for row in sweep_rows:
        row["input_tokens"] = row["input_wei"] // WEI
        row["absolute_gas_saved"] = row["reference_total_gas"] - row["direct_total_gas"]
        row["gas_reduction_percent"] = reduction(row["reference_total_gas"], row["direct_total_gas"])
        row["input_wei"] = canonical_uint_decimal(row["input_wei"])
    for row in path_rows:
        finalize_row(row)

    if len(sweep_rows) != 200:
        raise RuntimeError(f"expected 200 dense sweep rows, got {len(sweep_rows)}")
    if len(path_rows) != 6:
        raise RuntimeError("incomplete six-path matrix")

    sweep_summary = derive_sweep_summary(sweep_rows)

    manifest_text, source_tree_sha256 = source_manifest()
    commands = [
        f"FOUNDRY_PROFILE=release {' '.join(command)}",
        "forge fmt --check",
        "forge test --offline",
        "FOUNDRY_PROFILE=release forge test --offline",
    ]
    paired_gates = paired_equivalence_gates(frozen)
    residual_gate = all(
        isinstance(row.get("reference_residual"), int)
        and not isinstance(row["reference_residual"], bool)
        and isinstance(row.get("direct_residual"), int)
        and not isinstance(row["direct_residual"], bool)
        and row["reference_residual"] == row["direct_residual"]
        and 0 <= row["direct_residual"] <= RESIDUAL_THRESHOLD_WEI_A
        for row in frozen
    )
    raw = {
        "schema": RAW_SCHEMA,
        "source_tree_sha256": source_tree_sha256,
        "residual_threshold_wei_a": str(RESIDUAL_THRESHOLD_WEI_A),
        "frozen_grid": frozen,
        "dense_sweep": sweep_rows,
        "dense_sweep_summary": sweep_summary,
        "six_path_matrix": path_rows,
        "compiler_matrix": matrix,
        "mechanical_gates": {
            **paired_gates,
            "all_frozen_final_reserves_within_one_wei": all(
                isinstance(row.get("equivalence_tolerance_wei"), int)
                and not isinstance(row["equivalence_tolerance_wei"], bool)
                and 0 <= row["equivalence_tolerance_wei"] <= 1
                for row in frozen
            ),
            "all_frozen_residuals_equal_and_within_threshold": residual_gate,
            "twenty_five_k_cheaper": next(row for row in frozen if row["input_tokens"] == 25_000)[
                "absolute_gas_saved"
            ]
            > 0,
            "all_five_cheaper": all(row["absolute_gas_saved"] > 0 for row in frozen),
        },
    }
    validate_generated_payload(raw)
    historical = json.loads(HISTORICAL_RAW.read_text(encoding="utf-8"))
    env = environment(source_tree_sha256, commands)
    validate_generated_environment(raw, env, source_tree_sha256)
    report = build_report(raw, historical)

    gates = raw["mechanical_gates"]
    passed = all(gates.values()) and sweep_summary["cheaper_actionable_rows"] == sweep_summary["actionable_rows"]
    if not passed:
        raise RuntimeError("v0.1 promotion gates failed")

    persist_artifacts(
        {
            OUT / "raw.json": json.dumps(raw, indent=2, sort_keys=True) + "\n",
            OUT / "environment.json": json.dumps(env, indent=2, sort_keys=True) + "\n",
            OUT / "source-manifest.sha256": manifest_text,
            OUT / "forge-output.log": reproducible_forge_log(output),
            OUT / "REPORT.md": report,
        },
        check=args.check,
    )
    print(json.dumps({"output": str(OUT), "promotion_gate": passed, "gates": gates}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
