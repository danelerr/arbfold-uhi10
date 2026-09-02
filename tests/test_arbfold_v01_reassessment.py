from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from research.reassess_arbfold_v01 import (
    MAX_UINT256,
    PAIRED_FIELDS,
    RECOMPUTED_GATES,
    RESIDUAL_THRESHOLD_WEI_A,
    build_result,
    derive_dense_sweep_summary,
    is_canonical_uint_decimal,
    reduction_percent,
    validate_payload_semantics,
    verify_source_manifest,
)


ROOT = Path(__file__).resolve().parents[1]
GENERATOR_PATH = ROOT / "scripts/generate-v01-benchmark.py"
GENERATOR_SPEC = importlib.util.spec_from_file_location("generate_v01_benchmark", GENERATOR_PATH)
assert GENERATOR_SPEC is not None and GENERATOR_SPEC.loader is not None
GENERATOR = importlib.util.module_from_spec(GENERATOR_SPEC)
GENERATOR_SPEC.loader.exec_module(GENERATOR)


def mutate(payload: dict, callback) -> dict:
    subject = copy.deepcopy(payload)
    callback(subject)
    return subject


def make_direct_path_more_expensive(payload: dict, row_index: int) -> dict:
    row = payload["frozen_grid"][row_index]
    row["direct_total_gas"] = row["reference_total_gas"] + 1
    row["direct_execution_gas"] = (
        row["direct_total_gas"] - 21_000 - row["direct_calldata_gas"]
    )
    row["absolute_gas_saved"] = -1
    row["direct_to_reference_bps"] = (
        row["direct_total_gas"] * 10_000 // row["reference_total_gas"]
    )
    row["gas_reduction_percent"] = reduction_percent(
        row["reference_total_gas"], row["direct_total_gas"]
    )
    return payload


def mutation_for_gate(payload: dict, gate: str) -> dict:
    subject = copy.deepcopy(payload)
    row = subject["frozen_grid"][0]
    if gate == "all_frozen_outputs_equal":
        row["direct_user_output"] = str(int(row["direct_user_output"]) + 1)
    elif gate == "all_frozen_rewards_equal":
        row["direct_external_recipient_reward"] = str(
            int(row["direct_external_recipient_reward"]) + 1
        )
    elif gate == "all_frozen_residuals_equal_and_within_threshold":
        row["direct_residual"] = row["reference_residual"] + 1
    elif gate == "all_frozen_final_reserves_within_one_wei":
        row["equivalence_tolerance_wei"] = 2
    elif gate == "twenty_five_k_cheaper":
        make_direct_path_more_expensive(subject, 1)
    elif gate == "all_five_cheaper":
        make_direct_path_more_expensive(subject, 0)
    else:
        raise AssertionError(f"unknown gate {gate}")
    return subject


