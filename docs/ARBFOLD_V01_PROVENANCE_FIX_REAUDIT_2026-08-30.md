# ARBFOLD v0.1 — Reauditoría final del fix de provenance

Fecha: 2026-08-30  
Baseline Git: `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`  
Estado revisado: working tree local no comprometido, posterior a
[`ARBFOLD_V01_PROVENANCE_VALIDATION_FIX_2026-08-30.md`](ARBFOLD_V01_PROVENANCE_VALIDATION_FIX_2026-08-30.md)  
Método: revisión diferencial focalizada, cumplimiento manual requisito por
requisito, mutación adversarial independiente y reproducción del release gate.
Este informe es el único archivo añadido por el auditor.

## Resumen ejecutivo

El agente cerró correctamente el último hallazgo Low. El schema v4 ahora exige
los nueve campos top-level exactos, la matriz de compiladores se valida y se
liga a las mediciones congeladas, y los consumidores Node comprueban que raw,
environment, source manifest y worktree pertenecen al mismo release antes de
emitir `PASS` o `READY`.

Las cuatro reproducciones del informe anterior y un environment incompatible
fallan cerrados en el validador, video y preflight. La suite amplía esa
cobertura a 98 fixtures raw y una mutación separada del environment. El
generador es determinista, los checksums coinciden y las cifras económicas no
cambiaron.

No se modificaron el core Solidity, el benchmark harness congelado, los
benchmarks históricos ni el deployment público. No encontré resultados
inventados, bypasses de provenance remanentes ni regresiones de seguridad.

| Severidad | Cantidad |
|---|---:|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| Informational | 1 |

**Riesgo global del cambio:** Low, limitado a validación y publicación
off-chain.  
**Recomendación:** **APPROVE**. No hace falta otra remediación técnica para
cerrar esta ronda y no hay motivo para tocar Solidity o redesplegar.

## Qué cambió

No existe un commit nuevo contra el cual construir un diff: `HEAD` y
`origin/main` continúan en `f9d46e8`. La comparación se hizo contra el informe
anterior, sus hashes capturados, mtimes y el contenido regenerado.

