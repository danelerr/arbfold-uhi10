#!/usr/bin/env python3
"""Create or verify deterministic manifests without rewriting historical evidence."""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE_ROOT = ROOT / "contracts" / "src"
V01_GENERATOR = ROOT / "scripts" / "generate-v01-benchmark.py"


def build_manifest(scope: str) -> str:
    if scope == "optimized-v01":
        paths = sorted(
            [
                *SOURCE_ROOT.glob("*.sol"),
                *(ROOT / "contracts" / "test").glob("*.sol"),
                ROOT / "contracts" / "foundry.toml",
                V01_GENERATOR,
            ]
        )
    else:
        paths = sorted(path for path in SOURCE_ROOT.rglob("*.sol") if path.is_file())
    if not paths:
        raise SystemExit(f"no Solidity sources found under {SOURCE_ROOT}")

    entries: list[str] = []
    for path in paths:
        relative = path.relative_to(ROOT).as_posix()
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        entries.append(f"{digest}  {relative}")

    payload = "\n".join(entries) + "\n"
    if scope == "optimized-v01":
        return payload

    tree_digest = hashlib.sha256(payload.encode()).hexdigest()
    return "\n".join([f"TREE_SHA256  {tree_digest}", *entries]) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--scope",
        choices=("delivered-v0", "optimized-v01"),
        default="delivered-v0",
        help="select the immutable v0 source-only format or the v0.1 sources-and-tests format",
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", type=Path, metavar="PATH")
    mode.add_argument("--check", type=Path, metavar="PATH")
    args = parser.parse_args()

    expected = build_manifest(args.scope)
    target = args.write or args.check
    assert target is not None
    if not target.is_absolute():
        target = ROOT / target

    if args.write is not None:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(expected, encoding="utf-8")
        print(expected, end="")
        return 0

    if not target.is_file():
        raise SystemExit(f"release source manifest missing: {target}")
    actual = target.read_text(encoding="utf-8")
    if actual != expected:
        raise SystemExit(
            f"release source manifest does not match the {args.scope} scope; "
            "rerun the benchmark and freeze a new release candidate"
        )
    print(expected.splitlines()[0])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
