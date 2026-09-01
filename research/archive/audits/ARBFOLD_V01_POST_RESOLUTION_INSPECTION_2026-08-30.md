# ARBFOLD v0.1 — Inspección posterior a la resolución final

Fecha: 2026-08-30  
Baseline Git: `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`  
Estado revisado: working tree local no comprometido, posterior a
[`ARBFOLD_V01_FINAL_REAUDIT_RESOLUTION_2026-08-30.md`](ARBFOLD_V01_FINAL_REAUDIT_RESOLUTION_2026-08-30.md)  
Postura: revisión diferencial, cumplimiento manual de especificación, mutación
adversarial de consumidores y reproducción completa. La revisión no modificó
el core, los validadores ni los artefactos del implementador; este informe es el
único archivo añadido por el auditor.

## Resumen ejecutivo

El agente corrigió correctamente los tres objetivos inmediatos de la ronda
anterior:

1. el porcentaje, los totales de gas, el ahorro absoluto, los basis points, los
   gates, residual/tolerancia ausentes y los pares exactos ya fallan cerrados;
2. los cuatro strings decimales están limitados realmente a `uint256`;
3. `make verify-release` encuentra el Slither versionado en `.venv` y termina
   con código cero desde el shell original.

El core Solidity no cambió, las cifras económicas se regeneran, los hashes
coinciden y tanto las suites como el gate completo pasan. La evidencia real
continúa soportando el resultado principal: a 100k, `544,219` frente a
`375,171` gas (`31.062495%` menos); a 25k, `409,402` frente a `329,777`
(`19.449099%` menos). No encontré indicios de resultados inventados o de una
manipulación del benchmark actual.

Sin embargo, la remediación no cierra todavía todo el contrato semántico que se
publica. Los validadores aceptan contradicciones en la identidad del workload,
la topología de rondas y las secciones que respaldan los claims de `196/196` y
seis rutas. Esas entradas adulteradas llegan a `PASS` en `video-proof` y a
`STATUS READY_FOR_MANUAL_FINISH` en preflight. El raw real no está afectado y
el generador source-bound vuelve a producirlo correctamente, por lo que el
impacto sigue siendo de integridad de publicación, no una vulnerabilidad
onchain ni una refutación del resultado medido.

| Severidad | Cantidad |
|---|---:|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 1 |

**Veredicto:** el agente hizo bien la corrección solicitada y cerró los bypasses
concretos anteriores, pero declaró cierre total demasiado pronto. Apruebo el
core y el benchmark real; mantengo la publicación local en aprobación
condicional hasta completar una última remediación pequeña en
schema/validadores/tests. No hace falta tocar contratos, economía ni deployment.

## Hallazgos

### Medium — El proof/preflight todavía acepta una narrativa mecánica y evidencia auxiliar contradictorias

**Archivos:**