| Superficie | Cambio observado | Riesgo | Blast radius |
|---|---|---:|---:|
| [`app/benchmark-core.js`](../app/benchmark-core.js#L547) | Field set top-level exacto y compiler matrix congelada/derivada | Medium off-chain | 3 consumidores productivos directos/indirectos |
| [`scripts/benchmark-provenance.mjs`](../scripts/benchmark-provenance.mjs#L41) | Digest, manifest path set, hashes del worktree, environment y error digest | Medium off-chain | CLI, video proof y preflight |
| [`scripts/validate-benchmark-evidence.mjs`](../scripts/validate-benchmark-evidence.mjs#L19) | Usa la nueva autoridad de provenance | Low | video proof y uso CLI |
| [`scripts/submission-preflight.mjs`](../scripts/submission-preflight.mjs#L64) | Valida provenance antes de construir checks | Low | submission preflight |
| [`research/reassess_arbfold_v01.py`](../research/reassess_arbfold_v01.py#L555) | Verificación Python independiente equivalente | Low | reassessment/release gate |
| [`scripts/generate-v01-benchmark.py`](../scripts/generate-v01-benchmark.py#L480) | Generador valida schema/compiler/environment antes de escribir | Low | artefactos v0.1 |
| Suites JS/Python | Mutaciones de schema, compiler, manifest y environment | Low | regresión futura |
| Artefactos v0.1 | Nuevos digests source-bound; mediciones idénticas | Low | release candidate local |

No se eliminó ninguna validación histórica ni se reintrodujo un patrón retirado
por seguridad. Al permanecer toda la serie v0.1 sin commit, no existe git blame
útil para las líneas nuevas; el contexto histórico verificable termina en
`f9d46e8`.

## Cumplimiento de la solicitud

| Requisito | Veredicto | Evidencia |
|---|---|---|
| Exactamente nueve claves top-level y sin desconocidas | Implementado | `validateExactFieldSet`, `set(raw) == TOP_LEVEL_FIELDS` y tests de missing/unknown |
| Digest lowercase de 64 caracteres | Implementado | JS, Python y generador |
| Digest raw/environment igual al hash exacto del manifest | Implementado | SHA-256 sobre bytes del manifest en Node; equivalente Python |
| Manifest corresponde al worktree actual | Implementado | path set exacto de 19 entradas y digest de cada archivo |
| Cuatro configuraciones compiler, únicas y ordenadas | Implementado | field sets/status/configuración congelados |
| Gas, porcentaje y bytecode derivados/limitados | Implementado | round-half-even, enteros positivos y EIP-170 |
| Compile failure y `error_sha256` coherentes | Implementado | hash UTF-8 recalculado en Node/Python |
| Configuración seleccionada coincide con 100k y environment | Implementado | cruces raw/compiler/environment |
| Validator/video/preflight fallan antes de éxito | Implementado | reproducciones independientes y 98 fixtures versionadas |
| JS y Python coinciden | Implementado | 28/28 dashboard y 27/27 Python |
| “five gates” corregido a seis | Implementado | documento anterior y constante de seis gates |
| Mediciones preservadas | Implementado | cinco pares exactos y hashes reproducidos |
| Solidity/históricos/deployment preservados | Implementado | hashes y diff de scopes |
| Sin commit/push/Pages/deployment externo | Implementado | HEAD/origin sin cambio; plan `not-broadcast`; público sigue v0 |
| Tres campos humanos pendientes | Implementado | preflight local reporta exactamente tres |

## Mutación adversarial independiente

Cada fixture se creó desde el raw auténtico y se ejecutó separadamente por el
CLI, `video-proof --evidence-only` y preflight:

| Mutación | Validator | Video | Preflight |
|---|---:|---:|---:|
| eliminar `source_tree_sha256` | exit 1 | exit 1, sin `PASS` | exit 1, sin `READY` |
| digest de 64 ceros | exit 1 | exit 1, sin `PASS` | exit 1, sin `READY` |
| eliminar `compiler_matrix` | exit 1 | exit 1, sin `PASS` | exit 1, sin `READY` |
| compiler matrix ficticia de una fila | exit 1 | exit 1, sin `PASS` | exit 1, sin `READY` |
| environment selecciona `via-ir-runs-200` | N/A | exit 1, sin `PASS` | exit 1, sin `READY` |

También revisé directamente las defensas contra manifest incompleto, paths
absolutos/traversal, entradas duplicadas, digest de archivo incompatible,
compiler rows reordenadas/duplicadas, fields por status, gas, porcentaje,
bytecode y hash de error. No encontré un camino que alcance éxito con evidencia
contradictoria dentro del threat model local declarado.

## Hallazgos

### Sin hallazgos Critical/High/Medium/Low

La remediación satisface la especificación y cierra las reproducciones del
informe anterior. La superficie añadida no cruza límites onchain ni controla
valor; su función es rechazar evidencia local inconsistente.

### Informational — “No broadcast” debe entenderse como “no external/public broadcast”

La resolución afirma que no se realizó ningún broadcast. A la vez, el comando
obligatorio `make verify-release` ejecuta
[`scripts/smoke-deployment.sh`](../scripts/smoke-deployment.sh#L37), que inicia
Anvil en chain `31337` y usa `forge script --broadcast` dos veces contra ese
nodo efímero. Esto genera archivos locales bajo `contracts/broadcast/.../31337`.

No hubo transacción a Unichain ni a otra red externa, el manifest público no
cambió y el plan v0.1 sigue `not-broadcast`. Por tanto no es una violación de
seguridad ni un deployment público. Para evitar ambigüedad futura, la frase
documental precisa sería:

> No external/public broadcast or deployment was performed; the required
> release smoke test broadcast only to an ephemeral local Anvil chain 31337.

No considero esta precisión bloqueante ni requiere reabrir la implementación.

## Cobertura y verificación reproducida

| Comprobación | Resultado observado |
|---|---|
| `git diff --check` | PASS |
| `shasum -a 256 -c research/CHECKSUMS.sha256` | PASS completo |
| Generador v0.1 `--check` | PASS; promotion gate true |
| Source manifest check | PASS; 19/19 paths exactos |
| Reassessment v0.1 | PASS |
| Dashboard/typecheck | 28/28 PASS |
| Matriz de publicación | 98 fixtures raw rechazadas |
| Python ARBFOLD | 27/27 PASS |
| `make video-proof` | PASS sólo con evidencia auténtica |
| Preflight local | 25/25 PASS; tres campos humanos pendientes |
| `make verify-release` literal | PASS, exit 0 |
| Foundry default | 82/82 PASS |
| Foundry release completo, seed `0x1057` | 82/82 PASS |
| Release fuzz filtrado | 10,000 runs; invariantes 256 × 20,480 llamadas |
| Diferencial aritmético Python | 50,000 muestras; 0 direction mismatches |
| Solidity arithmetic fuzz | 50,000 runs por cada una de dos propiedades |
| Coverage | 98.6063% líneas, 91.0714% branches, 100% funciones |
| Slither 0.11.3 | 25 resultados; 9 Medium revisados; 0 High/Medium sin resolver |
| Deployment smoke | PASS en Anvil local 31337 |
| Preflight público | 28/29; sólo falla README público aún en v0, esperado |
| `npm run check:live` | PASS en chain 1301, bloque 61,272,315; read-only |

El build del dashboard termina correctamente con un warning no bloqueante por
un chunk minificado de 528.08 kB.

## Mediciones y hashes

| Input | Referencia | ARBFOLD v0.1 | Reducción |
|---:|---:|---:|---:|
| 10k | 407,292 | 327,669 | 19.549365% |
| 25k | 409,402 | 329,777 | 19.449099% |
| 50k | 544,219 | 375,171 | 31.062495% |
| 100k | 544,219 | 375,171 | 31.062495% |
| 200k | 544,209 | 375,160 | 31.063250% |

El output canónico permanece
`30220363129338304386`, el fixed external-recipient reward permanece
`85849039116169484` y el residual canónico permanece cero. El sweep sigue
siendo 196/196 accionables más baratos desde 5k, con 1k–4k como llamadas de
cero rondas más caras.

| Artefacto | SHA-256 |
|---|---|
| Raw v4 | `1c184e301a07f80116f9e79d8cfeeee2a83cea4215d291213c0c4dbe19a74860` |
| Environment | `e2c953b2d89b6959fcc90037b039e85dbe48ae8ca4cf433a7db99bd995e3b7be` |
| Source manifest / tree digest | `d41622745ff2b64fc807bc8ee5070981bbe029813b1debfc889301dc9a836618` |
| Report | `9af3d3f331b8d1e3300779d8961f0cc4fbfb6372178cb81bdf5db6c57f26216b` |
| Forge output | `9fcdf9aef99a4c1a0d806b225cae9ec900c62a2d7fe37993ee6e8dfe604ffccd` |
| Reassessment v4 | `139df7f4f831fef7541964a8a71437641ea4a2932d103c0c4408f89b9389d829` |
| `ArbFoldCoordinator.sol` | `10f1f260ac72650d3b17f0a69af227e511955f0d27121a8d325e89fb85e54f5d` |
| Benchmark harness | `4b9c5e9f4bca1e81fcc94393cd6754587a4df68f8951fbe9e38f12da2f51c70c` |
| Deployment público v0 | `6338e01eb59b7b4532935b072393313879112d7778d03a89e2492ec7a47dcbbe` |

## Estado de release

- `HEAD` y `origin/main`: `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`.
- v0.1: candidato local, sin commit y sin deployment externo.
- Plan v0.1: `not-broadcast`, `publicationCommit: null`, cero
  transacciones y `canonicalDemoTransaction: null`.
- Web y deployment públicos: v0.
- Pendientes humanos: URL del video, email de cohorte y X handle.
- Production readiness: no establecida.

## Metodología y límites

**Estrategia:** revisión FOCUSED de una remediación off-chain con validación de
integridad.

**Técnicas:**

- comparación con hashes y requisitos del informe anterior;
- lectura completa de la nueva autoridad Node y sus consumidores;
- trazado de callers y blast radius;
- inspección paralela de las implementaciones JS, Python y generador;
- mutaciones independientes fail-closed;
- regeneración determinista;
- reproducción del release gate, Foundry release y verificadores públicos
  read-only.

**Límites:** no se realizó una nueva auditoría integral de dependencias de
terceros ni una revisión de producción del protocolo. Los contratos no
cambiaron en esta ronda y sus límites históricos permanecen vigentes.

**Confianza:** alta para el cierre del hallazgo de provenance/compiler y para
la preservación de los artefactos medidos; sin conclusión de production
readiness.

## Conclusión

El agente terminó correctamente. El último Low está cerrado, la errata de seis
gates está corregida y no apareció un hallazgo accionable nuevo. La siguiente
fase ya no es otra corrección técnica: es completar los tres campos humanos y,
sólo con autorización explícita, preparar commit/publicación de la v0.1.
