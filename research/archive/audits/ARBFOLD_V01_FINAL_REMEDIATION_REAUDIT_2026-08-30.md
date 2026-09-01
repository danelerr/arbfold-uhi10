# ARBFOLD v0.1 — Reauditoría final de la remediación

Fecha: 2026-08-30  
Baseline Git: `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`  
Estado revisado: working tree local no comprometido, posterior a
[`ARBFOLD_V01_REAUDIT_RESOLUTION_2026-08-30.md`](ARBFOLD_V01_REAUDIT_RESOLUTION_2026-08-30.md)  
Postura: revisión diferencial, cumplimiento de especificación, mutación
adversarial de consumidores y reproducción independiente. No se modificó la
implementación durante esta revisión.

## Resumen ejecutivo

El agente corrigió correctamente los cuatro hallazgos de la reauditoría
anterior:

1. `video-proof` ya no consulta campos legacy ni imprime `null`;
2. Vite dev y el build consumen exactamente el mismo raw v0.1;
3. los cuatro valores emparejados se serializan como strings y JavaScript
   detecta mutaciones de un wei con `BigInt`;
4. la UI, documentos activos y subtítulos usan 82 tests y la narrativa v0.1.

El contrato, el benchmark real y sus cifras principales continúan válidos. La
reproducción volvió a obtener `544,219` gas para la referencia y `375,171` para
ARBFOLD a 100k (`31.062495%` menos), además de `409,402` frente a `329,777` a
25k (`19.449099%` menos). Las cinco filas, el barrido de 200 puntos, las seis
rutas, outputs, rewards y hashes actuales coinciden con el paquete declarado.

Sin embargo, la afirmación de validación *fail-closed* sigue siendo demasiado
amplia. Los consumidores aceptan evidencia internamente contradictoria si los
campos derivados o algunos gates se manipulan, y todos los validadores aceptan
strings decimales mayores que el máximo `uint256`. Estos defectos no alteran el
raw actual ni el core Solidity, pero sí permiten que un paquete corrupto supere
el proof/preflight de publicación.

| Severidad | Cantidad |
|---|---:|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 1 |

**Veredicto:** aprobación del core optimizado, del benchmark actual y de las
cuatro correcciones originales; **aprobación condicional del paquete de
publicación**. Corregir los dos hallazgos de integridad antes del commit público
y repetir los gates. No hace falta rediseñar ni redesplegar contratos.

## Hallazgos

### Medium — Proof y preflight aceptan evidencia derivada contradictoria

**Archivos:**

