#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
slither_bin="${SLITHER:-slither}"
report="${SLITHER_REPORT:-${root_dir}/contracts/slither-report.json}"

if ! command -v "${slither_bin}" >/dev/null 2>&1; then
  printf 'Required analyzer not found: %s\n' "${slither_bin}" >&2
  exit 1
fi
slither_bin="$(command -v "${slither_bin}")"
if [[ "${slither_bin}" != /* ]]; then
  slither_bin="${root_dir}/${slither_bin}"
fi

rm -f "${report}"
set +e
(
  cd "${root_dir}/contracts"
  "${slither_bin}" . \
    --compile-force-framework foundry \
    --exclude-dependencies \
    --filter-paths 'lib|test|script' \
    --json "${report}"
)
slither_status=$?
set -e

if [[ ! -s "${report}" ]]; then
  printf 'Slither produced no JSON report (exit %s).\n' "${slither_status}" >&2
  exit 1
fi

python3 "${root_dir}/scripts/check-slither.py" "${report}"
