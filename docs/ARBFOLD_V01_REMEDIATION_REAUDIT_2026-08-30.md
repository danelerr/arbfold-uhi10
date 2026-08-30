# ARBFOLD v0.1 — Reauditoría de la remediación

Fecha: 2026-08-30  
Baseline Git: `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`  
Estado revisado: working tree local no comprometido, posterior a
[`ARBFOLD_V01_REVIEW_RESOLUTION_2026-08-30.md`](ARBFOLD_V01_REVIEW_RESOLUTION_2026-08-30.md)  
Postura: revisión diferencial, cumplimiento de especificación y reproducción
independiente; no se modificó la implementación.

## Resumen ejecutivo

El núcleo optimizado y el benchmark first-call continúan siendo válidos. La
reproducción independiente volvió a obtener exactamente las cinco filas
congeladas, los 200 puntos del barrido y las seis rutas. El caso canónico sigue
siendo `544,219` gas para la referencia frente a `375,171` para ARBFOLD v0.1,
una reducción de `31.062495%`; 25k sigue siendo positivo con `19.449099%`.

Las tres observaciones de la primera revisión fueron corregidas en su fuente
principal:

- se eliminó por completo la medición steady-state inválida y no se publicó un
  reemplazo estimado;
- los componentes activos del benchmark usan `Fixed execution reward` y hacen
  visible la frontera 1k–4k / 5k–200k;
- el raw v2 contiene los cuatro valores emparejados y Python deriva y prueba los
  gates mediante mutaciones de 1 wei.

La remediación no está lista para publicación todavía. Dos consumidores de
evidencia quedaron desincronizados y hay dos inconsistencias menores de
validación/copy. Ningún hallazgo nuevo invalida el contrato, los valores del raw
ni el resultado económico rechazado.

| Severidad | Cantidad |
|---|---:|
| Critical | 0 |
| High | 0 |
| Medium | 2 |
| Low | 2 |

**Veredicto:** aprobación del mecanismo y del benchmark; **rechazo temporal del
paquete de publicación** hasta corregir los cuatro hallazgos y volver a ejecutar
los gates.

## Hallazgos

### Medium — `make video-proof` consume campos eliminados, imprime `null` y aun así termina en PASS

**Archivos:**

