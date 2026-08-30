#!/usr/bin/env python3
"""Reproduce the quantitative part of the ARBFOLD thesis reassessment.

The script intentionally consumes only frozen repository artifacts and the
delivered Solidity source tree. It does not query a chain, mutate benchmark
inputs, or modify Solidity. Its output is deterministic for a fixed checkout.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from decimal import Decimal, getcontext
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from arbfold_sim.arithmetic_differential import (
    RESIDUAL_THRESHOLD,
    fold,
    networks,
)


getcontext().prec = 60

FREEZE = ROOT / "benchmark" / "arbfold_freeze_v0.json"
V0_RAW = ROOT / "benchmark" / "arbfold-results" / "raw_v0.json"
V0_DECISION = ROOT / "benchmark" / "arbfold-results" / "decision_v0.json"
RELEASE_RAW = ROOT / "benchmark" / "release-candidate-results" / "raw.json"
RELEASE_MANIFEST = ROOT / "benchmark" / "release-candidate-results" / "source-manifest.sha256"
ARITHMETIC = ROOT / "benchmark" / "arithmetic-differential-v1.json"

WEI = Decimal(10**18)
GWEI_IN_ETH = Decimal(10**9)
OPERATING_MULTIPLIER = Decimal("1.20")
TARGET_LP_RATIO = Decimal("1.10")
GAS_PRICES_GWEI = tuple(Decimal(v) for v in ("0.001", "0.01", "0.1", "1", "10", "100", "300"))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"expected a JSON object: {path}")
    return value


def decimal_string(value: Decimal) -> str:
    return format(value, "f")


def source_manifest_at_commit(commit: str) -> str:
    paths = subprocess.check_output(
        ["git", "ls-tree", "-r", "--name-only", commit, "contracts/src"],
        cwd=ROOT,
        text=True,
    ).splitlines()
    entries: list[str] = []
    for relative in sorted(path for path in paths if path.endswith(".sol")):
        payload = subprocess.check_output(["git", "show", f"{commit}:{relative}"], cwd=ROOT)
        entries.append(f"{hashlib.sha256(payload).hexdigest()}  {relative}")
    payload = ("\n".join(entries) + "\n").encode()
    tree_digest = hashlib.sha256(payload).hexdigest()
    return "\n".join([f"TREE_SHA256  {tree_digest}", *entries]) + "\n"


def verify_artifacts(
    freeze: dict[str, Any],
    v0_raw: dict[str, Any],
    decision: dict[str, Any],
    release: dict[str, Any],
) -> dict[str, Any]:
    freeze_digest = sha256(FREEZE)
    v0_digest = sha256(V0_RAW)
    expected_manifest = RELEASE_MANIFEST.read_text(encoding="utf-8")
    actual_manifest = source_manifest_at_commit(release["tested_commit"])
    manifest_tree = actual_manifest.splitlines()[0].split()[1]

    checks = {
        "freeze_digest_matches_v0_raw": freeze_digest == v0_raw["freeze_sha256"],
        "freeze_digest_matches_decision": freeze_digest == decision["freeze_sha256"],
        "v0_raw_digest_matches_decision": v0_digest == decision["raw_results_sha256"],
        "delivered_sources_match_release_manifest": actual_manifest == expected_manifest,
        "release_tree_digest_matches_manifest": release["tested_source_tree_sha256"] == manifest_tree,
        "release_mechanical_checks_all_true": all(release["mechanical_tests"].values()),
        "v0_decision_is_kill": decision["decision"] == "KILL_ARBFOLD",
    }
    if not all(checks.values()):
        failed = ", ".join(name for name, passed in checks.items() if not passed)
        raise RuntimeError(f"artifact verification failed: {failed}")

    return {
        "checks": checks,
        "digests": {
            "freeze_v0_sha256": freeze_digest,
            "v0_raw_sha256": v0_digest,
            "v0_decision_sha256": sha256(V0_DECISION),
            "release_raw_sha256": sha256(RELEASE_RAW),
            "release_source_manifest_sha256": sha256(RELEASE_MANIFEST),
            "arithmetic_differential_sha256": sha256(ARITHMETIC),
            "delivered_source_tree_sha256": manifest_tree,
        },
    }


def release_grid(release: dict[str, Any], v0_raw: dict[str, Any]) -> list[dict[str, Any]]:
    v0_by_input = {row["origin_input_wei"]: row for row in v0_raw["rows"]}
    rows: list[dict[str, Any]] = []
    for release_row in release["rows"]:
        v0_row = v0_by_input[release_row["origin_input_wei"]]
        backrun = int(release_row["backrun_total_gas"])
        direct = int(release_row["direct_total_gas"])
        rows.append(
            {
                "origin_input_wei": release_row["origin_input_wei"],
                "backrun_total_gas": backrun,
                "direct_total_gas": direct,
                "gas_saved": backrun - direct,
                "direct_over_backrun": decimal_string(Decimal(direct) / Decimal(backrun)),
                "gas_reduction_percent": decimal_string(
                    (Decimal(backrun - direct) / Decimal(backrun)) * Decimal(100)
                ),
                "direct_is_cheaper": direct < backrun,
                # The release benchmark omitted these telemetry fields. They
                # are joined from v0 because both artifacts use the same frozen
                # state, input grid, CycleMath and reward policy.
                "fold_rounds_from_v0_same_state": v0_row["rounds"],
                "residual_wei_a_from_v0_same_state": v0_row["residual_wei_weth"],
                "gross_surplus_wei_a_from_v0_same_state": v0_row["gross_surplus_wei_weth"],
            }
        )
    return rows


def economics(release: dict[str, Any], v0_raw: dict[str, Any]) -> dict[str, Any]:
    canonical_input = release["canonical"]["origin_input_wei"]
    v0_canonical = next(row for row in v0_raw["rows"] if row["origin_input_wei"] == canonical_input)

    gross = Decimal(v0_canonical["gross_surplus_wei_weth"]) / WEI
    fixed_reward = Decimal(release["canonical"]["solver_reward_a"]) / WEI
    backrun_gas = Decimal(release["canonical"]["backrun_total_gas"])
    direct_gas = Decimal(release["canonical"]["direct_total_gas"])
    ratio = direct_gas / backrun_gas

    # If the minimum reward were gas-indexed, and the *entire* transaction gas
    # were charged to cyclic surplus, this is an upper-bound sensitivity for
    # LP uplift. The actual v0 contract instead pays the same fixed 10% reward
    # in both paths, so it does not pass gas savings through to LPs.
    sensitivities: list[dict[str, Any]] = []
    for gas_price in GAS_PRICES_GWEI:
        backrun_cost = OPERATING_MULTIPLIER * backrun_gas * gas_price / GWEI_IN_ETH
        direct_cost = OPERATING_MULTIPLIER * direct_gas * gas_price / GWEI_IN_ETH
        backrun_lp = gross - backrun_cost
        direct_lp = gross - direct_cost
        lp_ratio = direct_lp / backrun_lp if backrun_lp != 0 else None
        sensitivities.append(
            {
                "gas_price_gwei": decimal_string(gas_price),
                "backrun_cost_a_equivalent": decimal_string(backrun_cost),
                "direct_cost_a_equivalent": decimal_string(direct_cost),
                "backrun_lp_net_a_equivalent": decimal_string(backrun_lp),
                "direct_lp_net_a_equivalent": decimal_string(direct_lp),
                "direct_over_backrun_lp_net": decimal_string(lp_ratio) if lp_ratio is not None else None,
                "lp_net_uplift_percent": (
                    decimal_string((lp_ratio - Decimal(1)) * Decimal(100)) if lp_ratio is not None else None
                ),
                "both_lp_net_values_positive": backrun_lp > 0 and direct_lp > 0,
            }
        )

    threshold_price = (
        (TARGET_LP_RATIO - Decimal(1))
        * gross
        * GWEI_IN_ETH
        / (OPERATING_MULTIPLIER * (TARGET_LP_RATIO * backrun_gas - direct_gas))
    )
    baseline_zero_price = gross * GWEI_IN_ETH / (OPERATING_MULTIPLIER * backrun_gas)
    baseline_cost_share_required = (TARGET_LP_RATIO - Decimal(1)) / (TARGET_LP_RATIO - ratio)

    fixed_pool_retention = gross - fixed_reward
    return {
        "canonical_input_wei": canonical_input,
        "gross_cyclic_surplus_a": decimal_string(gross),
        "fixed_solver_reward_a": decimal_string(fixed_reward),
        "fixed_pool_retention_a": decimal_string(fixed_pool_retention),
        "fixed_reward_share_of_gross": decimal_string(fixed_reward / gross),
        "actual_contract_distribution": {
            "backrun_pool_retention_a": decimal_string(fixed_pool_retention),
            "direct_pool_retention_a": decimal_string(fixed_pool_retention),
            "lp_retention_difference_a": "0",
            "interpretation": (
                "The delivered mechanism pays the same fixed reward in both paths. "
                "Execution savings accrue to the gas payer unless a separate competitive reward market passes them through."
            ),
        },
        "canonical_release_gas": {
            "backrun_total": int(backrun_gas),
            "direct_total": int(direct_gas),
            "saved": int(backrun_gas - direct_gas),
            "direct_over_backrun": decimal_string(ratio),
            "reduction_percent": decimal_string((Decimal(1) - ratio) * Decimal(100)),
        },
        "gas_indexed_reward_counterfactual": {
            "status": "sensitivity_only_not_implemented",
            "assumptions": {
                "operating_multiplier": decimal_string(OPERATING_MULTIPLIER),
                "gas_token_and_token_a_value_parity": True,
                "entire_transaction_gas_charged_to_cyclic_surplus": True,
                "l1_data_fee_included": False,
                "operator_fee_included": False,
            },
            "sensitivities": sensitivities,
            "gas_price_for_1_10_lp_ratio_gwei": decimal_string(threshold_price),
            "gas_price_where_backrun_lp_net_reaches_zero_gwei": decimal_string(baseline_zero_price),
            "backrun_execution_cost_share_of_gross_required_for_1_10_ratio": decimal_string(
                baseline_cost_share_required
            ),
        },
    }


def residual_sample() -> dict[str, Any]:
    samples = 50_000
    seed = 1057
    valid = 0
    rejected = 0
    above_threshold = 0
    maximum = 0
    for network in networks(samples, seed):
        result = fold(network, normalize=True)
        if result is None:
            rejected += 1
            continue
        valid += 1
        residual = result[2]
        maximum = max(maximum, residual)
        above_threshold += residual > RESIDUAL_THRESHOLD
    return {
        "samples": samples,
        "seed": seed,
        "valid_fold_pairs": valid,
        "rejected_fold_domain": rejected,
        "rejected_fold_domain_percent": decimal_string(Decimal(rejected) * Decimal(100) / Decimal(samples)),
        "residual_above_threshold": above_threshold,
        "maximum_delivered_residual_wei_a": maximum,
        "interpretation": (
            "No sampled valid fold ended above the threshold. This is empirical evidence, not a contract postcondition: "
            "fold() records the residual after eight rounds but does not revert solely because it remains above threshold."
        ),
    }


def build_result() -> dict[str, Any]:
    freeze = load_json(FREEZE)
    v0_raw = load_json(V0_RAW)
    decision = load_json(V0_DECISION)
    release = load_json(RELEASE_RAW)
    arithmetic = load_json(ARITHMETIC)

    verification = verify_artifacts(freeze, v0_raw, decision, release)
    return {
        "schema": "arbfold-thesis-reassessment-v1",
        "analysis_date": "2026-08-29",
        "scope": "frozen v0 experiment, delivered release-candidate core, and deterministic local evidence",
        "artifact_verification": verification,
        "decision_ledger": {
            "mechanical_equivalence_fixed_grid": "supported",
            "execution_efficiency_universal": "falsified_by_25k_release_regression",
            "execution_efficiency_workload_dependent": "supported",
            "ten_percent_lp_net_uplift": "falsified",
            "general_defensive_rebalancing_optimizer": "not_implemented",
            "production_readiness": "not_established",
            "historical_opportunity_frequency": "not_tested_because_v0_gate_failed_first",
        },
        "release_grid": release_grid(release, v0_raw),
        "canonical_economics": economics(release, v0_raw),
        "arithmetic_differential": {
            "samples": arithmetic["samples"],
            "seed": arithmetic["seed"],
            "direction_mismatches": arithmetic["direction_mismatches"],
            "valid_fold_pairs": arithmetic["valid_fold_pairs"],
            "rejected_fold_domain": arithmetic["rejected_fold_domain"],
            "profit_max_relative_error": arithmetic["quote_error"]["profit_a"]["max_relative"],
            "final_reserve_max_relative_error": arithmetic["final_reserve_error"]["max_relative"],
            "residual_max_absolute_error": arithmetic["residual_profit_error"]["max_absolute"],
            "residual_max_relative_error": arithmetic["residual_profit_error"]["max_relative"],
            "residual_metric_is_part_of_existing_pass_gate": False,
        },
        "delivered_residual_sample": residual_sample(),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", type=Path, help="write deterministic JSON to this path")
    parser.add_argument("--check", type=Path, help="compare deterministic JSON with this path")
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
            raise SystemExit(f"reassessment output differs from {target}")
    print(rendered, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
