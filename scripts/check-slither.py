#!/usr/bin/env python3
"""Reject every unreviewed high/medium Slither result.

The narrow allowlist records two known detector families whose assumptions do
not hold for this fixed research deployment. It intentionally matches detector,
file and operation text so a new finding from the same detector still fails.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path


def _reviewed(result: dict[str, object]) -> bool:
    check = result.get("check")
    markdown = str(result.get("markdown", ""))
    first = str(result.get("first_markdown_element", ""))
    if check == "reentrancy-no-eth":
        return first.startswith("src/ArbFoldCoordinator.sol") and "ArbFoldCoordinator.fold(address)" in markdown
    if check == "unused-return":
        manager_claim = first.startswith("src/ArbFoldCoordinator.sol") and "manager.transferFrom" in markdown
        fixed_operator = first.startswith("src/ArbFoldHook.sol") and "poolManager.setOperator(coordinator,true)" in markdown
        return manager_claim or fixed_operator
    return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    if not args.path.is_file():
        raise SystemExit(f"Slither artifact missing: {args.path}")

    report = json.loads(args.path.read_text(encoding="utf-8"))
    if report.get("success") is not True:
        raise SystemExit("Slither did not complete successfully")
    findings = report.get("results", {}).get("detectors", [])
    unresolved = [
        finding
        for finding in findings
        if finding.get("impact") in {"High", "Medium"} and not _reviewed(finding)
    ]
    summary = {
        "schema": "arbfold-slither-review-v1",
        "slither_success": True,
        "total_findings": len(findings),
        "by_impact": dict(sorted(Counter(str(item.get("impact")) for item in findings).items())),
        "reviewed_medium_high": sum(
            item.get("impact") in {"High", "Medium"} and _reviewed(item) for item in findings
        ),
        "unresolved_medium_high": len(unresolved),
    }
    print(json.dumps(summary, indent=2, sort_keys=True))
    if unresolved:
        for finding in unresolved:
            print(f"UNRESOLVED {finding.get('impact')} {finding.get('check')}: {finding.get('first_markdown_element')}")
    return int(bool(unresolved))


if __name__ == "__main__":
    raise SystemExit(main())