- [`scripts/video-proof.sh`](../scripts/video-proof.sh#L15)
- [`docs/VIDEO_RECORDING_RUNBOOK.md`](VIDEO_RECORDING_RUNBOOK.md#L20)

El schema v2 sustituyó `user_output` y `external_recipient_reward` por pares
reference/direct. Sin embargo, el proof de grabación todavía consulta:

```jq
.user_output
.external_recipient_reward
```

La ejecución real de `make video-proof` terminó con código cero y mostró:

```text
User output:      null wei internal A
Fixed reward:     null wei internal A
...
PASS — v0.1 tests and benchmark evidence loaded
```

`jq -r` no considera que un campo ausente sea un error, por lo que `set -e` no
protege este camino. El runbook ordena usar exactamente este comando para la
grabación final. El raw correcto no está afectado; falla su consumidor y el
proof es actualmente fail-open.

**Corrección recomendada:** leer y mostrar ambos pares v2; antes de renderizar,
usar una validación `jq -e` que exija una única fila canónica, campos no nulos e
igualdad exacta de output y reward. Añadir una prueba que ejecute el comando y
rechace `null`, campos ausentes o pares distintos.

### Medium — El dashboard de desarrollo sirve v0 mientras el build sirve v0.1

**Archivos:**

- [`vite.config.ts`](../vite.config.ts#L6)
- [`app/src/lib/arbfold.ts`](../app/src/lib/arbfold.ts#L123)
- [`scripts/build-dashboard.mjs`](../scripts/build-dashboard.mjs#L14)
- [`README.md`](../README.md#L44)

El middleware de Vite entrega
`benchmark/release-candidate-results/raw.json` (schema v0), mientras que el
build de producción copia
`benchmark/optimized-release-candidate-results/raw.json` (schema v2). El loader
solo exige v2 cuando existe `frozen_grid` y después acepta silenciosamente el
array legacy `rows`.

La reproducción mediante `npm run dev` y una lectura de
`/data/release-results.json` devolvió:

```json
{
  "schema": "arbfold-release-candidate-v1",
  "has_frozen_grid": false,
  "has_rows": true,
  "canonical": {"backrun_total_gas": 544187, "direct_total_gas": 440128}
}
```

Por tanto, quien siga la instrucción local del README ve el benchmark v0 de
19.12% y la antigua regresión de 25k dentro de una interfaz redactada para v0.1.
El artefacto `dist/` sí contiene el raw v2 correcto.

**Corrección recomendada:** hacer que Vite y el build consuman la misma fuente
v2; exigir incondicionalmente schema v2 y `frozen_grid` en el loader y retirar
el fallback legacy de la superficie v0.1. Añadir una integración que compare
schema, hash y fila canónica entre endpoint dev y build.

### Low — Los gates JavaScript no preservan igualdad exacta a nivel wei

**Archivos:**

- [`app/src/types.ts`](../app/src/types.ts#L82)
- [`app/src/lib/arbfold.ts`](../app/src/lib/arbfold.ts#L128)
- [`scripts/submission-preflight.mjs`](../scripts/submission-preflight.mjs#L49)

Outputs y rewards se serializan como enteros JSON, pero TypeScript los declara
como `number` y ambos consumidores usan `JSON.parse`. Los valores canónicos
(`30220363129338304386` y `85849039116169484`) exceden
`Number.MAX_SAFE_INTEGER`. Una mutación real de un wei en el output canónico
produjo esta observación:

```json
{
  "exact_bigint_equal": false,
  "parsed_reference": 30220363129338302000,
  "parsed_direct": 30220363129338302000,
  "parsed_equal": true,
  "all_rows_gate_recomputed_by_js": true,
  "safe": false
}
```

Python conserva enteros arbitrarios, por lo que el raw publicado y las pruebas
Python sí establecen la igualdad exacta. El defecto afecta únicamente la
promesa de que el loader/preflight JavaScript la recomputan con precisión de un
wei.

**Corrección recomendada:** publicar esos cuatro campos como strings decimales
y compararlos como string validado o `BigInt`, o conservar el raw y usar un
parser JSON lossless. Añadir mutaciones de ±1 wei en las pruebas Node, además
del rechazo de schema legacy.

### Low — El paquete de presentación conserva conteos y subtítulos anteriores

**Archivos:**

- [`app/src/App.tsx`](../app/src/App.tsx#L88)
- [`docs/FINAL_SUBMISSION.md`](FINAL_SUBMISSION.md#L90)
- [`docs/DEMO_SCRIPT.md`](DEMO_SCRIPT.md#L68)
- [`docs/VIDEO_RECORDING_RUNBOOK.md`](VIDEO_RECORDING_RUNBOOK.md#L26)
- [`assets/arbfold-demo-en.srt`](../assets/arbfold-demo-en.srt#L31)

La eliminación del test steady-state redujo la suite de 83 a 82, pero la UI,
el formulario final, el guion y una sección del runbook todavía anuncian 83.
El mismo runbook dice correctamente 82 en su tabla, creando una contradicción
interna.

Además, el SRT que el runbook describe como alineado con la secuencia final aún
afirma 61 tests, `Same solver reward`, 19.12% canónico y 0.98% más en 25k. Es la
narrativa v0, no la v0.1 de 31.06%/19.45% con frontera 1k–4k.

**Corrección recomendada:** sustituir 83 por 82 o evitar un conteo hardcodeado;
regenerar el SRT desde el guion v0.1 y hacer que el preflight compruebe el
conteo, el headline, 25k, la frontera y la terminología del subtítulo.

## Cumplimiento de la remediación

| Requisito | Estado | Evidencia |
|---|---|---|
| Retirar steady-state inválido sin estimarlo | Pass | Test/rama, matriz raw y claim retirados; ledger dice `not_measured_without_cross_transaction_harness` |
| Mantener first-call 100k y 25k | Pass | Reproducción exacta de 5/5 filas |
| Registrar pares output/reward y derivar gates | Pass en Solidity/Python | Cuatro campos por fila, gates derivados y 20 mutaciones de 1 wei |
| Actualizar consumidores del schema v2 | Fail | `video-proof` usa campos viejos; dev sirve raw v0; JS pierde precisión wei |
| Corregir UI activa y frontera | Pass | `Fixed execution reward`; advertencia 1k–4k y alcance canónico visibles y testeados |
| Corregir todo el material de entrega | Partial | SRT y cuatro conteos permanecen desactualizados |
| Regenerar evidencia, hashes y reevaluación | Pass | Checksums, manifest y reassessment pasan |
| Preservar históricos | Pass | Sin diff en los cuatro directorios protegidos |
| No rediseñar el core ni desplegar/publicar | Pass | HEAD/origin siguen en `f9d46e8`; v0.1 permanece `not-broadcast` |

## Verificación ejecutada

| Comprobación | Resultado |
|---|---|
| `git diff --check` | Pass |
| `forge fmt --check` | Pass |
| Foundry default | 82/82 pass |
| Foundry release | 82/82 pass; 10,000 fuzz runs; 256 invariants × 80 depth |
| Reproducción de artefacto | 5 frozen, 200 sweep y 6 paths idénticos al raw |
| Python ARBFOLD | 25/25 pass |
| Dashboard/typecheck | 17/17 pass |
| Build Vite | Pass; advertencia no bloqueante por chunk >500 kB |
| Arithmetic differential | 50,000 muestras; 0 direction mismatches |
| Foundry arithmetic | 50,000 runs por cada una de dos propiedades; pass |
| Coverage | 98.6063% líneas; 91.0714% branches; 100% funciones |
| Slither 0.11.3 | Gate pass con binario del venv; 25 resultados, 0 Medium/High sin revisar |
| Deployment smoke | Pass |
| Checksums / source manifest / v0 y v0.1 reassessments | Pass |
| Históricos | Sin Git diff |
| Verificador live v0 | Pass en chain 1301, bloque 61,256,499 |
| Preflight local | 22/22; 3 campos humanos pendientes |
| Preflight público | 25/26; falla esperada porque `main` aún sirve v0 |
| `make video-proof` | Exit 0 incorrecto con output/reward `null` |
| Endpoint Vite dev | Sirve schema v0 y canónico 544,187/440,128 |
| Mutación JS +1 wei | Falsa igualdad por redondeo IEEE-754 |

El primer intento del script Slither no encontró un binario global. La ejecución
explícita con `.venv/bin/slither` reprodujo el gate declarado; esto es una
dependencia de entorno, no un hallazgo del mecanismo.

## Estado de publicación

El v0 público e inmutable sigue verificando correctamente. El repositorio
público y GitHub Pages aún presentan v0, coherente con la prohibición de hacer
commit/push/deploy durante esta tarea. Por eso el fallo público 25/26 no se
atribuye al implementador como defecto. Antes de publicar v0.1 deben resolverse
los hallazgos anteriores, completarse los tres campos humanos y repetirse el
preflight contra el commit público exacto.

## Conclusión

El implementador corrigió correctamente la sustancia de los tres hallazgos
originales y no alteró los resultados válidos. El trabajo no está completamente
terminado porque el cambio de schema y la eliminación del test no se propagaron
a todos los consumidores y materiales de entrega. La corrección restante es
acotada: no requiere tocar el coordinador, cambiar economía, volver a medir el
benchmark ni desplegar contratos; sí exige regenerar el empaquetado y sus
checksums si se cambia el schema del raw.

**Confianza:** alta en el benchmark first-call y en la corrección del core;
alta en los cuatro defectos de publicación reproducidos; sin conclusión de
production readiness.
