import hashlib
import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ArbFoldSubmissionIntegrityTests(unittest.TestCase):
    def test_dashboard_grid_matches_release_candidate_results(self) -> None:
        raw = json.loads((ROOT / "benchmark/release-candidate-results/raw.json").read_text())
        source = (ROOT / "app/app.js").read_text()
        rows = re.findall(
            r"size:\s*(\d+),\s*backrun:\s*(\d+),\s*direct:\s*(\d+),\s*ratioBps:\s*(\d+)",
            source,
        )
        displayed = [tuple(map(int, row)) for row in rows]
        expected = [
            (
                int(row["origin_input_wei"]) // 10**18,
                row["backrun_total_gas"],
                row["direct_total_gas"],
                row["gas_ratio_bps"],
            )
            for row in raw["rows"]
        ]
        self.assertEqual(displayed, expected)

    def test_dashboard_discloses_failed_economic_gate(self) -> None:
        page = (ROOT / "app/index.html").read_text()
        self.assertIn("REJECTED CLAIM", page)
        self.assertIn("0.000287%", page)
        self.assertIn("KILL_ARBFOLD economic thesis", page)

    def test_frozen_artifact_hashes_remain_unchanged(self) -> None:
        expected = {
            "benchmark/arbfold_freeze_v0.json": "8f6dc062d3897693eed8fa5af9cf5d6b6ce62f7c32af07719cf5d588e203aaf0",
            "benchmark/arbfold-results/raw_v0.json": "81e9ee474809b9a9e2852e4573383dea9ccc8d40092ceab81cb91d3f550cb00e",
            "benchmark/arbfold-results/REPORT.md": "60278f47cb6fc679850cbea51f5c59683d2dc65b1f11f6865571222f7384cd49",
        }
        for relative_path, digest in expected.items():
            actual = hashlib.sha256((ROOT / relative_path).read_bytes()).hexdigest()
            self.assertEqual(actual, digest, relative_path)

    def test_clean_core_freeze_and_commit_are_bound(self) -> None:
        freeze = ROOT / "benchmark/clean_core_validation_freeze_v1.json"
        expected_freeze = "294c5c5afeaea39134e62f36e922b537cc0d7974f3b206e4133472bf443d2153"
        self.assertEqual(hashlib.sha256(freeze.read_bytes()).hexdigest(), expected_freeze)

        raw = json.loads((ROOT / "benchmark/clean-core-results/raw_v1.json").read_text())
        self.assertEqual(
            raw["tested_commit"],
            "6dd7946c9eb2c29a75698e4f9ca06c4432e6ccd0",
        )
        self.assertEqual(
            raw["tested_source_tree_sha256"],
            "097c5b5bb745c322bb7941d56b8f7dcf540a7e0291b2babbe38044d21a7df857",
        )

        evidence_hashes = {
            "benchmark/clean-core-results/raw_v1.json": "88a7918831ce8d79b7a22428c3bef205eeeccacdabde662dbafe2dfb8761a373",
            "benchmark/clean-core-results/gas-snapshot.txt": "574f6aaf006eb6e3eb991cf512afb3e658fd481cdf93d61346d64116199f577b",
            "benchmark/clean-core-results/forge-test.txt": "41ea59d24f7ace508ca9ac048a1626241a77ffd56aa64cd68fdf7c4fc5acb97b",
        }
        for relative_path, digest in evidence_hashes.items():
            actual = hashlib.sha256((ROOT / relative_path).read_bytes()).hexdigest()
            self.assertEqual(actual, digest, relative_path)

    def test_release_candidate_is_bound_to_delivered_sources(self) -> None:
        raw = json.loads((ROOT / "benchmark/release-candidate-results/raw.json").read_text())
        self.assertEqual(
            raw["tested_commit"],
            "9cbc16ed55c8bcbee2a3bbb05c95d049a0127c1b",
        )
        manifest = (ROOT / "benchmark/release-candidate-results/source-manifest.sha256").read_text()
        self.assertEqual(
            manifest.splitlines()[0],
            f'TREE_SHA256  {raw["tested_source_tree_sha256"]}',
        )

        entries = []
        for path in sorted((ROOT / "contracts/src").glob("*.sol")):
            relative = path.relative_to(ROOT).as_posix()
            entries.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {relative}")
        tree = hashlib.sha256(("\n".join(entries) + "\n").encode()).hexdigest()
        self.assertEqual(tree, raw["tested_source_tree_sha256"])

        evidence_hashes = {
            "benchmark/release-candidate-results/REPORT.md": "db51a507806315bdb03c7bb2b4c0d362d71bef6d47dd842d42031abae6b42dde",
            "benchmark/release-candidate-results/raw.json": "222a5adaeefa510b489708883488bc232c7f5d3b40d328e05fa39b4a1e9c420d",
            "benchmark/release-candidate-results/forge-test.txt": "023e6d1a8823cb85be3d12efcb930b5c46d046688544da777b7bec80f63a343b",
            "benchmark/release-candidate-results/gas-snapshot.txt": "ca8f4e148ed2d967fe37a8c1a51e1eb4898f72971e81f11fe726ccbf90b2ef72",
            "benchmark/release-candidate-results/environment.json": "c8694171463816815fc61b0ef26b5cf0f7414881e02be1722c336150732c62e8",
            "benchmark/release-candidate-results/source-manifest.sha256": "20afdcea444547df5a115983cbe82674452ab8d532fa4259153379a2466af969",
        }
        for relative_path, digest in evidence_hashes.items():
            actual = hashlib.sha256((ROOT / relative_path).read_bytes()).hexdigest()
            self.assertEqual(actual, digest, relative_path)

    def test_dashboard_discloses_release_workload_regression(self) -> None:
        page = (ROOT / "app/index.html").read_text()
        self.assertIn("19.12% less gas", page)
        self.assertIn("+0.98% at 25k", page)
        source = (ROOT / "app/app.js").read_text()
        self.assertIn("Public deployment pending", source)
        self.assertIn('../deployments/unichain-sepolia-1301.json', source)
        self.assertIn("manifest.researchOnly !== true", source)
        self.assertIn("manifest.chainId !== 1301", source)

    def test_public_deployment_executor_fails_closed(self) -> None:
        path = ROOT / "scripts/deploy-unichain-sepolia.sh"
        source = path.read_text()
        self.assertNotEqual(path.stat().st_mode & 0o111, 0)
        for required_guard in (
            "permission_tail",
            "--network-check",
            "--preflight",
            "no transaction was broadcast",
            'git branch --show-current)\" == \"main\"',
            "working tree must be clean",
            "local main must equal origin/main",
            "EXPECTED_CHAIN_ID=1301",
            "resolve-unichain-pool-manager.sh",
            "official PoolManager has no bytecode",
            "has no Unichain Sepolia ETH",
            "VerifyArbFoldDeployment",
            "RunArbFoldDemo",
            "finalize-manifest.sh",
            "never paste it into chat",
        ):
            self.assertIn(required_guard, source)

        ignore = (ROOT / ".gitignore").read_text().splitlines()
        self.assertIn(".env", ignore)
        self.assertIn(".env.*", ignore)


if __name__ == "__main__":
    unittest.main()
