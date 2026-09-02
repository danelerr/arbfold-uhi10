# Comprobaciones read-only — 2026-09-02

HEAD observado: `17c4e5cc01a6951c5ae272e28c6c76615bd64fa9`.

RPC: `https://sepolia.unichain.org`, chain id esperada 1301. Todas las operaciones de esta sección fueron lecturas o simulaciones; no se emitió ninguna transacción.

## Suite local

Comando: `cd contracts && forge test --summary`.

Resultado sobre el HEAD indicado: 82 passed, 0 failed, 0 skipped, incluyendo unitarias, negative paths, deployment, fuzz e invariantes.

## Verificador Solidity sobre el deployment público

Comando: `forge script script/VerifyArbFoldDeployment.s.sol:VerifyArbFoldDeployment --rpc-url https://sepolia.unichain.org` con las diez direcciones del manifiesto y `SOLVER=0x75464f762bc50d0A0B127ab5a085504BF102Bb88`.

Resultado: `ARBFOLD deployment verification PASS`.

Esto ejercitó las comprobaciones de `contracts/script/VerifyArbFoldDeployment.s.sol:L56-L140`: código, bindings, configuración, pool keys, permisos, operator, reservas/claims, backing para el solver indicado, quote y tamaños EIP-170.

Las 28 entradas de `deploymentTransactions` resolvieron a receipts exitosos, todas enviadas por el deployer del manifiesto, entre los bloques 61277227 y 61277343. No hubo hash ausente ni receipt fallido.

## Runtime público contra manifiesto

Lectura independiente `eth_getCode`; tamaño y `keccak256`:

| Contrato | Bytes | Hash observado | Coincide |
| --- | ---: | --- | --- |
| poolManager | 24009 | `0x2566e42d45723eef05d7253a7b7c140a6da61992594525fc66d06b4a973b5d0b` | sí |
| coordinator | 10058 | `0xb9c0ae81a34c9c63399ea16149e03b1e1f816f90e33b899673993681cf6ebd19` | sí |
| hookAB | 14728 | `0xf341a37317ca2ba020808bfa20f6afba21e754566f0e6d9bcdfab2ed2bfb07de` | sí |
| hookBC | 14728 | `0xf341a37317ca2ba020808bfa20f6afba21e754566f0e6d9bcdfab2ed2bfb07de` | sí |
| hookAC | 14728 | `0xf341a37317ca2ba020808bfa20f6afba21e754566f0e6d9bcdfab2ed2bfb07de` | sí |
| router | 4489 | `0xe96007674fb271709eae40ed4460d57e59335d7a257397e31cd8c727cc754aef` | sí |
| tokenA | 1862 | `0xf36bc451f50ffe2a737bb6e176a0abe131c05443a2d90b3cac13089d526894d9` | sí |
| tokenB | 1862 | `0xf36bc451f50ffe2a737bb6e176a0abe131c05443a2d90b3cac13089d526894d9` | sí |
| tokenC | 1862 | `0xf36bc451f50ffe2a737bb6e176a0abe131c05443a2d90b3cac13089d526894d9` | sí |

Son nueve targets totales: PoolManager más coordinator, tres hooks, router y tres tokens. El manifiesto los fija en `deployments/unichain-sepolia-1301-v0.1.json:L91-L128`; `validateManifest` exige exactamente esas claves (`app/live-core.js:L7-L17`, `L85-L94`) y el checker compara los nueve (`scripts/check-live-demo.mjs:L65-L87`).

## Artefactos actuales contra runtime público

Se recompilaron/leyeron los artefactos Foundry con `contracts/foundry.toml`. Para coordinator, hooks y router se excluyeron únicamente los offsets declarados por solc en `deployedBytecode.immutableReferences`; para los tokens no se excluyó ningún byte.

| Contrato | Bytes inmutables excluidos | Mismatches restantes |
| --- | ---: | ---: |
| coordinator | 960 | 0 |
| hookAB | 928 | 0 |
| hookBC | 928 | 0 |
| hookAC | 928 | 0 |
| router | 288 | 0 |
| tokenA/B/C | 0 | 0 |

Los valores inmutables y de storage relevantes se comprobaron mediante getters/bindings en el verificador Solidity. `git diff 6670e626a836db82a2810497812009c1394b0b20..17c4e5cc01a6951c5ae272e28c6c76615bd64fa9 -- contracts/src contracts/script` no produjo diferencias. El `dependencyCommit` del manifiesto coincide con el HEAD del submódulo: `12048bb17b93ad9ed683aff9c34b89596280c77d`.

Esta comparación de artefactos cubre los ocho targets propios, no el PoolManager oficial. Para éste se verificaron dirección oficial congelada, runtime publicado y comportamiento/bindings, pero `sourceVerification` sigue siendo `not-available` (`deployments/unichain-sepolia-1301-v0.1.json:L50`).

## Transacción canónica y snapshots

Tx: `0x3429f2c09fa7a60283116593a1e0b19f9732c7c88f79fdf0b49e631aabed2022`.

