#!/usr/bin/env bash
set -euo pipefail

deployments_url=https://developers.uniswap.org/deployments.json
record=$(curl --fail --location --silent --show-error --max-time 20 "$deployments_url" \
  | jq -cer '
      [.records[]
        | select(.chainId == 1301 and .protocol == "v4" and .contract == "PoolManager" and .status == "active")]
      | if length == 1 then .[0] else error("expected exactly one active Unichain Sepolia v4 PoolManager") end
    ')

address=$(jq -er '.address | select(test("^0x[0-9a-fA-F]{40}$"))' <<<"$record")
printf '%s\n' "$address"
