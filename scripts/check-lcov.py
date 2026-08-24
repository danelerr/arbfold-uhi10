#!/usr/bin/env python3
"""Fail closed when project-owned LCOV coverage drops below release gates."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    parser.add_argument("--min-lines", type=float, default=90.0)
    parser.add_argument("--min-branches", type=float, default=85.0)
    args = parser.parse_args()

    if not args.path.is_file():
        raise SystemExit(f"coverage artifact missing: {args.path}")

    totals = {"LF": 0, "LH": 0, "BRF": 0, "BRH": 0, "FNF": 0, "FNH": 0}
    sources: list[str] = []
    for line in args.path.read_text(encoding="utf-8").splitlines():
        if line.startswith("SF:"):
            source = line.removeprefix("SF:")
            sources.append(source)
            if not source.startswith("src/"):
                raise SystemExit(f"non-project source leaked into coverage report: {source}")
        key, separator, value = line.partition(":")
        if separator and key in totals:
            totals[key] += int(value)

    if not sources or totals["LF"] == 0 or totals["BRF"] == 0:
        raise SystemExit("coverage report is empty or lacks branch data")

    line_percent = totals["LH"] * 100 / totals["LF"]
    branch_percent = totals["BRH"] * 100 / totals["BRF"]
    function_percent = totals["FNH"] * 100 / totals["FNF"] if totals["FNF"] else 100.0
    summary = {
        "schema": "arbfold-coverage-v1",
        "sources": sorted(sources),
        "lines": {"hit": totals["LH"], "found": totals["LF"], "percent": line_percent},
        "branches": {"hit": totals["BRH"], "found": totals["BRF"], "percent": branch_percent},
        "functions": {"hit": totals["FNH"], "found": totals["FNF"], "percent": function_percent},
    }
    print(json.dumps(summary, indent=2, sort_keys=True))
    return int(line_percent < args.min_lines or branch_percent < args.min_branches)


if __name__ == "__main__":
    raise SystemExit(main())
