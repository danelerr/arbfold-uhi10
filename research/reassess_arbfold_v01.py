#!/usr/bin/env python3
"""Reproduce the ARBFOLD v0.1 promotion assessment from versioned evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / "benchmark" / "optimized-release-candidate-results"
RAW = EVIDENCE / "raw.json"
ENVIRONMENT = EVIDENCE / "environment.json"
SOURCE_MANIFEST = EVIDENCE / "source-manifest.sha256"
V0_RELEASE_RAW = ROOT / "benchmark" / "release-candidate-results" / "raw.json"
V0_FROZEN_RAW = ROOT / "benchmark" / "arbfold-results" / "raw_v0.json"
RAW_SCHEMA = "arbfold-v0.1-optimized-release-candidate-v4"
REASSESSMENT_SCHEMA = "arbfold-v0.1-thesis-reassessment-v4"
ENVIRONMENT_SCHEMA = "arbfold-v0.1-environment-v4"
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
FROZEN_INPUTS = [10_000, 25_000, 50_000, 100_000, 200_000]
PATH_LABELS = {
    0: "ARFY -> ARFX (internal A -> B)",
    1: "ARFX -> ARFY (internal B -> A)",
    2: "ARFX -> ARFZ (internal B -> C)",
    3: "ARFZ -> ARFX (internal C -> B)",
    4: "ARFY -> ARFZ (internal A -> C)",
    5: "ARFZ -> ARFY (internal C -> A)",
}
SIX_PATH_INPUTS = [2, 5_000, 5_000, 5_000, 2, 5_000]
PAIRED_FIELDS = (
    "reference_user_output",
    "direct_user_output",
    "reference_external_recipient_reward",
    "direct_external_recipient_reward",
)
CANONICAL_UINT_DECIMAL = re.compile(r"^(0|[1-9][0-9]*)$")
MAX_UINT256 = 2**256 - 1
MAX_UINT256_DECIMAL = str(MAX_UINT256)
MAX_SAFE_INTEGER = 2**53 - 1
SHA256_HEX = re.compile(r"^[0-9a-f]{64}$")
WEI = 10**18
INTRINSIC_GAS = 21_000
RESIDUAL_THRESHOLD_WEI_A = 10**12
RESERVE_FIELDS = ("ab_a", "ab_b", "bc_b", "bc_c", "ac_a", "ac_c")
RECOMPUTED_GATES = (
    "all_frozen_outputs_equal",
    "all_frozen_rewards_equal",
    "all_frozen_residuals_equal_and_within_threshold",
    "all_frozen_final_reserves_within_one_wei",
    "twenty_five_k_cheaper",
    "all_five_cheaper",
)
REVIEWED_DENSE_SUMMARY = {
    "first_actionable_tokens": 5_000,
    "actionable_rows": 196,
    "cheaper_actionable_rows": 196,
    "zero_round_ranges": [{"start_tokens": 1_000, "end_tokens": 4_000}],
    "regression_ranges": [{"start_tokens": 1_000, "end_tokens": 4_000}],
    "round_regions": {
        "0": [{"start_tokens": 1_000, "end_tokens": 4_000}],
        "1": [{"start_tokens": 5_000, "end_tokens": 36_000}],
        "2": [{"start_tokens": 37_000, "end_tokens": 200_000}],
    },
}
BYTECODE_FIELDS = {"coordinator", "hook", "router", "reference_router"}
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
REVIEWED_COMPILER_MATRIX = (
    {
        "name": "no-ir-runs-200",
        "status": "measured",
        "via_ir": False,
        "optimizer_runs": 200,
        "reference": 544_219,
        "direct": 375_171,
        "bytecode": {
            "coordinator": 10_058,
            "hook": 14_728,
            "router": 4_489,
            "reference_router": 6_982,
        },
    },
    {
        "name": "no-ir-runs-1000",
        "status": "measured",
        "via_ir": False,
        "optimizer_runs": 1_000,
        "reference": 539_032,
        "direct": 373_059,
        "bytecode": {
            "coordinator": 10_703,
            "hook": 15_624,
            "router": 4_910,
            "reference_router": 7_422,
        },
    },
    {
        "name": "via-ir-runs-200",
        "status": "measured",
        "via_ir": True,
        "optimizer_runs": 200,
        "reference": 523_349,
        "direct": 373_253,
        "bytecode": {
            "coordinator": 8_686,
            "hook": 11_236,
            "router": 3_218,
            "reference_router": 5_664,
        },
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


def is_canonical_uint_decimal(value: Any) -> bool:
    if not isinstance(value, str) or CANONICAL_UINT_DECIMAL.fullmatch(value) is None:
        return False
    return len(value) < len(MAX_UINT256_DECIMAL) or (
        len(value) == len(MAX_UINT256_DECIMAL) and value <= MAX_UINT256_DECIMAL
    )


def reduction_percent(reference: int, direct: int) -> str:
    if reference <= 0 or direct < 0:
        raise ValueError("gas totals must use a positive reference and non-negative direct value")
    delta = reference - direct
    negative = delta < 0
    quotient, remainder = divmod(abs(delta) * 100 * 1_000_000, reference)
    if remainder * 2 > reference or (remainder * 2 == reference and quotient % 2 == 1):
        quotient += 1
    whole, fraction = divmod(quotient, 1_000_000)
    return f"{'-' if negative else ''}{whole}.{fraction:06d}"


def _is_nonnegative_int(value: Any) -> bool:
    return not isinstance(value, bool) and isinstance(value, int) and value >= 0


def _is_positive_int(value: Any) -> bool:
    return not isinstance(value, bool) and isinstance(value, int) and value > 0


def _validate_exact_fields(value: Any, expected: set[str], detail: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{detail} is not an object")
    if set(value) != expected:
        raise ValueError(f"{detail} has an invalid field set")
    return value


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected an object: {path}")
    return value


def _validate_input_identity(row: dict[str, Any], index: int, section: str) -> None:
    input_tokens = row.get("input_tokens")
    input_wei = row.get("input_wei")
    if not _is_positive_int(input_tokens):
        raise ValueError(f"{section} row {index} has invalid input_tokens")
    if not is_canonical_uint_decimal(input_wei):
        raise ValueError(f"{section} row {index} has invalid input_wei")
    if int(input_wei) != input_tokens * WEI:
        raise ValueError(f"{section} row {index} input_wei contradicts input_tokens")


def _validate_gas_arithmetic(
    row: dict[str, Any], index: int, section: str, *, decomposed: bool
) -> None:
    if not _is_positive_int(row.get("reference_total_gas")):
        raise ValueError(f"{section} row {index} has invalid reference_total_gas")
    if not _is_nonnegative_int(row.get("direct_total_gas")):
        raise ValueError(f"{section} row {index} has invalid direct_total_gas")
    if isinstance(row.get("absolute_gas_saved"), bool) or not isinstance(
        row.get("absolute_gas_saved"), int
    ):
        raise ValueError(f"{section} row {index} has invalid absolute_gas_saved")
    if decomposed:
        for field in (
            "reference_execution_gas",
            "direct_execution_gas",
            "reference_calldata_gas",
            "direct_calldata_gas",
            "direct_to_reference_bps",
        ):
            if not _is_nonnegative_int(row.get(field)):
                raise ValueError(f"{section} row {index} has invalid {field}")
        if row["reference_total_gas"] != (
            INTRINSIC_GAS + row["reference_execution_gas"] + row["reference_calldata_gas"]
        ):
            raise ValueError(f"{section} row {index} has incoherent reference_total_gas")
        if row["direct_total_gas"] != (
            INTRINSIC_GAS + row["direct_execution_gas"] + row["direct_calldata_gas"]
        ):
            raise ValueError(f"{section} row {index} has incoherent direct_total_gas")
        expected_bps = row["direct_total_gas"] * 10_000 // row["reference_total_gas"]
        if row["direct_to_reference_bps"] != expected_bps:
            raise ValueError(f"{section} row {index} has incoherent direct_to_reference_bps")
    if row["absolute_gas_saved"] != row["reference_total_gas"] - row["direct_total_gas"]:
        raise ValueError(f"{section} row {index} has incoherent absolute_gas_saved")
    if row.get("gas_reduction_percent") != reduction_percent(
        row["reference_total_gas"], row["direct_total_gas"]
    ):
        raise ValueError(f"{section} row {index} has incoherent gas_reduction_percent")


def _validate_full_row(
    row: dict[str, Any],
    index: int,
    section: str,
    *,
    expected_kind: str,
    expected_path: int,
    residual_threshold: int,
) -> int:
    if not isinstance(row, dict):
        raise ValueError(f"{section} row {index} is not an object")
    if row.get("kind") != expected_kind:
        raise ValueError(f"{section} row {index} has invalid kind")
    if row.get("path") != expected_path:
        raise ValueError(f"{section} row {index} has unexpected path")
    if row.get("path_label") != PATH_LABELS[expected_path]:
        raise ValueError(f"{section} row {index} has non-canonical path_label")
    _validate_input_identity(row, index, section)

    for field in (
        "reference_rounds",
        "direct_rounds",
        "reference_arbitrage_swaps",
        "reference_reinjections",
        "direct_fold_calls",
        "reference_residual",
        "direct_residual",
        "equivalence_tolerance_wei",
    ):
        if not _is_nonnegative_int(row.get(field)):
            raise ValueError(f"{section} row {index} has invalid {field}")
    rounds = row["reference_rounds"]
    if rounds <= 0:
        raise ValueError(f"{section} row {index} must contain an actionable reference round")
    if row["reference_arbitrage_swaps"] != 3 * rounds:
        raise ValueError(f"{section} row {index} has incoherent reference_arbitrage_swaps")
    if row["reference_reinjections"] != rounds:
        raise ValueError(f"{section} row {index} has incoherent reference_reinjections")
    if row["direct_rounds"] != rounds:
        raise ValueError(f"{section} row {index} has incoherent direct_rounds")
    if row["direct_fold_calls"] != 1:
        raise ValueError(f"{section} row {index} must contain exactly one direct fold call")

    _validate_gas_arithmetic(row, index, section, decomposed=True)
    for field in PAIRED_FIELDS:
        if not is_canonical_uint_decimal(row.get(field)):
            raise ValueError(f"{section} row {index} has invalid {field}")
    if row["reference_user_output"] != row["direct_user_output"]:
        raise ValueError(f"{section} row {index} has unequal user output")
    if row["reference_external_recipient_reward"] != row["direct_external_recipient_reward"]:
        raise ValueError(f"{section} row {index} has unequal fixed external-recipient reward")

    if row["reference_residual"] != row["direct_residual"]:
        raise ValueError(f"{section} row {index} has unequal reference/direct residual")
    if row["direct_residual"] > residual_threshold:
        raise ValueError(f"{section} row {index} residual exceeds the published threshold")

    reference_reserves = row.get("reference_final_reserves")
    direct_reserves = row.get("direct_final_reserves")
    if not isinstance(reference_reserves, dict) or not isinstance(direct_reserves, dict):
        raise ValueError(f"{section} row {index} has missing final reserves")
    if set(reference_reserves) != set(RESERVE_FIELDS) or set(direct_reserves) != set(
        RESERVE_FIELDS
    ):
        raise ValueError(f"{section} row {index} has incomplete reserve fields")
    for field in RESERVE_FIELDS:
        if not _is_nonnegative_int(reference_reserves.get(field)) or not _is_nonnegative_int(
            direct_reserves.get(field)
        ):
            raise ValueError(f"{section} row {index} has invalid reserve {field}")
    max_delta = max(
        abs(reference_reserves[field] - direct_reserves[field]) for field in RESERVE_FIELDS
    )
    if row["equivalence_tolerance_wei"] != max_delta:
        raise ValueError(f"{section} row {index} equivalence tolerance contradicts reserves")
    if max_delta > 1:
        raise ValueError(f"{section} row {index} exceeds one-wei reserve tolerance")
    return max_delta


def recompute_paired_gates(grid: list[dict[str, Any]]) -> dict[str, bool]:
    if not grid:
        raise ValueError("paired evidence requires at least one row")
    for row in grid:
        for field in PAIRED_FIELDS:
            if not is_canonical_uint_decimal(row.get(field)):
                raise ValueError(f"invalid canonical decimal field {field}: {row.get(field)!r}")
    return {
        "all_frozen_outputs_equal": all(
            row["reference_user_output"] == row["direct_user_output"] for row in grid
        ),
        "all_frozen_rewards_equal": all(
            row["reference_external_recipient_reward"]
            == row["direct_external_recipient_reward"]
            for row in grid
        ),
    }


def validate_frozen_grid_semantics(
    grid: list[dict[str, Any]],
    gates: dict[str, Any],
    residual_threshold: int = RESIDUAL_THRESHOLD_WEI_A,
) -> dict[str, bool]:
    if not isinstance(grid, list) or [row.get("input_tokens") for row in grid] != FROZEN_INPUTS:
        raise ValueError("frozen grid inputs are missing, additional, or out of order")
    reserve_deltas = [
        _validate_full_row(
            row,
            index,
            "frozen_grid",
            expected_kind="grid",
            expected_path=1,
            residual_threshold=residual_threshold,
        )
        for index, row in enumerate(grid)
    ]
    canonical = grid[3]
    topology = (
        canonical["reference_rounds"],
        canonical["reference_arbitrage_swaps"],
        canonical["reference_reinjections"],
        canonical["direct_rounds"],
        canonical["direct_fold_calls"],
    )
    if topology != (2, 6, 2, 2, 1):
        raise ValueError("canonical 100k row contradicts the reviewed topology")
    if canonical["reference_residual"] != 0 or canonical["direct_residual"] != 0:
        raise ValueError("canonical 100k residual must be zero")

    derived = {
        **recompute_paired_gates(grid),
        "all_frozen_residuals_equal_and_within_threshold": all(
            row["reference_residual"] == row["direct_residual"]
            and row["direct_residual"] <= residual_threshold
            for row in grid
        ),
        "all_frozen_final_reserves_within_one_wei": all(delta <= 1 for delta in reserve_deltas),
        "twenty_five_k_cheaper": grid[1]["absolute_gas_saved"] > 0,
        "all_five_cheaper": all(row["absolute_gas_saved"] > 0 for row in grid),
    }
    if not isinstance(gates, dict) or set(gates) != set(RECOMPUTED_GATES):
        raise ValueError("mechanical gates do not match the reviewed gate set")
    for name in RECOMPUTED_GATES:
        if derived[name] is not True:
            raise ValueError(f"derived gate does not hold: {name}")
        if gates.get(name) is not derived[name]:
            raise ValueError(f"published gate contradicts frozen grid: {name}")
    return derived


def _contiguous_ranges(values: list[int], step: int = 1_000) -> list[dict[str, int]]:
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


def derive_dense_sweep_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    if not isinstance(rows, list) or len(rows) != 200:
        raise ValueError("dense_sweep must contain exactly 200 rows")
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            raise ValueError(f"dense_sweep row {index} is not an object")
        _validate_input_identity(row, index, "dense_sweep")
        if row["input_tokens"] != (index + 1) * 1_000:
            raise ValueError(f"dense_sweep row {index} breaks the ordered 1k grid")
        if not _is_nonnegative_int(row.get("direct_rounds")) or row["direct_rounds"] > 2:
            raise ValueError(f"dense_sweep row {index} has invalid direct_rounds")
        _validate_gas_arithmetic(row, index, "dense_sweep", decomposed=False)

    actionable = [row for row in rows if row["direct_rounds"] > 0]
    zero_round_tokens = [row["input_tokens"] for row in rows if row["direct_rounds"] == 0]
    regression_tokens = [row["input_tokens"] for row in rows if row["absolute_gas_saved"] < 0]
    summary = {
        "first_actionable_tokens": actionable[0]["input_tokens"] if actionable else None,
        "actionable_rows": len(actionable),
        "cheaper_actionable_rows": sum(row["absolute_gas_saved"] > 0 for row in actionable),
        "zero_round_ranges": _contiguous_ranges(zero_round_tokens),
        "regression_ranges": _contiguous_ranges(regression_tokens),
        "round_regions": {
            str(rounds): _contiguous_ranges(
                [row["input_tokens"] for row in rows if row["direct_rounds"] == rounds]
            )
            for rounds in sorted({row["direct_rounds"] for row in rows})
        },
    }
    if summary != REVIEWED_DENSE_SUMMARY:
        raise ValueError("dense_sweep contradicts the reviewed canonical sweep boundary")
    return summary


def validate_six_path_matrix(
    rows: list[dict[str, Any]], residual_threshold: int = RESIDUAL_THRESHOLD_WEI_A
) -> list[int]:
    if not isinstance(rows, list) or len(rows) != 6:
        raise ValueError("six_path_matrix must contain exactly six rows")
    for index, row in enumerate(rows):
        _validate_full_row(
            row,
            index,
            "six_path_matrix",
            expected_kind="path",
            expected_path=index,
            residual_threshold=residual_threshold,
        )
        if row["input_tokens"] != SIX_PATH_INPUTS[index]:
            raise ValueError(f"six_path_matrix row {index} has unexpected input_tokens")
    return [row["path"] for row in rows]


def validate_compiler_matrix(raw: dict[str, Any]) -> list[str]:
    rows = raw.get("compiler_matrix")
    if not isinstance(rows, list) or len(rows) != len(REVIEWED_COMPILER_MATRIX):
        raise ValueError("compiler_matrix must contain exactly four configurations")
    for index, (row, reviewed) in enumerate(zip(rows, REVIEWED_COMPILER_MATRIX)):
        expected_fields = (
            MEASURED_COMPILER_FIELDS
            if reviewed["status"] == "measured"
            else FAILED_COMPILER_FIELDS
        )
        row = _validate_exact_fields(row, expected_fields, f"compiler_matrix row {index}")
        for field in ("name", "status", "via_ir", "optimizer_runs"):
            if row.get(field) != reviewed[field]:
                raise ValueError(
                    f"compiler_matrix row {index} has an unexpected configuration"
                )
        if row["status"] == "measured":
            reference = row.get("canonical_reference_total_gas")
            direct = row.get("canonical_direct_total_gas")
            if (
                not _is_positive_int(reference)
                or not _is_positive_int(direct)
                or reference > MAX_SAFE_INTEGER
                or direct > MAX_SAFE_INTEGER
            ):
                raise ValueError(f"compiler_matrix row {index} has invalid gas values")
            if row.get("canonical_gas_reduction_percent") != reduction_percent(
                reference, direct
            ):
                raise ValueError(
                    f"compiler_matrix row {index} has incoherent gas reduction percentage"
                )
            if reference != reviewed["reference"] or direct != reviewed["direct"]:
                raise ValueError(
                    f"compiler_matrix row {index} contradicts the frozen compiler experiment"
                )
            bytecode = _validate_exact_fields(
                row.get("deployed_bytecode_bytes"),
                BYTECODE_FIELDS,
                f"compiler_matrix row {index} deployed_bytecode_bytes",
            )
            for field in BYTECODE_FIELDS:
                size = bytecode.get(field)
                if not _is_positive_int(size) or size > 24_576:
                    raise ValueError(
                        f"compiler_matrix row {index} has invalid {field} bytecode size"
                    )
                if size != reviewed["bytecode"][field]:
                    raise ValueError(
                        f"compiler_matrix row {index} contradicts the frozen bytecode measurement"
                    )
            continue

        error = row.get("error")
        error_sha256 = row.get("error_sha256")
        if not isinstance(error, str) or not error:
            raise ValueError(f"compiler_matrix row {index} has an invalid compile error")
        if not isinstance(error_sha256, str) or SHA256_HEX.fullmatch(error_sha256) is None:
            raise ValueError(f"compiler_matrix row {index} has an invalid error_sha256")
        if hashlib.sha256(error.encode()).hexdigest() != error_sha256:
            raise ValueError(
                f"compiler_matrix row {index} error_sha256 contradicts its error text"
            )
        if error != reviewed["error"] or error_sha256 != reviewed["error_sha256"]:
            raise ValueError(
                f"compiler_matrix row {index} contradicts the frozen compile failure"
            )

    canonical = raw["frozen_grid"][3]
    selected = rows[0]
    if (
        selected["canonical_reference_total_gas"] != canonical["reference_total_gas"]
        or selected["canonical_direct_total_gas"] != canonical["direct_total_gas"]
        or selected["canonical_gas_reduction_percent"]
        != canonical["gas_reduction_percent"]
    ):
        raise ValueError(
            "selected compiler configuration contradicts the canonical 100k frozen row"
        )
    return [row["name"] for row in rows]


def validate_payload_semantics(raw: dict[str, Any]) -> dict[str, Any]:
    if raw.get("schema") != RAW_SCHEMA:
        raise ValueError(f"raw schema must be {RAW_SCHEMA}")
    if "rows" in raw or "storage_transition_matrix" in raw:
        raise ValueError("legacy rows or steady-state evidence is not accepted")
    if set(raw) != TOP_LEVEL_FIELDS:
        raise ValueError("raw payload does not match the exact schema v4 top-level field set")
    source_digest = raw.get("source_tree_sha256")
    if not isinstance(source_digest, str) or SHA256_HEX.fullmatch(source_digest) is None:
        raise ValueError("source_tree_sha256 must be a lowercase 64-character SHA-256 digest")
    threshold = raw.get("residual_threshold_wei_a")
    if not is_canonical_uint_decimal(threshold) or int(threshold) != RESIDUAL_THRESHOLD_WEI_A:
        raise ValueError("residual_threshold_wei_a contradicts the reviewed policy")

    gates = validate_frozen_grid_semantics(raw.get("frozen_grid"), raw.get("mechanical_gates"), int(threshold))
    dense_summary = derive_dense_sweep_summary(raw.get("dense_sweep"))
    if raw.get("dense_sweep_summary") != dense_summary:
        raise ValueError("dense_sweep_summary contradicts the 200 measured rows")
    paths = validate_six_path_matrix(raw.get("six_path_matrix"), int(threshold))
    compiler_configurations = validate_compiler_matrix(raw)
    return {
        "recomputed_publication_gates": gates,
        "derived_dense_sweep_summary": dense_summary,
        "validated_paths": paths,
        "validated_compiler_configurations": compiler_configurations,
        "residual_threshold_wei_a": int(threshold),
    }


def verify_source_manifest(raw: dict[str, Any], environment: dict[str, Any]) -> dict[str, Any]:
    text = SOURCE_MANIFEST.read_text(encoding="utf-8")
    mismatches: list[str] = []
    seen: set[str] = set()
    observed_paths: list[str] = []
    entries = 0
    if not text.endswith("\n"):
        raise ValueError("source manifest must end with one newline")
    for index, line in enumerate(text[:-1].split("\n"), start=1):
        match = re.fullmatch(r"([0-9a-f]{64})  (.+)", line)
        if match is None:
            raise ValueError(f"source manifest line {index} is malformed")
        digest, relative = match.groups()
        relative_path = Path(relative)
        if relative_path.is_absolute() or "\\" in relative:
            raise ValueError(f"source manifest line {index} has an unsafe path")
        path = (ROOT / relative_path).resolve()
        try:
            path.relative_to(ROOT.resolve())
        except ValueError as error:
            raise ValueError(f"source manifest line {index} escapes the repository") from error
        if relative in seen:
            raise ValueError(f"source manifest duplicates {relative}")
        seen.add(relative)
        observed_paths.append(relative)
        entries += 1
        if not path.is_file() or sha256(path) != digest:
            mismatches.append(relative)
    expected_paths = sorted(
        [
            *(path.relative_to(ROOT).as_posix() for path in (ROOT / "contracts/src").glob("*.sol")),
            *(path.relative_to(ROOT).as_posix() for path in (ROOT / "contracts/test").glob("*.sol")),
            "contracts/foundry.toml",
            "scripts/generate-v01-benchmark.py",
        ]
    )
    if observed_paths != expected_paths:
        raise ValueError("source manifest path set does not match the optimized-v0.1 scope")
    tree_digest = hashlib.sha256(text.encode()).hexdigest()
    raw_digest = raw.get("source_tree_sha256")
    environment_digest = environment.get("source_tree_sha256")
    if not isinstance(raw_digest, str) or SHA256_HEX.fullmatch(raw_digest) is None:
        raise ValueError("raw source_tree_sha256 is missing or malformed")
    if not isinstance(environment_digest, str) or SHA256_HEX.fullmatch(environment_digest) is None:
        raise ValueError("environment source_tree_sha256 is missing or malformed")
    if raw_digest != tree_digest or environment_digest != tree_digest:
        raise ValueError("raw/environment source_tree_sha256 does not match the source manifest")
    if mismatches:
        raise ValueError(
            "source manifest does not match the current worktree: " + ", ".join(mismatches)
        )

    if environment.get("schema") != ENVIRONMENT_SCHEMA:
        raise ValueError(f"environment schema must be {ENVIRONMENT_SCHEMA}")
    selected = raw["compiler_matrix"][0]
    if (
        environment.get("selected_compiler_configuration") != selected["name"]
        or environment.get("optimizer_enabled") is not True
        or environment.get("optimizer_runs") != selected["optimizer_runs"]
        or environment.get("via_ir") is not selected["via_ir"]
    ):
        raise ValueError(
            "environment selected compiler configuration contradicts compiler_matrix"
        )
    if environment.get("residual_threshold_wei_a") != raw["residual_threshold_wei_a"]:
        raise ValueError("environment residual threshold contradicts the raw payload")
    checks = {
        "all_manifest_entries_match_worktree": True,
        "raw_tree_digest_matches_manifest": True,
        "environment_tree_digest_matches_manifest": True,
        "environment_selected_compiler_matches_matrix": True,
    }
    return {
        "checks": checks,
        "entries": entries,
        "mismatches": mismatches,
        "source_tree_sha256": tree_digest,
        "manifest_sha256": sha256(SOURCE_MANIFEST),
    }


def build_result() -> dict[str, Any]:
    raw = load_json(RAW)
    environment = load_json(ENVIRONMENT)
    semantics = validate_payload_semantics(raw)
    source = verify_source_manifest(raw, environment)
    grid = raw["frozen_grid"]
    canonical = grid[3]
    checks = {
        "raw_schema_is_v4": raw["schema"] == RAW_SCHEMA,
        "source_manifest_is_current": all(source["checks"].values()),
        "frozen_grid_is_unchanged": [row["input_tokens"] for row in grid] == FROZEN_INPUTS,
        "input_identity_is_lossless": all(
            int(row["input_wei"]) == row["input_tokens"] * WEI
            for section in (raw["frozen_grid"], raw["dense_sweep"], raw["six_path_matrix"])
            for row in section
        ),
        "all_publication_gates_recompute_from_raw": semantics["recomputed_publication_gates"]
        == raw["mechanical_gates"],
        "canonical_uint256_values_are_exact": canonical["reference_user_output"]
        == canonical["direct_user_output"]
        == "30220363129338304386"
        and canonical["reference_external_recipient_reward"]
        == canonical["direct_external_recipient_reward"]
        == "85849039116169484",
        "canonical_topology_is_2_6_2_vs_2_1": (
            canonical["reference_rounds"],
            canonical["reference_arbitrage_swaps"],
            canonical["reference_reinjections"],
            canonical["direct_rounds"],
            canonical["direct_fold_calls"],
        )
        == (2, 6, 2, 2, 1),
        "canonical_residual_is_zero": canonical["direct_residual"] == 0,
        "dense_sweep_summary_is_derived": semantics["derived_dense_sweep_summary"]
        == raw["dense_sweep_summary"],
        "dense_sweep_has_200_rows": len(raw["dense_sweep"]) == 200,
        "all_actionable_dense_rows_are_cheaper": semantics["derived_dense_sweep_summary"][
            "actionable_rows"
        ]
        == semantics["derived_dense_sweep_summary"]["cheaper_actionable_rows"]
        == 196,
        "zero_round_region_is_1k_through_4k": semantics["derived_dense_sweep_summary"][
            "zero_round_ranges"
        ]
        == [{"start_tokens": 1_000, "end_tokens": 4_000}],
        "six_path_matrix_is_complete_and_unique": semantics["validated_paths"]
        == [0, 1, 2, 3, 4, 5],
        "compiler_matrix_is_complete_and_source_bound": semantics[
            "validated_compiler_configurations"
        ]
        == [
            "no-ir-runs-200",
            "no-ir-runs-1000",
            "via-ir-runs-200",
            "via-ir-runs-1000",
        ],
        "steady_state_telemetry_measurement_is_absent": "storage_transition_matrix" not in raw,
    }
    if not all(checks.values()):
        failed = ", ".join(name for name, passed in checks.items() if not passed)
        raise RuntimeError(f"v0.1 assessment failed: {failed}")

    return {
        "schema": REASSESSMENT_SCHEMA,
        "analysis_date": "2026-08-30",
        "scope": "optimized v0.1 coordinator, frozen five-point grid, dense canonical sweep, and supplemental six-path measurements",
        "artifact_verification": {
            "checks": checks,
            "source_manifest": source,
            "recomputed_publication_gates": semantics["recomputed_publication_gates"],
            "derived_dense_sweep_summary": semantics["derived_dense_sweep_summary"],
            "validated_paths": semantics["validated_paths"],
            "validated_compiler_configurations": semantics[
                "validated_compiler_configurations"
            ],
            "residual_threshold_wei_a": semantics["residual_threshold_wei_a"],
            "digests": {
                "optimized_raw_sha256": sha256(RAW),
                "optimized_environment_sha256": sha256(ENVIRONMENT),
                "historical_v0_release_raw_sha256": sha256(V0_RELEASE_RAW),
                "historical_v0_frozen_raw_sha256": sha256(V0_FROZEN_RAW),
            },
        },
        "decision_ledger": {
            "v0_1_promotion_gate": "pass",
            "mechanical_equivalence_fixed_grid": "supported",
            "execution_gas_advantage_tested_actionable_workloads": "supported",
            "execution_efficiency_universal": "not_supported_zero_round_calls_are_more_expensive",
            "steady_state_telemetry_gas": "not_measured_without_cross_transaction_harness",
            "ten_percent_lp_net_uplift": "remains_falsified_by_v0_experiment",
            "production_readiness": "not_established",
            "v0_1_public_deployment": "not_performed",
        },
        "canonical": {
            "input_tokens": canonical["input_tokens"],
            "input_wei": canonical["input_wei"],
            "reference_total_gas": canonical["reference_total_gas"],
            "direct_total_gas": canonical["direct_total_gas"],
            "gas_saved": canonical["absolute_gas_saved"],
            "gas_reduction_percent": canonical["gas_reduction_percent"],
            "reference_rounds": canonical["reference_rounds"],
            "direct_rounds": canonical["direct_rounds"],
            "direct_fold_calls": canonical["direct_fold_calls"],
            "reference_arbitrage_swaps": canonical["reference_arbitrage_swaps"],
            "reference_reinjections": canonical["reference_reinjections"],
            "equivalence_tolerance_wei": canonical["equivalence_tolerance_wei"],
            "reference_user_output": canonical["reference_user_output"],
            "direct_user_output": canonical["direct_user_output"],
            "reference_external_recipient_reward": canonical[
                "reference_external_recipient_reward"
            ],
            "direct_external_recipient_reward": canonical["direct_external_recipient_reward"],
            "residual_wei_a": canonical["direct_residual"],
        },
        "dense_sweep": {
            "rows": len(raw["dense_sweep"]),
            **semantics["derived_dense_sweep_summary"],
        },
        "six_path_matrix": {
            "rows": len(raw["six_path_matrix"]),
            "paths": semantics["validated_paths"],
        },
        "frozen_grid": [
            {
                "input_tokens": row["input_tokens"],
                "input_wei": row["input_wei"],
                "reference_total_gas": row["reference_total_gas"],
                "direct_total_gas": row["direct_total_gas"],
                "gas_saved": row["absolute_gas_saved"],
                "gas_reduction_percent": row["gas_reduction_percent"],
                "direct_rounds": row["direct_rounds"],
                "equivalence_tolerance_wei": row["equivalence_tolerance_wei"],
                "reference_user_output": row["reference_user_output"],
                "direct_user_output": row["direct_user_output"],
                "reference_external_recipient_reward": row[
                    "reference_external_recipient_reward"
                ],
                "direct_external_recipient_reward": row[
                    "direct_external_recipient_reward"
                ],
            }
            for row in grid
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", type=Path)
    parser.add_argument("--check", type=Path)
    args = parser.parse_args()
    result = build_result()
    rendered = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.write:
        target = args.write if args.write.is_absolute() else ROOT / args.write
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(rendered, encoding="utf-8")
    if args.check:
        target = args.check if args.check.is_absolute() else ROOT / args.check
        if target.read_text(encoding="utf-8") != rendered:
            raise SystemExit(f"reassessment differs from {target}")
    if not args.write and not args.check:
        print(rendered, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
