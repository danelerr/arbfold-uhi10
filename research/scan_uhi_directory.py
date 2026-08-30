#!/usr/bin/env python3
"""Run a bounded, reproducible keyword scan over the pinned UHI directory."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import urllib.request
from pathlib import Path


COMMIT = "3660c054f9d7e9a0cfbf5c27cc2845f55852df05"
URL = (
    "https://raw.githubusercontent.com/AtriumAcademy/UHI-Hook-Data/"
    f"{COMMIT}/hook_directory.md"
)
EXPECTED_SHA256 = "3fd9e5baefb36b88a170bc2bd25d0fb6d6e1a19b5471d03d993ac699f0df5848"
PATTERNS = {
    "defensive_rebalancing": r"defensive rebalanc",
    "cyclic_arbitrage": r"cyclic arbitrage",
    "direct_reserve": r"direct reserve",
    "reserve_transfer": r"reserve transfer",
    "pool_to_pool": r"pool-to-pool",
    "atomic_backrun": r"atomic backrun",
    "profit_reinjection": r"profit reinjection",
    "same_final_state": r"same final state",
    "custom_accounting": r"custom accounting",
    "mev_internalization": r"MEV internalization",
    "internalize_near_arbitrage": r"internaliz\w*[^\n]{0,80}arbitrage",
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", type=Path)
    parser.add_argument("--check", type=Path)
    args = parser.parse_args()
    with urllib.request.urlopen(URL, timeout=30) as response:
        payload = response.read()
    digest = hashlib.sha256(payload).hexdigest()
    if digest != EXPECTED_SHA256:
        raise SystemExit(f"snapshot digest mismatch: {digest}")
    text = payload.decode("utf-8")
    result = {
        "schema": "uhi-directory-bounded-keyword-scan-v1",
        "accessed": "2026-08-29",
        "commit": COMMIT,
        "url": URL,
        "sha256": digest,
        "bytes": len(payload),
        "newline_count": payload.count(b"\n"),
        "patterns": PATTERNS,
        "counts": {name: len(re.findall(pattern, text, re.IGNORECASE)) for name, pattern in PATTERNS.items()},
        "interpretation": (
            "Negative keyword results are bounded search evidence only. They do not prove historical or global novelty."
        ),
    }
    rendered = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.write:
        args.write.parent.mkdir(parents=True, exist_ok=True)
        args.write.write_text(rendered, encoding="utf-8")
    if args.check and args.check.read_text(encoding="utf-8") != rendered:
        raise SystemExit(f"scan output differs from {args.check}")
    print(rendered, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
