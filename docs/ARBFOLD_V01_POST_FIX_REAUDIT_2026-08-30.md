# ARBFOLD v0.1 — Reauditoría posterior a la remediación de integridad

Fecha: 2026-08-30  
Baseline Git: `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`  
Estado revisado: working tree local no comprometido, posterior a
[`ARBFOLD_V01_POST_RESOLUTION_FIX_2026-08-30.md`](ARBFOLD_V01_POST_RESOLUTION_FIX_2026-08-30.md)  
Método: revisión diferencial, trazabilidad manual contra la solicitud,
mutación adversarial de los tres consumidores de evidencia y reproducción de
los gates completos. Este informe es el único cambio realizado por el auditor.

## Resumen ejecutivo

El agente corrigió materialmente y de forma correcta los dos hallazgos que se
le entregaron:

1. las contradicciones de identidad del workload, topología, residual, sweep
   denso y matriz de seis rutas ahora fallan cerradas antes de que video o
   preflight puedan publicar éxito;
2. las cinco derivaciones de gas se mutan en las cinco filas congeladas, tanto
   en JavaScript como en Python, y las 25 combinaciones son rechazadas.

El schema v4 conserva `input_wei` como decimal `uint256` lossless, el raw real
mantiene exactamente las mediciones aprobadas y `make verify-release` termina
con código cero. El core Solidity, el harness congelado, los benchmarks
históricos y el deployment público mantienen los hashes/estado capturados
antes de esta remediación. No encontré indicios de cifras inventadas, reservas
fabricadas ni una alteración encubierta del benchmark.

Queda un defecto residual de severidad baja: el documento dice que el payload
v4 completo es obligatorio, pero la autoridad JS/Python no incluye en ese
contrato semántico `source_tree_sha256` ni `compiler_matrix`. Suprimirlos o
fabricarlos todavía produce `PASS` en el video y un estado `READY` en
preflight. El raw versionado es correcto y el gate completo verifica el source
manifest por otra vía, por lo que esto no invalida ninguna cifra ni requiere
cambiar contratos; únicamente acota el significado de “full v4 evidence”.

| Severidad | Cantidad |
|---|---:|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 1 |
| Informational | 1 |

**Veredicto:** apruebo la remediación de los hallazgos solicitados y apruebo el
release candidate en lo técnico. Recomiendo una última corrección off-chain
pequeña antes de tratar el proof como validador del *payload completo*. No hace
falta tocar Solidity ni redesplegar por este hallazgo.

## Hallazgos

### Low — El “payload completo” no incluye provenance ni la matriz de compiladores en la autoridad semántica

**Archivos:**