- status: success;
- block: 61277493;
- from: `0x75464f762bc50d0A0B127ab5a085504BF102Bb88`;
- to: router `0xe817DFB3d1F7cd07f165cb5FDa83CD63179996aE`;
- `SwapAndFold`: input 100.000 B, reverse, output `30220363129338304386` A;
- dos `FoldRound`, rewards `85837333407666227` y `11705708503257`;
- `FoldCompleted(rounds=2,residualProfit=0)`.

La suma de rewards es `85849039116169484`; receipt, topología y todos los valores coinciden con `deployments/unichain-sepolia-1301-v0.1.json:L57-L84` y son comprobados por `scripts/check-live-demo.mjs:L95-L122`.

`network()` fijado al bloque 61277492 devolvió exactamente las seis `preReserves`; la lectura al bloque 61277493 devolvió exactamente las seis `postReserves`. El checker hace ambas comparaciones por igualdad BigInt campo a campo (`app/live-core.js:L112-L118`, `scripts/check-live-demo.mjs:L153-L200`). El estado vivo posterior es distinto legítimamente por actividad posterior y se lee por separado.

## Aprobación de la cuenta de simulación

Tx: `0xbc1f63834e45a6e18a98d8cb2d8217b742b81e9293c64e4913f90138f15d5ea2`.

- status: success;
- block: 61478030;
- from: cuenta/deployer `0x75464f762bc50d0A0B127ab5a085504BF102Bb88`;
- to: token B `0x4442c33f831673C91341361DAC7D97d9FD8b01D4`;
- calldata decodificada: `approve(0xe817DFB3d1F7cd07f165cb5FDa83CD63179996aE, 25000000000000000000000)`.

La transacción fija la aprobación en 25.000e18. La lectura actual sigue siendo exactamente `25000000000000000000000`, igual a `rpcSimulation.maximumInput`; el balance actual es `19304237518578754546031775` B. La precondición pública de capacidad está satisfecha.

El checker valida status/from/to/block de esa evidencia y relee allowance/balance (`scripts/check-live-demo.mjs:L70-L94`, `L202-L235`). No decodifica el calldata de aprobación; la correspondencia spender/amount anterior fue una comprobación independiente.

## Estado actual leído

En la última ejecución, al bloque 61496939:

- `totalFoldCalls = 6`;
- `totalFoldRounds = 11`;
- `totalSolverRewards = 1187722409556197827628`;
- `lastResidualProfit = 480566246567`, menor que `RESIDUAL_THRESHOLD = 1000000000000`.

Reservas `(abA,abB,bcB,bcC,acA,acC)`:

`(16804120872694556506080, 260393493708708727904131, 535368987712536726064094, 1871312954673755209519836, 2478498328565199051121, 135464045326244790480164)`.

El residual observado satisface el umbral. El checker lo imprime pero no aplica ese guard (`scripts/check-live-demo.mjs:L256-L261`); además, el contrato no garantiza el umbral si un fold agota `MAX_ROUNDS` (`contracts/src/ArbFoldCoordinator.sol:L144-L158`, `L238-L244`). Es un límite de postcondición, no un fallo observado en el deployment.

## Control actual de LP

Lecturas `totalSupply()` y `balanceOf(deployer)`:

| Hook | Total supply | Balance deployer | Fracción |
| --- | ---: | ---: | ---: |
| AB | `18257418583505537115223` | `18257418583505537115223` | 100% |
| BC | `1000000000000000000000000` | `1000000000000000000000000` | 100% |
| AC | `18257418583505537115223` | `18257418583505537115223` | 100% |

Los LP tokens son ERC-20 transferibles (`contracts/src/ArbFoldHook.sol:L21`) y `removeLiquidity` es público (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol:L192-L218`). Quien controle todo el supply puede retirar todo; `_burn` admite el estado final `(0,0)` (`contracts/src/ArbFoldHook.sol:L159-L169`). Eso constituye autoridad de disponibilidad sobre cada pool y puede dejar `quote`/`fold` fuera del dominio, pero no demuestra una extracción de fondos ajenos: actualmente el deployer es el único LP y los tokens son activos de demo con mint abierto.

## `npm run check:live`

Resultado actual: exit code 0, `PASS: ARBFOLD v0.1 live demo deployment verified`.

Salida relevante:

```text
chain=1301 block=61496939 canonicalTx=0x3429f2c09fa7a60283116593a1e0b19f9732c7c88f79fdf0b49e631aabed2022
foldCalls=6 foldRounds=11 residualWeiA=480566246567
dryRunInput=1000000000000000000000 dryRunOutput=64094559340580528384
signedPathMinOut=63774086543877625742 signedPathGas=201150 bufferedGas=241380
```

El PASS establece identidad exacta contra el manifiesto, semántica canónica, snapshots, bindings básicos y operatividad read-only para 1.000 B. No establece verificación de fuente, historial completo, pool keys/operator/claims/backing actuales ni que una simulación de 25.000 B se ejecute; el máximo sólo se usa como requisito de balance/allowance.