- [`app/benchmark-core.js`](../app/benchmark-core.js#L26)
- [`scripts/validate-benchmark-evidence.mjs`](../scripts/validate-benchmark-evidence.mjs#L14)
- [`scripts/video-proof.sh`](../scripts/video-proof.sh#L23)
- [`scripts/submission-preflight.mjs`](../scripts/submission-preflight.mjs#L59)
- [`research/reassess_arbfold_v01.py`](../research/reassess_arbfold_v01.py#L97)
- [`tests/dashboard/benchmark-evidence.test.mjs`](../tests/dashboard/benchmark-evidence.test.mjs#L270)
- [`tests/test_arbfold_v01_reassessment.py`](../tests/test_arbfold_v01_reassessment.py#L160)

`validateBenchmarkPayload` aplica correctamente la aritmética de gas y los
seis gates revisados a las cinco filas congeladas. No obstante, varios campos
que el proof imprime o que sustentan copy público sólo reciben type-check —o no
se inspeccionan en absoluto—:

- no relaciona `input_wei` con `input_tokens`;
- no exige `reference_arbitrage_swaps == 3 * reference_rounds`;
- no exige `reference_reinjections == reference_rounds`;
- no relaciona `direct_rounds` con `reference_rounds`;
- no fija `direct_fold_calls == 1` para estas filas congeladas;
- no fija el path canónico ni su label;
- no relaciona residual de referencia y directo, ni exige el residual canónico
  cero que afirma el formulario;
- ignora por completo `dense_sweep`, `dense_sweep_summary` y
  `six_path_matrix`.

El mismo límite existe en Python. `validate_frozen_grid_semantics` comprueba
tipos, aritmética de gas, pares exactos y reservas lossless, pero no las
relaciones de workload/rondas. `build_result` confía en los contadores del
summary denso, valida las filas densas usando el `absolute_gas_saved` publicado
sin derivarlo y considera completa la matriz de rutas sólo porque su longitud
es seis.

#### Reproducción

Una única mutación de la fila 100k produjo:

```text
reference_rounds = 999

VIDEO_EXIT=0
Reference rounds:  999 (6 swaps + 2 reinjections)
Direct rounds:     2 in 1 fold() call
PASS — v0.1 row arithmetic, exact pairs, residual/tolerance fields,
and consumer-recomputable gates validated.

PREFLIGHT_EXIT=0
AUTOMATED_CHECKS 25/25 PASS
STATUS READY_FOR_MANUAL_FINISH
```

Las siguientes siete mutaciones independientes también fueron aceptadas por el
validador compartido, `video-proof --evidence-only` y preflight:

| Mutación | Validator | Video | Preflight |
|---|---:|---:|---:|
| `reference_rounds = 999` | 0 | `PASS` | `READY` |
| `reference_arbitrage_swaps = 999` | 0 | `PASS` | `READY` |
| `reference_reinjections = 999` | 0 | `PASS` | `READY` |
| `direct_rounds = 999` | 0 | `PASS` | `READY` |
| `direct_fold_calls = 999` | 0 | `PASS` | `READY` |
| eliminar sweep y summary densos | 0 | `PASS` | `READY` |
| eliminar la matriz de seis rutas | 0 | `PASS` | `READY` |

También pasan `input_wei = 0`, un path label falso, residuales incompatibles y
un summary que dice `0/0` filas accionables. En Python se reprodujo lo
siguiente:

- las cinco mutaciones de rondas/calls fueron aceptadas por
  `validate_frozen_grid_semantics`;
- `build_result()` aceptó y publicó `actionable_rows = 0` y
  `cheaper_actionable_rows = 0` aunque el sweep seguía conteniendo 196;
- `build_result()` aceptó seis entradas con el mismo path `0` como una matriz
  “completa”;
- `build_result()` aceptó una fila densa con total directo, ahorro y porcentaje
  incompatibles, manteniendo todos sus checks en `true`.

Esto contradice directamente la copy activa que afirma dos rondas, seis swaps,
dos reinyecciones, residual canónico cero, 196/196 workloads accionables y una
matriz de seis rutas distintas. La defensa importante es que el raw versionado
actual fue regenerado desde Forge y es coherente; el defecto aparece al usar
los validadores como prueba autónoma frente a evidencia dañada.

**Corrección recomendada:** ampliar la autoridad semántica única, sin tocar
Solidity:

1. validar losslessly la identidad del workload y las relaciones exactas de
   rondas/swaps/reinyecciones/fold calls/path;
2. declarar explícitamente la política de residual y derivar cualquier claim
   canónico desde el row validado;
3. exigir 200 filas densas ordenadas de 1k a 200k, recalcular su aritmética y
   derivar el summary completo desde ellas;
4. exigir paths únicos `0..5`, labels canónicos y semántica completa de cada
   fila de la matriz;
5. hacer que preflight valide los datos que respaldan cada frase pública, no
   sólo que la frase exista;
6. si `input_wei` y reservas no pueden seguir siendo lossless como números JS,
   migrarlos a strings en un schema v4 o dejar explícita y ejecutable la
   verificación Python/source-bound antes de emitir un éxito global.

### Low — La cobertura de mutaciones de gas no es exhaustiva por fila como afirma la resolución

**Archivos:**

- [`tests/dashboard/benchmark-evidence.test.mjs`](../tests/dashboard/benchmark-evidence.test.mjs#L181)
- [`tests/test_arbfold_v01_reassessment.py`](../tests/test_arbfold_v01_reassessment.py#L160)
- [`ARBFOLD_V01_FINAL_REAUDIT_RESOLUTION_2026-08-30.md`](ARBFOLD_V01_FINAL_REAUDIT_RESOLUTION_2026-08-30.md#L89)

Las mutaciones committed de porcentaje, ambos totales, ahorro absoluto y basis
points se aplican sólo a `frozen_grid[3]`, la fila 100k, tanto en JavaScript
como en Python. La resolución dice que la matriz cubre esas mutaciones “across
all relevant rows”, lo cual no describe el test versionado.

No encontré un fallo funcional derivado: una matriz independiente de esta
auditoría mutó los cinco campos en cada una de las cinco filas y el validador
rechazó las `25/25` entradas. El riesgo es de regresión futura y de exactitud de
la evidencia de tests, no del raw actual.

**Corrección recomendada:** envolver esas cinco mutaciones en un loop sobre las
cinco filas en ambas suites y, al menos una vez por fila, enviarlas también por
los dos consumidores. Ajustar la resolución para describir exactamente la
cobertura ejecutada.

## Matriz de cumplimiento

| Requisito de la remediación | Estado | Evidencia |
|---|---|---|
| Derivar totales, ahorro, bps y porcentaje | Cumple | Mutaciones originales fallan; aritmética half-even exacta |
| Recomputar los seis gates revisados | Cumple | Missing/false/contradictory fallan |
| Residual y tolerancia requeridos y bien tipados | Cumple | Missing/null/negative/fractional fallan en las cinco filas |
| Pares output/reward lossless | Cumple | Strings + `BigInt`; mutaciones ±1 wei fallan |
| Límite real de `uint256` | Cumple | `2**256-1` pasa; `2**256` y strings excesivos fallan |
| Unificar proof y preflight en el validador JS | Cumple | Ambos importan/ejecutan la misma autoridad |
| No anunciar recomputación JS de reservas lossless | Cumple | Boundary documentada y wording restringido |
| Slither usable fuera de `PATH` | Cumple | Fallback `.venv/bin/slither`; override inválido falla |
| Preservar core, históricos y deployment | Cumple | Hashes, Git diff y plan `not-broadcast` |
| Fail-closed para toda evidencia que alimenta copy pública | Parcial | Hallazgo Medium |
| Mutaciones de gas en todas las filas | Parcial | Hallazgo Low; comportamiento actual sí rechaza 25/25 |

## Verificación reproducida

| Comprobación | Resultado observado |
|---|---|
| `git diff --check` | PASS |
| `make verify-release` literal | PASS, exit 0 |
| Foundry default | 82/82 PASS |
| Foundry release completo, seed `0x1057` | 82/82 PASS |
| Release fuzz | 10,000 runs; invariantes 256 × 20,480 llamadas |
| Solidity arithmetic fuzz | 50,000 runs por cada una de dos propiedades |
| Diferencial aritmético Python | 50,000 muestras; 0 direction mismatches |
| Python ARBFOLD | 26/26 PASS |
| Dashboard/typecheck | 24/24 PASS |
| Mutaciones de gas independientes, todas las filas | 25/25 rechazadas |
| Build dashboard | PASS; warning no bloqueante por chunk de 518.51 kB |
| `make video-proof` con raw real | PASS; dos rondas, valores exactos, sin `null` |
| Preflight local | 25/25 PASS; tres campos humanos pendientes |
| Preflight público | 28/29; sólo falla el README v0 aún no publicado |
| Verificador público v0 | PASS en chain 1301, bloque 61,263,521; read-only |
| Coverage | 98.6063% líneas, 91.0714% branches, 100% funciones |
| Slither 0.11.3 | 25 resultados; 9 Medium revisados; 0 High/Medium sin resolver |
| Deployment smoke | PASS |
| Checksums, generator, manifests y reassessments | PASS |
| Diff de benchmarks históricos | Vacío |

El profile release completo fue ejecutado adicionalmente porque
`make test-release-fuzz` filtra deliberadamente tres suites; el comando completo
también produjo 82/82. Por tanto, la afirmación “82 tests en default y release”
sí es reproducible.

## Provenance y estado de release

- `HEAD` y `origin/main` permanecen en
  `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`.
- `ArbFoldCoordinator.sol` permanece en
  `10f1f260ac72650d3b17f0a69af227e511955f0d27121a8d325e89fb85e54f5d`.
- Raw optimizado:
  `4016fe4db7ddc526d6cdc3b07b7e9bff148829d1f05830b2286bcae59023dd09`.
- Reassessment v0.1:
  `7b0873f1a7de15aef6f117d7e882f08ea22fc433fe8ab7d5792bb42a0f6c2e05`.
- Source manifest:
  `c0e0f3e06d38700c602887cf8cb5f2d9d001b443b3be95d1414018bda771fb7e`.
- Forge output:
  `9fcdf9aef99a4c1a0d806b225cae9ec900c62a2d7fe37993ee6e8dfe604ffccd`.
- El plan v0.1 sigue `not-broadcast`, con `publicationCommit: null`,
  `broadcastPerformed: false`, cero transacciones y sin demo canónica v0.1.
- Los tres campos humanos continúan pendientes: video final, email de cohorte y
  X handle.
- El repositorio público sigue sirviendo v0, coherente con no haber autorizado
  commit/push/publicación. El deployment público verificable sigue siendo v0,
  no el candidato local v0.1.

## Conclusión

La corrección fue buena y material: los dos hallazgos anteriores quedaron
resueltos, Slither ya funciona desde el comando literal y el paquete real es
reproducible. No se destruyó el proyecto ni apareció evidencia de una cifra
fabricada.

Lo que falta es acotar o completar la palabra “validado”. Hoy la autoridad
semántica protege muy bien las cinco filas congeladas en gas/output/reward,
pero no protege todavía toda la historia que esas filas y las secciones
auxiliares cuentan. La siguiente tarea correcta es una remediación localizada
en validadores y tests, seguida por regeneración y repetición del mismo release
gate. No recomiendo rediseñar ni redesplegar el core.

**Confianza:** alta en el core y las cifras actuales; alta en el cierre de los
bypasses originales; alta en los bypasses residuales reproducidos; sin
conclusión de production readiness.
