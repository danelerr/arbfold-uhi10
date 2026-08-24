#!/usr/bin/env python3
"""Create or verify the deterministic manifest for delivered Solidity sources."""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE_ROOT = ROOT / "contracts" / "src"


def build_manifest() -> str:
    paths = sorted(path for path in SOURCE_ROOT.rglob("*.sol") if path.is_file())
    if not paths:
        raise SystemExit(f"no Solidity sources found under {SOURCE_ROOT}")

    entries: list[str] = []
    for path in paths:
        relative = path.relative_to(ROOT).as_posix()
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        entries.append(f"{digest}  {relative}")

    payload = ("\n".join(entries) + "\n").encode()
    tree_digest = hashlib.sha256(payload).hexdigest()
    return "\n".join([f"TREE_SHA256  {tree_digest}", *entries]) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", type=Path, metavar="PATH")
    mode.add_argument("--check", type=Path, metavar="PATH")
    args = parser.parse_args()

    expected = build_manifest()
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
            "release source manifest does not match contracts/src; "
            "rerun the benchmark and freeze a new release candidate"
        )
    print(expected.splitlines()[0])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
