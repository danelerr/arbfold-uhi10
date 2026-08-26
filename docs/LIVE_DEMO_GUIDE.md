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

The interactive scenario uses three valueless assets across three pools:
`ARFX/ARFY`, `ARFY/ARFZ` and `ARFZ/ARFX`. The user swaps ARFX for ARFY, moving
the first pool and opening the cycle that ARBFOLD folds directly.

## Test without a wallet

1. Open <https://danelerr.github.io/arbfold-uhi10/>.
2. Click `Run on testnet`.
3. Confirm the green `Deployment verified` state.
4. Expand `Preview without a wallet`.
5. Change the ARFX input if desired; the public range is 1,000–25,000 so the demo remains above the validated fold threshold.
6. Click `Preview transaction`.
7. Expect a result shaped like:

```text
Preview passed: 1,000 ARFX → <live output> ARFY
· about <live gas> gas · no signature · no state change
```

This is an `eth_call` through the deployed `ArbFoldRouter`; it executes the
complete contract path against current state. It is not a transaction and does
not claim to change reserves.

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

1. Click `Run on testnet`.
2. In step 1, click `Connect MetaMask` and approve account access.
3. In step 2, click `Get ARFX and allow demo swap`. ARFX is permissionlessly mintable and
   valueless. The page states whether the wallet will ask for one or two
   preparation confirmations before you click.
4. In step 3, leave the default 1,000 ARFX input for the clearest demo.
5. Click `Swap ARFX and run ARBFOLD` and confirm one atomic transaction.
6. Wait for the receipt panel. It must show:
   - an explorer link for the wallet's transaction;
   - gas used;
   - user output;
   - `FoldRound` count;
   - `FoldCompleted` residual.

The UI quotes first and applies a 0.5% minimum-output guard. It never requests a
private key. Contracts are research-only, testnet assets have no value and the
deployment is not authorized for production deposits.

## One-sentence explanation

> A normal cyclic backrun performs three AMM swaps and then reinjects profit;
> ARBFOLD lets three cooperating v4 pools reach the equivalent safe reserve
> state through one verified direct transition inside the originating unlock.

## Public validation transaction

The same signed contract path was executed from the public browser UI with the
dedicated testnet wallet on 2026-08-25:

- transaction: [`0x87a940…5deceb`](https://sepolia.uniscan.xyz/tx/0x87a940bc58558886fe7debc34373c9ccec5ce1db6143695b8b5c7063e75deceb);
- input: 1,000 ARFX;
- output: 0.290518911748886010 ARFY;
- fold rounds: 1;
- residual cyclic profit: 0 wei A.

Run `npm run check:live` to verify bytecode, receipts, current reserves, public
simulation funding/allowance and a fresh end-to-end RPC dry-run.
