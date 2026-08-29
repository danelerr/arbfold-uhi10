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
`ARFX/ARFY`, `ARFX/ARFZ` and `ARFY/ARFZ`. The default user swap is 10,000 ARFX
for ARFY. It moves the first pool and makes the resulting
`ARFX → ARFY → ARFZ → ARFX` cycle visible before any wallet action.

## Understand it without a wallet

1. Open <https://danelerr.github.io/arbfold-uhi10/>.
2. Click `Open Swap Lab`.
3. Confirm that the first view identifies all three valueless tokens and pools.
4. Inspect the current ARFX → ARFY quote and the cycle explanation. This quote
   is calculated from public reserves and requires no signature or state change.
5. Expand `Explorar otra ruta` only if you want to inspect one of the six
   supported directions. The default stays ARFX → ARFY for the clearest demo.

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
2. Click the single `Conectar wallet` action. Network switching is a separate
   contextual action when required.
3. Leave the default 10,000 ARFX input for the clearest demo.
4. If tokens are missing, confirm `Obtener … ARFX de prueba`. It mints only the
   deficit. Return to the lab and click `Permitir este swap`; this second prompt
   approves exactly the selected amount and is never opened automatically.
5. Click `Ejecutar swap + ARBFOLD` and confirm one atomic transaction.
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