- [`app/benchmark-core.js`](../app/benchmark-core.js#L467)
- [`scripts/video-proof.sh`](../scripts/video-proof.sh#L47)
- [`scripts/submission-preflight.mjs`](../scripts/submission-preflight.mjs#L63)
- [`research/reassess_arbfold_v01.py`](../research/reassess_arbfold_v01.py#L375)
- [`tests/dashboard/benchmark-evidence.test.mjs`](../tests/dashboard/benchmark-evidence.test.mjs#L117)
- [`ARBFOLD_V01_POST_RESOLUTION_FIX_2026-08-30.md`](ARBFOLD_V01_POST_RESOLUTION_FIX_2026-08-30.md#L16)

El raw v4 contiene nueve secciones top-level, entre ellas
`source_tree_sha256` y `compiler_matrix`. El reporte publica además un
experimento de cuatro configuraciones de compilador y explica por qué conserva
`no-ir-runs-200`.

`validateBenchmarkPayload()` valida exhaustivamente las siete secciones que
respaldan los claims mecánicos, pero no exige ni inspecciona los dos campos
anteriores. `validate_payload_semantics()` tiene el mismo límite. Python sí
compara el digest contra el manifest dentro de `build_result()`, y el release
gate ejecuta esa ruta, pero video y preflight sólo llaman a la autoridad JS.

#### Reproducción independiente

Cada mutación se aplicó por separado al raw real y se envió al validador CLI,
`video-proof --evidence-only` y preflight:

| Mutación | Validator | Video | Preflight |
|---|---:|---:|---:|
| eliminar `source_tree_sha256` | exit 0 | exit 0 + `PASS` | exit 0 + `READY` |
| reemplazar digest por 64 ceros | exit 0 | exit 0 + `PASS` | exit 0 + `READY` |
| eliminar `compiler_matrix` | exit 0 | exit 0 + `PASS` | exit 0 + `READY` |
| matriz ficticia de una fila | exit 0 | exit 0 + `PASS` | exit 0 + `READY` |

Esto contradice literalmente la afirmación “schema v4 makes the complete
payload mandatory” y el nombre del test que dice rechazar evidencia
incompleta. También vuelve demasiado amplia la frase “full v4 evidence
validated”. No contradice los claims principales que el proof enumera después
de los dos puntos: workload, rondas, residual, sweep, rutas, pares, gas y gates
sí se validan correctamente.

**Impacto:** integridad secundaria de publicación y precisión documental. El
raw actual tiene la matriz y el digest correctos; el generador los reproduce;
el source-manifest check y el reassessment Python pasan; ninguna ruta onchain
depende de estos campos.

**Corrección recomendada:** elegir una de estas dos fronteras y hacerla
explícita:

1. si el schema v4 completo es la frontera, exigir el conjunto top-level
   exacto, un digest hexadecimal de 64 caracteres y el schema completo de las
   cuatro filas del compiler matrix; cruzar la configuración seleccionada con
   la fila canónica y, en video/preflight, comparar el digest con el SHA-256
   real del source manifest y `environment.json`;
2. si el validador sólo pretende cubrir claims mecánicos, cambiar “complete
   payload”/“full v4 evidence” por “claim-bearing mechanical evidence” y
   documentar que provenance y compiler matrix pertenecen exclusivamente al
   gate de release.

En ambos casos deben añadirse las cuatro mutaciones anteriores a las suites y
a la matriz de consumidores.

### Informational — La resolución cuenta cinco publication gates, pero existen seis

La resolución afirma que “the five publication gates are recomputed”. El raw,
la constante `CONSUMER_RECOMPUTED_GATES`, los tests y el proof manejan seis:
outputs, rewards, residual, reservas/tolerancia, 25k y las cinco filas. Es sólo
una errata documental; el código recomputa correctamente los seis.

## Cierre de los hallazgos anteriores

| Requisito entregado al agente | Estado | Evidencia observada |
|---|---|---|
| `input_wei` string uint256 e identidad exacta en las tres secciones | Cumple | missing, formato, overflow y ±1 wei fallan |
| Topología completa en filas congeladas | Cumple | rondas/swaps/reinyecciones/direct rounds/fold call/path fallan cerrados |
| Caso 100k exactamente `2/6/2` frente a `2/1`, residual cero | Cumple | hard constraint JS y Python; proof deriva los valores |
| Threshold residual explícito, igualdad y límite | Cumple | `1000000000000`; mismatch y overflow rechazados |
| Sweep exactamente 200 filas ordenadas 1k–200k | Cumple | missing/short/long/duplicate/reorder/step fallan |
| Summary denso derivado: 196/196, primer 5k, 1k–4k cero | Cumple | derivación independiente JS/Python y boundary fijo |
| Seis rutas únicas y ordenadas `0..5` con mecánica completa | Cumple | duplicate/reorder/label/input/round/gas/pair/residual fallan |
| Proof y preflight derivan facts y rechazan bypasses auditados | Cumple | las 81 fixtures salen nonzero, sin `PASS` ni `READY` |
| Cinco campos de gas por cada una de cinco filas | Cumple | 25/25 mutaciones rechazadas en JS y Python |
| Regenerar sólo evidencia v0.1 y provenance | Cumple | hashes exactos; históricos preservados |
| No tocar Solidity, benchmark congelado ni deployment en esta ronda | Cumple | hashes capturados sin cambio; plan sigue `not-broadcast` |
| Payload top-level completo obligatorio | Parcial | hallazgo Low sobre digest/compiler matrix |

## Mutación adversarial reproducida

Los bypasses del informe anterior fueron repetidos manualmente. El resultado
actual es el esperado:

| Mutación histórica | Resultado actual |
|---|---|
| `reference_rounds = 999` | Rechazada por topología |
| `input_wei = "0"` | Rechazada por identidad del workload |
| eliminar sweep denso | Rechazada: se exigen 200 filas |
| summary denso falso | Rechazado al derivarlo de las 200 filas |
| ruta duplicada/reordenada/label falso | Rechazada |
| residual directo distinto | Rechazado |
| total denso incompatible con ahorro | Rechazado |

La suite versionada amplía esta matriz hasta 81 fixtures y ejecuta cada una a
través de los dos consumidores de publicación.

## Verificación reproducida

| Comprobación | Resultado observado |
|---|---|
| `git diff --check` | PASS |
| `shasum -a 256 -c research/CHECKSUMS.sha256` | PASS completo |
| `make verify-release` literal | PASS, exit 0 |
| Foundry default | 82/82 PASS |
| Foundry release completo, seed `0x1057` | 82/82 PASS |
| Release fuzz | 10,000 runs; invariantes 256 × 20,480 llamadas |
| Solidity arithmetic fuzz | 50,000 runs por cada una de dos propiedades |
| Diferencial aritmético Python | 50,000 muestras; 0 direction mismatches |
| Python ARBFOLD | 26/26 PASS |
| Dashboard/typecheck | 27/27 PASS |
| Consumer mutation matrix versionada | 81/81 rechazadas por validator/video/preflight |
| Build dashboard | PASS; warning no bloqueante por chunk de 524.12 kB |
| Deployment smoke | PASS |
| Coverage | 98.6063% líneas, 91.0714% branches, 100% funciones |
| Slither 0.11.3 | 25 resultados; 9 Medium revisados; 0 High/Medium sin resolver |
| `make video-proof` sobre raw real | PASS, sin valores `null` |
| Preflight local | 25/25 PASS; tres campos humanos pendientes |
| Preflight público | 28/29; sólo falta publicar el README v0.1, esperado |
| `npm run check:live` | PASS en chain 1301, bloque 61,268,682; read-only |

## Resultados y provenance

Las cinco mediciones congeladas continúan exactamente así:

| Input | Referencia | ARBFOLD v0.1 | Reducción |
|---:|---:|---:|---:|
| 10k | 407,292 | 327,669 | 19.549365% |
| 25k | 409,402 | 329,777 | 19.449099% |
| 50k | 544,219 | 375,171 | 31.062495% |
| 100k | 544,219 | 375,171 | 31.062495% |
| 200k | 544,209 | 375,160 | 31.063250% |

Hashes reproducidos:

| Artefacto | SHA-256 |
|---|---|
| Raw optimizado v4 | `37da310879312dcaf133d9fd3751f566c7c91d2570a428af0f9ca7a0e32e6c3e` |
| Reassessment v4 | `78edcc94a7784a27b31fd75ca41d7428eebd149d88265756113a716123ed0224` |
| Source manifest | `0d5e034b3ab5b63b05cea22ba08e0b43cd29415e9a0e505dba00e93ed431af2c` |
| Environment | `ce13cdfd011bfeffc0ffc7a517fc0245779b3e180c5fc541e709d3123ccea9ea` |
| Report | `9af3d3f331b8d1e3300779d8961f0cc4fbfb6372178cb81bdf5db6c57f26216b` |
| Forge output | `9fcdf9aef99a4c1a0d806b225cae9ec900c62a2d7fe37993ee6e8dfe604ffccd` |
| `ArbFoldCoordinator.sol` | `10f1f260ac72650d3b17f0a69af227e511955f0d27121a8d325e89fb85e54f5d` |
| Benchmark harness | `4b9c5e9f4bca1e81fcc94393cd6754587a4df68f8951fbe9e38f12da2f51c70c` |

`HEAD` y `origin/main` siguen en
`f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`. El plan v0.1 continúa
`not-broadcast`, sin transacciones ni canonical demo v0.1. Los tres campos
humanos siguen pendientes: video final, email de cohorte y X handle. La web y
el deployment públicos continúan siendo v0 hasta que exista autorización
separada para commit/push/publicación/deployment.

## Conclusión

La respuesta corta es: **sí, el agente hizo bien el trabajo solicitado**. El
Medium y el Low anteriores están cerrados, el benchmark real es reproducible y
la mejora de 25k/100k no es una alucinación. El defecto restante apareció al
poner a prueba una afirmación más amplia creada por la propia resolución; no
afecta el protocolo ni sus mediciones.

La próxima acción correcta es una micro-remediación de schema/wording/tests o,
si se prefiere aceptar esa frontera, documentarla. No se justifica tocar
Solidity ni redesplegar por esta reauditoría.

**Confianza:** alta en el cierre de los hallazgos anteriores, alta en las
mediciones/versionado actuales y alta en el bypass residual de provenance;
sin conclusión de production readiness.
