from __future__ import annotations

import unittest
from decimal import Decimal

from research.reassess_arbfold import build_result


class ArbFoldThesisReassessmentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.result = build_result()

    def test_artifact_chain_and_delivered_manifest_are_intact(self) -> None:
        checks = self.result["artifact_verification"]["checks"]
        self.assertTrue(all(checks.values()), checks)

    def test_release_grid_discloses_one_regression(self) -> None:
        rows = self.result["release_grid"]
        cheaper = [row for row in rows if row["direct_is_cheaper"]]
        regressions = [row for row in rows if not row["direct_is_cheaper"]]
        self.assertEqual(len(cheaper), 4)
        self.assertEqual(len(regressions), 1)
        self.assertEqual(regressions[0]["origin_input_wei"], str(25_000 * 10**18))
        self.assertEqual(regressions[0]["gas_saved"], -4_028)

    def test_fixed_reward_does_not_pass_gas_saving_to_pools(self) -> None:
        actual = self.result["canonical_economics"]["actual_contract_distribution"]
        self.assertEqual(actual["backrun_pool_retention_a"], actual["direct_pool_retention_a"])
        self.assertEqual(actual["lp_retention_difference_a"], "0")

    def test_frozen_gas_price_range_cannot_reach_ten_percent_uplift(self) -> None:
        counterfactual = self.result["canonical_economics"]["gas_indexed_reward_counterfactual"]
        frozen_range_rows = [
            row for row in counterfactual["sensitivities"] if Decimal(row["gas_price_gwei"]) <= Decimal(10)
        ]
        self.assertTrue(frozen_range_rows)
        self.assertTrue(
            all(Decimal(row["direct_over_backrun_lp_net"]) < Decimal("1.10") for row in frozen_range_rows)
        )
        self.assertGreater(Decimal(counterfactual["gas_price_for_1_10_lp_ratio_gwei"]), Decimal(10))

    def test_ten_percent_uplift_requires_large_cost_share(self) -> None:
        counterfactual = self.result["canonical_economics"]["gas_indexed_reward_counterfactual"]
        share = Decimal(counterfactual["backrun_execution_cost_share_of_gross_required_for_1_10_ratio"])
        self.assertGreater(share, Decimal("0.34"))
        self.assertLess(share, Decimal("0.35"))

    def test_sampled_valid_folds_finish_below_residual_threshold(self) -> None:
        residual = self.result["delivered_residual_sample"]
        self.assertEqual(residual["samples"], 50_000)
        self.assertEqual(residual["residual_above_threshold"], 0)
        self.assertLessEqual(residual["maximum_delivered_residual_wei_a"], 10**12)


if __name__ == "__main__":
    unittest.main()
