# ARBFOLD Live Demo Guide

This is the difference between the product demo and the benchmark chart.

## What is live

The dashboard connects directly to Unichain Sepolia and verifies:

- chain ID `1301`;
- the canonical v0.1 transaction receipt;
- bytecode for the official `PoolManager`, coordinator, router and three hooks;
- current fold-call and fold-round counters;
- all six current reserves from the three hook-owned CPMMs.

If any check fails, execution remains disabled. This public deployment is v0.1.
The five-size comparison remains a separate controlled Foundry artifact and is
never represented as a comparison between two mutable live transactions.

The interactive scenario uses three valueless assets across three pools:
`ARFX/ARFY`, `ARFX/ARFZ` and `ARFY/ARFZ`. The default user swap is 10,000 ARFY
for ARFX. It moves the first pool and makes the resulting
`ARFY → ARFX → ARFZ → ARFY` cycle visible before any wallet action.

## Understand it without a wallet

1. Open <https://danelerr.github.io/arbfold-uhi10/>.
2. Click `Open Swap Lab`.
3. Confirm that the first view identifies all three valueless tokens and pools.
4. Inspect the current ARFY → ARFX quote and the cycle explanation. This quote
   is calculated from public reserves and requires no signature or state change.
5. Expand `Explore another route` only if you want to inspect one of the six
   supported directions. The default stays ARFY → ARFX to match the canonical
   internal B→A benchmark and deployment path.

## Execute a persistent testnet transaction

Requirements:

- an injected browser wallet supporting EIP-1193 or EIP-6963;
- Unichain Sepolia selected (the page can request adding/switching it);
- a small amount of Unichain Sepolia ETH for gas.

A Foundry/Cast keystore is not exposed to webpages and cannot satisfy the first
requirement. Use a browser wallet extension or open the demo inside a mobile
wallet browser. If no provider is detected, the panel now says so explicitly
and offers an installation/open-in-wallet link.

Steps:

1. Click `Open Swap Lab`.
2. Click the single `Connect wallet` action. Network switching is a separate
   contextual action when required.
3. Leave the default 10,000 ARFY input for the clearest demo.
4. If tokens are missing, confirm `Get … test ARFY`. It mints only the
   deficit. Return to the lab and click `Allow this demo swap`; this second prompt
   approves exactly the selected amount and is never opened automatically.
5. Click `Run swap + ARBFOLD` and confirm one atomic transaction.
6. Wait for the receipt-driven result. It must show:
   - an explorer link for the wallet's transaction;
   - gas used;
   - user output;
   - `FoldRound` count;
   - `FoldCompleted` residual.

The UI re-quotes immediately before signing, applies a 0.5% minimum-output guard
and uses a 15-minute deadline. It never requests a
private key. Contracts are research-only, testnet assets have no value and the
deployment is not authorized for production deposits.

## One-sentence explanation

> A cyclic reference replays each arbitrage leg and reinjects profit; ARBFOLD
> lets one `fold()` call process multiple runtime-checked direct settlement
> rounds inside the originating unlock.

## Public canonical transaction

The v0.1 canonical contract path was executed with the dedicated testnet wallet
on 2026-08-30:

- transaction: [`0x3429…2022`](https://sepolia.uniscan.xyz/tx/0x3429f2c09fa7a60283116593a1e0b19f9732c7c88f79fdf0b49e631aabed2022);
- input: 100,000 ARFY;
- output: 30.220363129338304386 ARFX;
- fold rounds: 2 in one `fold()` call;
- residual cyclic profit: 0 wei A.

Run `npm run check:live` to verify the exact runtime size/hash of the official
PoolManager and all eight ARBFOLD contracts, manager/token/hook bindings, the
canonical receipt's decoded swap/fold semantics, its historical pre/post
reserve snapshots, current reserves, public simulation funding/allowance and a
fresh end-to-end RPC dry-run.

Run `npm run check:sources` to query Sourcify and require matching creation and
runtime source for the coordinator, three hooks, router and three demo tokens.