- [`app/benchmark-core.js`](../app/benchmark-core.js#L12)
- [`scripts/video-proof-evidence.jq`](../scripts/video-proof-evidence.jq#L33)
- [`scripts/video-proof.sh`](../scripts/video-proof.sh#L23)
- [`scripts/submission-preflight.mjs`](../scripts/submission-preflight.mjs#L60)
- [`tests/dashboard/benchmark-evidence.test.mjs`](../tests/dashboard/benchmark-evidence.test.mjs#L31)

El validador compartido comprueba forma, orden, enteros básicos, strings
decimales y la igualdad exacta de output/reward. No comprueba la coherencia de
otros datos que el mismo paquete presenta como evidencia mecánica:

- no deriva `gas_reduction_percent` desde `reference_total_gas` y
  `direct_total_gas`;
- no deriva `all_five_cheaper` ni `twenty_five_k_cheaper` desde las cinco filas;
- no exige `direct_residual`, `equivalence_tolerance_wei` ni los campos usados
  por sus gates;
- no contrasta `absolute_gas_saved` con los dos totales de gas.

El filtro jq exige que los gates publicados sean `true`, pero tampoco deriva
los gates de gas ni el porcentaje. Después, `video-proof.sh` imprime el
porcentaje crudo como `Exact reduction`. El preflight recalcula el porcentaje
canónico y el de 25k para su copy, pero no exige que coincidan con el campo raw
ni recalcula el gate de las cinco filas.

Tres mutaciones aisladas reprodujeron el problema:

1. Cambiar solamente el porcentaje canónico a `99.999999` hizo que JavaScript,
   `video-proof --evidence-only` y el preflight terminaran con éxito. El proof
   imprimió:

   ```text
   Exact reduction:   99.999999%
   PASS — v0.1 evidence schema, exact paired values, and mechanical gates validated.
   ```

2. Cambiar la fila 10k para que `direct_total_gas = reference_total_gas + 1`,
   dejando `all_five_cheaper=true`, también fue aceptado por el validador,
   video-proof y preflight. Así puede sobrevivir una contradicción directa con
   el claim público de cinco filas más baratas.
3. Eliminar `direct_residual` fue rechazado por jq, pero aceptado por el
   validador compartido y el preflight, que terminaron en
   `STATUS READY_FOR_MANUAL_FINISH`.

El impacto es de integridad de publicación, no de seguridad onchain. El raw
versionado actual no contiene ninguna de estas inconsistencias y el generador
lo reprodujo con el mismo SHA-256. Aun así, un comando que anuncia gates
“validated” debe rechazar contradicciones semánticas y no sólo gates
preafirmados.

**Corrección recomendada:** convertir `validateBenchmarkPayload` en el contrato
semántico único y hacer que proof, preflight, dev y build dependan de él o de
una representación validada equivalente. Como mínimo:

1. exigir todos los campos que alimentan claims/gates y validar sus tipos;
2. derivar `absolute_gas_saved`, el porcentaje a seis decimales,
   `twenty_five_k_cheaper` y `all_five_cheaper` desde cada fila;
3. exigir residual y tolerancia no negativos, y coherencia de los gates
   correspondientes;
4. imprimir en video-proof únicamente valores normalizados después de esa
   validación;
5. añadir mutaciones de cada campo derivado y de cada fila, no sólo de los
   cuatro pares exactos.

Si no se van a migrar todavía las reservas grandes a strings lossless, el PASS
debe distinguir entre gates recomputados por el consumidor y gates respaldados
por el Forge/source-manifest, en lugar de afirmar genéricamente que todos los
gates mecánicos fueron validados.

### Low — “Canonical uint256 decimal” no impone el límite de `uint256`

**Archivos:**

- [`app/benchmark-core.js`](../app/benchmark-core.js#L32)
- [`scripts/video-proof-evidence.jq`](../scripts/video-proof-evidence.jq#L1)
- [`scripts/generate-v01-benchmark.py`](../scripts/generate-v01-benchmark.py#L234)
- [`research/reassess_arbfold_v01.py`](../research/reassess_arbfold_v01.py#L27)

Los cuatro caminos aceptan cualquier string decimal canónico no negativo, pero
no verifican que sea menor o igual a `2**256 - 1`. La mutación exacta
`2**256` —un valor uno mayor que el máximo EVM— fue aceptada por:

- `validateBenchmarkPayload`;
- el filtro jq y `video-proof`, que imprimió PASS;
- el preflight local;
- `recompute_paired_gates`;
- `canonical_uint_decimal` del generador.

El generador normal no puede recibir ese valor desde un evento Solidity
`uint256`, por lo que el artefacto actual no está afectado. El defecto está en
la semántica prometida por los validadores y en su resistencia a evidencia
manipulada.

**Corrección recomendada:** definir `MAX_UINT256 = 2**256 - 1`, validar el rango
después del regex en JavaScript y Python, e implementar en jq una comparación
lossless por longitud/orden lexicográfico contra el decimal máximo. Añadir
casos para `0`, máximo, máximo + 1 y strings de longitud excesiva en cada
consumidor.

## Cierre de los cuatro hallazgos anteriores

| Hallazgo anterior | Estado | Evidencia reproducida |
|---|---|---|
| `video-proof` imprimía `null` y pasaba | Resuelto | Muestra ambos outputs/rewards exactos; missing/null/+1 wei fallan; el comando real termina sin `null` |
| Dev servía v0 y build v0.1 | Resuelto | Endpoint Vite, raw fuente y `dist/data/release-results.json` son byte por byte iguales; SHA-256 `0eb71a02f4263b3cd1c8e66364a67b3fece26380603f2cab10937eb69e141d21` |
| JavaScript perdía precisión de un wei | Resuelto para los cuatro pares | Schema v3 usa strings; comparación `BigInt`; mutaciones ±1 de los cuatro campos en las cinco filas fallan |
| Copy/SRT conservaban conteos y narrativa v0 | Resuelto | 82 tests, 31.06%/19.45%, frontera 1k–4k, 196/196 actionable, reward fijo y separación public-v0/local-v0.1 presentes |

El primer cierre sigue siendo correcto respecto del defecto original. El
hallazgo Medium nuevo es más amplio: el proof ya no es fail-open ante pares
ausentes/distintos, pero sí ante otros datos derivados contradictorios.

## Verificación ejecutada

| Comprobación | Resultado |
|---|---|
| `git diff --check` | Pass |
| `forge fmt --check` | Pass |
| Foundry default | 82/82 pass |
| Foundry release | 82/82 pass; fuzz de 10,000 y 256 corridas × 20,480 llamadas por invariante |
| Generador v0.1 | Pass; 5 frozen, 200 sweep y 6 paths; raw regenerado con el mismo hash documentado |
| Aritmética diferencial | 50,000 muestras; 0 direction mismatches |
| Foundry arithmetic | 50,000 runs para cada una de dos propiedades; pass |
| Python ARBFOLD | 26/26 pass |
| Dashboard/typecheck | 22/22 pass, incluyendo Vite real, build real y mutaciones de pares |
| Build dashboard | Pass; warning no bloqueante por chunk de 515.80 kB |
| Deployment smoke | Pass |
| Slither 0.11.3 | Pass con `.venv/bin/slither`; 25 resultados, 0 Medium/High sin revisar |
| Coverage | 98.6063% líneas; 91.0714% branches; 100% funciones |
| Checksums / source manifest / reassessments v0 y v0.1 | Pass |
| `make video-proof` con raw real | Pass; valores exactos y cero `null` |
| Preflight local | 25/25; tres campos humanos pendientes |
| Históricos protegidos | Sin Git diff |
| Verificador live v0 | Pass en chain 1301, bloque 61,260,286 |

El target literal `make verify-release` avanzó por compilación, tests,
benchmark, aritmética, Python, dashboard, build y deployment smoke, pero se
detuvo porque `slither` no está en el `PATH` del shell. El gate Slither pasó al
usar `SLITHER=.venv/bin/slither`; coverage, manifests y reassessments pasaron a
continuación. Es una dependencia local/documental, no un fallo del mecanismo,
pero conviene documentar la instalación/activación del entorno antes de pedir
el comando literal a terceros.

## Provenance y estado de release

- `HEAD` y `origin/main` continúan en
  `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e`.
- El plan v0.1 continúa `not-broadcast`, con `publicationCommit: null`,
  `broadcastPerformed: false` y cero transacciones.
- SHA-256 raw v0.1:
  `0eb71a02f4263b3cd1c8e66364a67b3fece26380603f2cab10937eb69e141d21`.
- SHA-256 reassessment v0.1:
  `493d000f9b16be80d7d9443ad16cec387cc0d9fa112b1c8caa34f6e07ad6df93`.
- SHA-256 del source manifest:
  `13d915d18d2d68468f9fc4e6d38a4e96d89799f95bd3bd60844aa34f96d578eb`.
- El preflight público queda 28/29 porque `main` todavía sirve el claim v0; es
  coherente con no haber autorizado commit/push/publicación.
- Quedan tres campos humanos: URL final del video, email de cohorte y X handle.

## Conclusión

El agente hizo bien la remediación solicitada y no dañó el core, los históricos
ni el benchmark. No hay evidencia de alucinación en los resultados actuales:
las cifras se regeneran, los hashes coinciden y las suites pasan.

No declararía todavía el paquete completamente cerrado porque sus validadores
permiten probar como “válida” evidencia que se contradice a sí misma. La
corrección restante es pequeña y localizada en schema/consumidores/tests; no
requiere tocar `ArbFoldCoordinator.sol`, cambiar economía, volver a diseñar el
mecanismo ni desplegar v0.1.

**Confianza:** alta en el core y las cifras del raw actual; alta en las cuatro
correcciones originales; alta en los dos bypasses reproducidos; sin conclusión
de production readiness.
