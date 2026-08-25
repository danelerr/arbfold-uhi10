# ARBFOLD Live Demo Guide

This is the difference between the product demo and the benchmark chart.

## What is live

The dashboard connects directly to Unichain Sepolia and verifies:

- chain ID `1301`;
- the canonical and latest interactive transaction receipts;
- bytecode for the official `PoolManager`, coordinator, router and three hooks;
- current fold-call and fold-round counters;
- all six current reserves from the three hook-owned CPMMs.

If any check fails, execution remains disabled. The five-size gas comparison is
a separate frozen Foundry artifact and is never represented as live chain data.

## Test without a wallet

1. Open <https://danelerr.github.io/arbfold-uhi10/#live-demo>.
2. Confirm the green `Connected to Unichain Sepolia` state.
3. Change `Demo B input` if desired; the public range is 100–25,000.
4. Click `Dry-run deployed swap + fold (no wallet)`.
5. Expect a result shaped like:

```text
PASS · 1,000 Demo B → <live output> Demo A · estimated <live gas> gas
· no signature · no state change
```

This is an `eth_call` through the deployed `ArbFoldRouter`; it executes the
complete contract path against current state. It is not a transaction and does
not claim to change reserves.

## Execute a persistent testnet transaction

Requirements:

- an injected EVM wallet;
- Unichain Sepolia selected (the page can request adding/switching it);
- a small amount of Unichain Sepolia ETH for gas.

Steps:

1. Click `Connect wallet` and approve account access.
2. Leave the default 1,000 Demo B input for the clearest demo.
3. Click `Mint + approve demo input`. Demo B is permissionlessly mintable and
   valueless. Depending on existing balance/allowance, the wallet asks for zero,
   one or two preparation transactions.
4. Click `Execute swap + fold` and confirm one atomic transaction.
5. Wait for the receipt panel. It must show:
   - an explorer link for the wallet's transaction;
   - block and gas used;
   - user output;
   - `FoldRound` count and solver reward;
   - `FoldCompleted` residual;
   - the six reserves before and after.

The UI quotes first and applies a 0.5% minimum-output guard. It never requests a
private key. Contracts are research-only, testnet assets have no value and the
deployment is not authorized for production deposits.

## One-sentence explanation

> A normal cyclic backrun performs three AMM swaps and then reinjects profit;
> ARBFOLD lets three cooperating v4 pools reach the equivalent safe reserve
> state through one verified direct transition inside the originating unlock.

## Public validation transaction

The wallet path was independently rerun on 2026-08-25:

- transaction: [`0x78f325…e7927`](https://sepolia.uniscan.xyz/tx/0x78f32562596101d0ea3ca35dd3bf9c4fc0054bd788c2bfa1b96886c7bfce7927);
- input: 1,000 Demo B;
- output: 0.291279366794057286 Demo A;
- fold rounds: 1;
- residual cyclic profit: 0 wei A.

Run `npm run check:live` to verify bytecode, receipts, current reserves, public
simulation funding/allowance and a fresh end-to-end RPC dry-run.
