#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
report="${SLITHER_REPORT:-${root_dir}/contracts/slither-report.json}"

if [[ -n "${SLITHER:-}" ]]; then
  if [[ "${SLITHER}" == */* ]]; then
    slither_bin="${SLITHER}"
    [[ "${slither_bin}" == /* ]] || slither_bin="${root_dir}/${slither_bin}"
    if [[ ! -x "${slither_bin}" ]]; then
      printf 'SLITHER is not executable: %s\n' "${slither_bin}" >&2
      exit 1
    fi
  elif command -v "${SLITHER}" >/dev/null 2>&1; then
    slither_bin="$(command -v "${SLITHER}")"
  else
    printf 'SLITHER command not found: %s\n' "${SLITHER}" >&2
    exit 1
  fi
elif command -v slither >/dev/null 2>&1; then
  slither_bin="$(command -v slither)"
elif [[ -x "${root_dir}/.venv/bin/slither" ]]; then
  slither_bin="${root_dir}/.venv/bin/slither"
else
  printf '%s\n' \
    'Slither is required for the release gate.' \
    'Create the repository virtual environment and install CI dependencies:' \
    '  python3 -m venv .venv' \
    '  .venv/bin/pip install -r requirements-ci.txt' >&2
  exit 1
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
