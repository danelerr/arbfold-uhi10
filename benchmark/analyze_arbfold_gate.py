from __future__ import annotations

import hashlib
import json
from decimal import Decimal, getcontext
from pathlib import Path


getcontext().prec = 60
ROOT = Path(__file__).resolve().parents[1]
FREEZE = ROOT / "benchmark" / "arbfold_freeze_v0.json"
RAW = ROOT / "benchmark" / "arbfold-results" / "raw_v0.json"


def main() -> None:
    freeze_bytes = FREEZE.read_bytes()
    actual_hash = hashlib.sha256(freeze_bytes).hexdigest()
    raw = json.loads(RAW.read_text())
    freeze = json.loads(freeze_bytes)
    if actual_hash != raw["freeze_sha256"]:
        raise SystemExit(f"freeze hash mismatch: {actual_hash}")

    canonical_input = freeze["market"]["canonical_input"]
    row = next(item for item in raw["rows"] if item["origin_input_wei"] == canonical_input)
    gas_price_gwei = Decimal(freeze["solver_economics"]["canonical_gas_price_gwei"])
    gas_price_wei = gas_price_gwei * Decimal(10**9)
    margin = Decimal(10_000 + freeze["solver_economics"]["operating_margin_bps"]) / Decimal(10_000)
    gross = Decimal(row["gross_surplus_wei_weth"])
    backrun_cost = Decimal(row["backrun_incremental_gas"]) * gas_price_wei * margin
    direct_cost = Decimal(row["direct_incremental_gas"]) * gas_price_wei * margin
    backrun_lp = gross - backrun_cost
    direct_lp = gross - direct_cost
    lp_ratio = direct_lp / backrun_lp
    gas_ratio = Decimal(row["direct_total_gas"]) / Decimal(row["backrun_total_gas"])
    required_gas_price_wei = (Decimal("0.10") * gross) / (
        margin
        * (
            Decimal("1.10") * Decimal(row["backrun_incremental_gas"])
            - Decimal(row["direct_incremental_gas"])
        )
    )

    gas_pass = gas_ratio <= Decimal("0.80") and all(
        item["direct_total_gas"] < item["backrun_total_gas"] for item in raw["rows"]
    )
    lp_pass = lp_ratio >= Decimal("1.10")
    mechanical_pass = all(raw["mechanical_tests"].values())
    decision = "PASS_ARBFOLD" if mechanical_pass and gas_pass and lp_pass else "KILL_ARBFOLD"

    result = {
        "freeze_sha256": actual_hash,
        "mechanical_pass": mechanical_pass,
        "gas_pass": gas_pass,
        "canonical_gas_ratio": str(gas_ratio),
        "canonical_gas_reduction_percent": str((Decimal(1) - gas_ratio) * Decimal(100)),
        "lp_net_pass": lp_pass,
        "canonical_backrun_min_reward_wei": str(backrun_cost),
        "canonical_direct_min_reward_wei": str(direct_cost),
        "canonical_backrun_lp_net_wei": str(backrun_lp),
        "canonical_direct_lp_net_wei": str(direct_lp),
        "canonical_lp_net_ratio": str(lp_ratio),
        "gas_price_required_for_1_10_lp_ratio_gwei": str(required_gas_price_wei / Decimal(10**9)),
        "historical_gate_reached": mechanical_pass and gas_pass and lp_pass,
        "decision": decision,
        "next_project": "DEPTHMARKET" if decision == "KILL_ARBFOLD" else "ARBFOLD",
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