class ArbFoldV01ReassessmentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.raw = json.loads(
            (ROOT / "benchmark/optimized-release-candidate-results/raw.json").read_text()
        )
        cls.environment = json.loads(
            (ROOT / "benchmark/optimized-release-candidate-results/environment.json").read_text()
        )

    def assert_invalid(self, payload: dict) -> None:
        with self.assertRaises((ValueError, RuntimeError)):
            validate_payload_semantics(payload)

    def test_generator_check_mode_is_read_only_and_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            artifact = output / "artifact.txt"
            artifacts = {artifact: "canonical\n"}

            GENERATOR.persist_artifacts(artifacts, check=False)
            self.assertEqual(artifact.read_text(), "canonical\n")
            GENERATOR.persist_artifacts(artifacts, check=True)
            self.assertEqual(artifact.read_text(), "canonical\n")

            artifact.write_text("drifted\n")
            with self.assertRaisesRegex(RuntimeError, "generated evidence differs"):
                GENERATOR.persist_artifacts(artifacts, check=True)
            self.assertEqual(artifact.read_text(), "drifted\n")

    def test_generator_preserves_commit_binding_for_unchanged_source_tree(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            previous = {
                "source_tree_sha256": "a" * 64,
                "commit_base": "b" * 40,
            }
            (output / "environment.json").write_text(json.dumps(previous))
            with patch.object(GENERATOR, "OUT", output):
                self.assertEqual(GENERATOR.stable_commit_base("a" * 64), "b" * 40)
                with patch.object(GENERATOR, "git", return_value="c" * 40):
                    self.assertEqual(GENERATOR.stable_commit_base("d" * 64), "c" * 40)

    def test_all_promotion_checks_and_expected_results_hold(self) -> None:
        semantics = validate_payload_semantics(self.raw)
        self.assertEqual(semantics["validated_paths"], [0, 1, 2, 3, 4, 5])
        result = build_result()
        self.assertTrue(all(result["artifact_verification"]["checks"].values()))
        self.assertEqual(result["schema"], "arbfold-v0.1-thesis-reassessment-v5")
        self.assertEqual(
            [
                (row["reference_total_gas"], row["direct_total_gas"])
                for row in self.raw["frozen_grid"]
            ],
            [
                (407_292, 327_669),
                (409_402, 329_777),
                (544_219, 375_171),
                (544_219, 375_171),
                (544_209, 375_160),
            ],
        )
        self.assertEqual(self.raw["frozen_grid"][1]["gas_reduction_percent"], "19.449099")
        self.assertEqual(self.raw["frozen_grid"][3]["gas_reduction_percent"], "31.062495")
        self.assertEqual(
            result["decision_ledger"]["v0_1_public_deployment"],
            "performed_on_unichain_sepolia",
        )

    def test_provenance_and_compiler_matrix_are_mandatory_and_source_bound(self) -> None:
        semantics = validate_payload_semantics(self.raw)
        self.assertEqual(
            semantics["validated_compiler_configurations"],
            [
                "no-ir-runs-200",
                "no-ir-runs-1000",
                "via-ir-runs-200",
                "via-ir-runs-1000",
            ],
        )
        source = verify_source_manifest(self.raw, self.environment)
        self.assertTrue(all(source["checks"].values()))

        self.assert_invalid(mutate(self.raw, lambda value: value.__delitem__("source_tree_sha256")))
        self.assert_invalid(
            mutate(
                self.raw,
                lambda value: value.__setitem__("source_tree_sha256", "not-a-digest"),
            )
        )
        self.assert_invalid(
            mutate(self.raw, lambda value: value.__setitem__("unreviewed", True))
        )
        fabricated_digest = mutate(
            self.raw, lambda value: value.__setitem__("source_tree_sha256", "0" * 64)
        )
        validate_payload_semantics(fabricated_digest)
        with self.assertRaisesRegex(ValueError, "does not match the source manifest"):
            verify_source_manifest(fabricated_digest, self.environment)

        compiler_mutations = (
            lambda value: value.__delitem__("compiler_matrix"),
            lambda value: value.__setitem__("compiler_matrix", []),
            lambda value: value.__setitem__(
                "compiler_matrix", [{"name": "fictional", "status": "measured"}]
            ),
            lambda value: value["compiler_matrix"].__setitem__(
                slice(0, 2), [value["compiler_matrix"][1], value["compiler_matrix"][0]]
            ),
            lambda value: value["compiler_matrix"].__setitem__(
                1, copy.deepcopy(value["compiler_matrix"][0])
            ),
            lambda value: value["compiler_matrix"][0].__setitem__("via_ir", True),
            lambda value: value["compiler_matrix"][0].__setitem__("optimizer_runs", 1_000),
            lambda value: value["compiler_matrix"][0].__setitem__("status", "invented"),
            lambda value: value["compiler_matrix"][1].__setitem__(
                "canonical_direct_total_gas", 0
            ),
            lambda value: value["compiler_matrix"][2].__setitem__(
                "canonical_gas_reduction_percent", "99.999999"
            ),
            lambda value: value["compiler_matrix"][0]["deployed_bytecode_bytes"].__delitem__(
                "router"
            ),
            lambda value: value["compiler_matrix"][1]["deployed_bytecode_bytes"].__setitem__(
                "hook", 0
            ),
            lambda value: value["compiler_matrix"][2]["deployed_bytecode_bytes"].__setitem__(
                "coordinator", -1
            ),
            lambda value: value["compiler_matrix"][3].__setitem__(
                "error_sha256", "0" * 64
            ),
        )
        for callback in compiler_mutations:
            subject = mutate(self.raw, callback)
            self.assert_invalid(subject)
            with self.assertRaises(RuntimeError):
                GENERATOR.validate_generated_payload(subject)

        environment = copy.deepcopy(self.environment)
        environment["selected_compiler_configuration"] = "via-ir-runs-200"
        with self.assertRaisesRegex(ValueError, "selected compiler configuration"):
            verify_source_manifest(self.raw, environment)

        real_manifest = (
            ROOT / "benchmark/optimized-release-candidate-results/source-manifest.sha256"
        ).read_text()
        incomplete_manifest = "\n".join(real_manifest.splitlines()[1:]) + "\n"
        incomplete_digest = hashlib.sha256(incomplete_manifest.encode()).hexdigest()
        incomplete_raw = copy.deepcopy(self.raw)
        incomplete_environment = copy.deepcopy(self.environment)
        incomplete_raw["source_tree_sha256"] = incomplete_digest
        incomplete_environment["source_tree_sha256"] = incomplete_digest
        with tempfile.TemporaryDirectory() as directory:
            incomplete_path = Path(directory) / "source-manifest.sha256"
            incomplete_path.write_text(incomplete_manifest)
            with patch(
                "research.reassess_arbfold_v01.SOURCE_MANIFEST", incomplete_path
            ):
                with self.assertRaisesRegex(ValueError, "path set"):
                    verify_source_manifest(incomplete_raw, incomplete_environment)

    def test_uint256_boundaries_and_one_wei_pairs_are_exhaustive(self) -> None:
        maximum = str(MAX_UINT256)
        overflow = str(MAX_UINT256 + 1)
        self.assertTrue(is_canonical_uint_decimal("0"))
        self.assertTrue(is_canonical_uint_decimal(maximum))
        self.assertFalse(is_canonical_uint_decimal(overflow))
        self.assertFalse(is_canonical_uint_decimal("9" * 1_000))
        self.assertEqual(GENERATOR.canonical_uint_decimal(0), "0")
        self.assertEqual(GENERATOR.canonical_uint_decimal(MAX_UINT256), maximum)
        with self.assertRaises(ValueError):
            GENERATOR.canonical_uint_decimal(MAX_UINT256 + 1)

        for row_index in range(5):
            for left, right in (
                ("reference_user_output", "direct_user_output"),
                (
                    "reference_external_recipient_reward",
                    "direct_external_recipient_reward",
                ),
            ):
                for boundary in ("0", maximum):
                    accepted = copy.deepcopy(self.raw)
                    accepted["frozen_grid"][row_index][left] = boundary
                    accepted["frozen_grid"][row_index][right] = boundary
                    validate_payload_semantics(accepted)
            for field in PAIRED_FIELDS:
                for invalid in (overflow, "9" * 1_000, "", "-1", "1.0", "1e3", "01"):
                    self.assert_invalid(
                        mutate(
                            self.raw,
                            lambda value, i=row_index, f=field, v=invalid: value[
                                "frozen_grid"
                            ][i].__setitem__(f, v),
                        )
                    )
                for delta in (-1, 1):
                    self.assert_invalid(
                        mutate(
                            self.raw,
                            lambda value, i=row_index, f=field, d=delta: value[
                                "frozen_grid"
                            ][i].__setitem__(
                                f, str(int(value["frozen_grid"][i][f]) + d)
                            ),
                        )
                    )

    def test_input_wei_is_string_uint256_and_matches_every_workload(self) -> None:
        overflow = str(MAX_UINT256 + 1)
        for section, indexes in (
            ("frozen_grid", range(5)),
            ("dense_sweep", (0, 99, 199)),
            ("six_path_matrix", range(6)),
        ):
            for row_index in indexes:
                for invalid in (None, "", "01", "1e18", overflow):
                    def set_invalid(value, s=section, i=row_index, invalid_value=invalid):
                        if invalid_value is None:
                            del value[s][i]["input_wei"]
                        else:
                            value[s][i]["input_wei"] = invalid_value

                    self.assert_invalid(mutate(self.raw, set_invalid))
                self.assert_invalid(
                    mutate(
                        self.raw,
                        lambda value, s=section, i=row_index: value[s][i].__setitem__(
                            "input_wei", str(int(value[s][i]["input_wei"]) + 1)
                        ),
                    )
                )

    def test_gas_derivations_fail_in_all_five_frozen_rows(self) -> None:
        self.assertEqual(reduction_percent(512, 511), "0.195312")
        self.assertEqual(reduction_percent(512, 509), "0.585938")
        self.assertEqual(GENERATOR.reduction(512, 511), "0.195312")
        self.assertEqual(GENERATOR.reduction(512, 509), "0.585938")
        for row_index, row in enumerate(self.raw["frozen_grid"]):
            for field, value in (
                ("gas_reduction_percent", "99.999999"),
                ("reference_total_gas", row["reference_total_gas"] + 1),
                ("direct_total_gas", row["direct_total_gas"] + 1),
                ("absolute_gas_saved", row["absolute_gas_saved"] + 1),
                ("direct_to_reference_bps", row["direct_to_reference_bps"] + 1),
            ):
                self.assert_invalid(
                    mutate(
                        self.raw,
                        lambda subject, i=row_index, f=field, v=value: subject[
                            "frozen_grid"
                        ][i].__setitem__(f, v),
                    )
                )
        self.assert_invalid(make_direct_path_more_expensive(copy.deepcopy(self.raw), 0))
        self.assert_invalid(make_direct_path_more_expensive(copy.deepcopy(self.raw), 1))

    def test_round_path_and_residual_semantics_fail_closed(self) -> None:
        for row_index in range(5):
            for field in (
                "reference_rounds",
                "reference_arbitrage_swaps",
                "reference_reinjections",
                "direct_rounds",
                "direct_fold_calls",
            ):
                self.assert_invalid(
                    mutate(
                        self.raw,
                        lambda value, i=row_index, f=field: value["frozen_grid"][i].__setitem__(
                            f, value["frozen_grid"][i][f] + 1
                        ),
                    )
                )
            self.assert_invalid(
                mutate(
                    self.raw,
                    lambda value, i=row_index: value["frozen_grid"][i].__setitem__("path", 0),
                )
            )
            self.assert_invalid(
                mutate(
                    self.raw,
                    lambda value, i=row_index: value["frozen_grid"][i].__setitem__(
                        "path_label", "fabricated"
                    ),
                )
            )
            self.assert_invalid(
                mutate(
                    self.raw,
                    lambda value, i=row_index: value["frozen_grid"][i].__setitem__(
                        "direct_residual", value["frozen_grid"][i]["reference_residual"] + 1
                    ),
                )
            )
            for field in (
                "reference_residual",
                "direct_residual",
                "equivalence_tolerance_wei",
            ):
                for mode in ("missing", "null", "negative", "fractional"):
                    def corrupt(value, i=row_index, f=field, selected=mode):
                        if selected == "missing":
                            del value["frozen_grid"][i][f]
                        elif selected == "null":
                            value["frozen_grid"][i][f] = None
                        elif selected == "negative":
                            value["frozen_grid"][i][f] = -1
                        else:
                            value["frozen_grid"][i][f] = 0.5

                    self.assert_invalid(mutate(self.raw, corrupt))
            over = copy.deepcopy(self.raw)
            over["frozen_grid"][row_index]["reference_residual"] = RESIDUAL_THRESHOLD_WEI_A + 1
            over["frozen_grid"][row_index]["direct_residual"] = RESIDUAL_THRESHOLD_WEI_A + 1
            self.assert_invalid(over)
        canonical = copy.deepcopy(self.raw)
        canonical["frozen_grid"][3]["reference_residual"] = 1
        canonical["frozen_grid"][3]["direct_residual"] = 1
        self.assert_invalid(canonical)

    def test_dense_sweep_is_recomputed_and_summary_cannot_lie(self) -> None:
        summary = derive_dense_sweep_summary(self.raw["dense_sweep"])
        self.assertEqual(summary, self.raw["dense_sweep_summary"])
        self.assertEqual(summary["actionable_rows"], 196)
        self.assertEqual(summary["cheaper_actionable_rows"], 196)
        self.assertEqual(summary["first_actionable_tokens"], 5_000)

        structural = (
            lambda value: value.__delitem__("dense_sweep"),
            lambda value: value.__setitem__("dense_sweep", []),
            lambda value: value["dense_sweep"].pop(),
            lambda value: value["dense_sweep"].append(copy.deepcopy(value["dense_sweep"][-1])),
            lambda value: value["dense_sweep"].__setitem__(
                1, copy.deepcopy(value["dense_sweep"][0])
            ),
            lambda value: value["dense_sweep"].__setitem__(
                slice(10, 12), [value["dense_sweep"][11], value["dense_sweep"][10]]
            ),
            lambda value: (
                value["dense_sweep"][10].__setitem__(
                    "input_tokens", value["dense_sweep"][10]["input_tokens"] + 1
                ),
                value["dense_sweep"][10].__setitem__(
                    "input_wei", str(value["dense_sweep"][10]["input_tokens"] * 10**18)
                ),
            ),
        )
        for callback in structural:
            self.assert_invalid(mutate(self.raw, callback))

        for field in (
            "reference_total_gas",
            "direct_total_gas",
            "absolute_gas_saved",
        ):
            self.assert_invalid(
                mutate(
                    self.raw,
                    lambda value, f=field: value["dense_sweep"][50].__setitem__(
                        f, value["dense_sweep"][50][f] + 1
                    ),
                )
            )
        self.assert_invalid(
            mutate(
                self.raw,
                lambda value: value["dense_sweep"][50].__setitem__(
                    "gas_reduction_percent", "99.999999"
                ),
            )
        )
        for field in (
            "first_actionable_tokens",
            "actionable_rows",
            "cheaper_actionable_rows",
            "zero_round_ranges",
            "regression_ranges",
            "round_regions",
        ):
            self.assert_invalid(
                mutate(
                    self.raw,
                    lambda value, f=field: value["dense_sweep_summary"].__setitem__(f, None),
                )
            )

    def test_six_path_matrix_requires_all_unique_canonical_paths(self) -> None:
        callbacks = (
            lambda value: value.__delitem__("six_path_matrix"),
            lambda value: value["six_path_matrix"].pop(),
            lambda value: value["six_path_matrix"].__setitem__(
                1, copy.deepcopy(value["six_path_matrix"][0])
            ),
            lambda value: value["six_path_matrix"][3].__setitem__(
                "path_label", "fabricated"
            ),
            lambda value: value["six_path_matrix"][5].__setitem__(
                "direct_rounds", value["six_path_matrix"][5]["direct_rounds"] + 1
            ),
            lambda value: value["six_path_matrix"][2].__setitem__(
                "absolute_gas_saved", value["six_path_matrix"][2]["absolute_gas_saved"] + 1
            ),
            lambda value: value["six_path_matrix"][1].__setitem__("direct_residual", 1),
        )
        for callback in callbacks:
            self.assert_invalid(mutate(self.raw, callback))

    def test_every_gate_rejects_missing_false_or_contradictory_evidence(self) -> None:
        for gate in RECOMPUTED_GATES:
            self.assert_invalid(
                mutate(
                    self.raw,
                    lambda value, g=gate: value["mechanical_gates"].__delitem__(g),
                )
            )
            self.assert_invalid(
                mutate(
                    self.raw,
                    lambda value, g=gate: value["mechanical_gates"].__setitem__(g, False),
                )
            )
            self.assert_invalid(mutation_for_gate(self.raw, gate))

    def test_steady_state_boundary_remains_explicit(self) -> None:
        result = build_result()
        self.assertNotIn("storage_transition_matrix", self.raw)
        self.assertEqual(
            result["decision_ledger"]["steady_state_telemetry_gas"],
            "not_measured_without_cross_transaction_harness",
        )


if __name__ == "__main__":
    unittest.main()
