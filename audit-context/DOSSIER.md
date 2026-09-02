# ARBFOLD v0.1 — contexto reconstruido en `17c4e5c`

## Alcance y método

Este dossier fue reconstruido desde cero y revalidado sobre `17c4e5cc01a6951c5ae272e28c6c76615bd64fa9`. El alcance leído fue:

- todos los contratos de producción en `contracts/src/`;
- los caminos heredados que `ArbFoldHook` usa de OpenZeppelin Hooks y Uniswap v4;
- `DeployArbFold.s.sol`, `RunArbFoldDemo.s.sol` y `VerifyArbFoldDeployment.s.sol`;
- `scripts/deploy-unichain-sepolia.sh`, `scripts/finalize-manifest.sh`, `scripts/check-live-demo.mjs` y `app/live-core.js`;
- el manifiesto público `deployments/unichain-sepolia-1301-v0.1.json` y su plan.

La fase es de construcción de contexto: describe qué se exige, qué se asume y qué queda fuera de cada comprobación. No asigna severidades ni propone cambios.

## Sistema reconstruido

ARBFOLD opera tres CPMM de liquidez propiedad de hooks: A/B, B/C y A/C. Cada `ArbFoldHook` guarda reservas virtuales y mantiene las contrapartidas como claims ERC-6909 en un `PoolManager` común (`contracts/src/ArbFoldHook.sol:L34-L38`, `contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomCurve.sol:L108-L115`). Un swap exact-input actualiza primero el pool originador; si el router adjunta `FOLD_MODE`, el hook llama al coordinador dentro del mismo `PoolManager.unlock` (`contracts/src/ArbFoldHook.sol:L72-L83`).

El coordinador lee las seis reservas, calcula el mejor ciclo A→B→C→A o A→C→B→A y ejecuta hasta ocho transiciones directas de claims (`contracts/src/ArbFoldCoordinator.sol:L137-L151`). Por ronda mueve principal entre hooks y paga al solver 10% del beneficio amenazado en claims de token A (`contracts/src/ArbFoldCoordinator.sol:L16-L19`, `contracts/src/ArbFoldCoordinator.sol:L175-L206`). Después exige conservación virtual, productos CPMM no decrecientes y coincidencia entre el estado calculado y las reservas reportadas (`contracts/src/ArbFoldCoordinator.sol:L208-L213`, `contracts/src/ArbFoldCoordinator.sol:L153-L158`).

El router abre el lock, hace un swap v4 con datos de fold y liquida los deltas transitorios contra el pagador (`contracts/src/ArbFoldRouter.sol:L58-L90`, `contracts/src/ArbFoldRouter.sol:L93-L115`). El `PoolManager` no deja cerrar `unlock` con deltas pendientes (`contracts/lib/openzeppelin-uniswap-hooks/lib/v4-core/src/PoolManager.sol:L103-L114`).

## Entradas y flujo efectivo

1. **Swap vía router.** Cualquier cuenta llama `swapExactInput`; el router valida deadline, dominio entero, solver no nulo y pertenencia del hook, y llama `PoolManager.unlock` (`contracts/src/ArbFoldRouter.sol:L58-L85`).
2. **Callback del manager.** Sólo el manager configurado puede llamar `unlockCallback`; allí se obtiene el `PoolKey`, se invoca `swap` con `FOLD_MODE` y se saldan ambas monedas (`contracts/src/ArbFoldRouter.sol:L93-L109`).
3. **Swap del custom curve.** `PoolManager.swap` sólo funciona estando desbloqueado y llama al `beforeSwap` del hook (`contracts/lib/openzeppelin-uniswap-hooks/lib/v4-core/src/PoolManager.sol:L186-L226`). `BaseCustomCurve` toma/quema claims del hook para el input y liquida/minta claims para el output (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomCurve.sol:L86-L125`).
4. **Fold.** Tras contabilizar el output del usuario, `ArbFoldHook._beforeSwap` decodifica modo/solver y llama `fold` (`contracts/src/ArbFoldHook.sol:L77-L83`). Sólo uno de los tres hooks registrados puede entrar y el solver no puede ser cero, coordinador, manager ni un hook registrado (`contracts/src/ArbFoldCoordinator.sol:L131-L135`).
5. **Transición directa.** `transferFrom` mueve claims; el coordinador es operador de cada hook y luego actualiza sus reservas virtuales (`contracts/src/ArbFoldCoordinator.sol:L175-L214`). El `PoolManager` heredado permite a cualquier titular transferir sus propios claims y a operadores transferir claims ajenos (`contracts/lib/openzeppelin-uniswap-hooks/lib/v4-core/src/ERC6909.sol:L25-L47`, `contracts/lib/openzeppelin-uniswap-hooks/lib/v4-core/src/ERC6909.sol:L58-L64`).
6. **Liquidación y atomicidad.** El callback devuelve el delta, el router transfiere ERC-20 de entrada/salida y `PoolManager.unlock` revierte si queda algún delta (`contracts/src/ArbFoldRouter.sol:L107-L115`, `contracts/lib/openzeppelin-uniswap-hooks/lib/v4-core/src/PoolManager.sol:L103-L114`). El mínimo de salida se comprueba después de `unlock`; un fallo revierte toda la llamada (`contracts/src/ArbFoldRouter.sol:L86-L90`).

También existen caminos sin router: cualquier caller capaz de abrir su propio `PoolManager.unlock` puede llamar el pool directamente; `hookData` vacío produce un swap sin fold (`contracts/src/ArbFoldHook.sol:L79-L83`). `addLiquidity` y `removeLiquidity` heredados son públicos (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol:L137-L181`, `contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol:L192-L218`), aunque el hook sólo admite una financiación inicial (`contracts/src/ArbFoldHook.sol:L110-L127`).

## Invariantes y supuestos: dónde se establecen

| Propiedad | Enforcement real | Límite de la garantía |
| --- | --- | --- |
| Sólo hooks registrados llaman `fold` | `isHook(msg.sender)` en `contracts/src/ArbFoldCoordinator.sol:L131-L132` | La identidad de esos hooks queda fijada una sola vez, pero `configureHooks` no compara bytecode (`L76-L94`, `L161-L173`). |
| Solver no es una cuenta interna del sistema | Rechazo de cero, coordinador, manager y los tres hooks en `contracts/src/ArbFoldCoordinator.sol:L133-L135` | No se restringe a EOA; no hace falta para `ERC6909.transferFrom`, que no llama al receptor (`contracts/lib/openzeppelin-uniswap-hooks/lib/v4-core/src/ERC6909.sol:L35-L47`). |
| Reservas dentro del dominio | `CycleMath.best` valida las seis reservas (`contracts/src/CycleMath.sol:L52-L57`, `L102-L109`) y los setters del hook validan cada par (`contracts/src/ArbFoldHook.sol:L61-L69`) | Un retiro total deja ambas reservas en cero por diseño (`contracts/src/ArbFoldHook.sol:L159-L169`); desde entonces `network()` aún lee, pero `quote`, `fold` y `lastResidualProfit` salen del dominio. |
| Producto de cada CPMM no disminuye por ronda | `_assertNonDecreasing` antes de escribir reservas (`contracts/src/ArbFoldCoordinator.sol:L208-L213`, `L256-L265`) | Compara las reservas virtuales calculadas; no consulta los balances ERC-6909. |
| Conservación A/B/C en una ronda | `_assertConservation`, incluyendo el reward en A (`contracts/src/ArbFoldCoordinator.sol:L267-L281`) | Es conservación del modelo virtual, no una suma global de todos los titulares de claims. |
| Al menos un producto aumenta si hubo rondas | Control final en `contracts/src/ArbFoldCoordinator.sol:L154-L157`, implementación `L246-L254` | No aplica al fold de cero rondas. |
| Estado escrito coincide con el calculado | Relectura de seis reservas y comparación exacta (`contracts/src/ArbFoldCoordinator.sol:L153-L155`, `L229-L236`) | No compara claims de hooks ni backing ERC-20. |
| Claims de cada hook igualan su reserva virtual | La ruta normal de swap/fold mueve claims y reservas conjuntamente; el verificador de deployment compara los seis pares (`contracts/script/VerifyArbFoldDeployment.s.sol:L88-L99`) | No hay comprobación de esta igualdad en `fold`, en el setter ni en `check:live`. Un tercero no autorizado sólo puede transferir al hook claims que él mismo posee; debitar al hook requiere ser el hook o un operador aprobado (`contracts/lib/openzeppelin-uniswap-hooks/lib/v4-core/src/ERC6909.sol:L25-L47`). Esa donación crea *surplus*, no déficit ni insolvencia por sí sola, pero rompe la igualdad exacta y puede dejar valor no modelado/varado. |
| Backing ERC-20 del manager | El verificador suma reservas y, opcionalmente, el claim de un solver (`contracts/script/VerifyArbFoldDeployment.s.sol:L101-L112`) | Esa suma sólo modela un solver y no todos los posibles titulares/transferencias de claims; es una comprobación adecuada para la secuencia de deployment, no una identidad global permanente. |
| Fold termina con residual ≤ `1e12` | El bucle se detiene al estar bajo el umbral (`contracts/src/ArbFoldCoordinator.sol:L144-L147`) | Si llega a ocho rondas, emite el residual calculado sin exigir que ya esté bajo el umbral (`L153-L158`, `L238-L244`). El script de demo sí lo exige para esa ejecución (`contracts/script/RunArbFoldDemo.s.sol:L93-L97`). |
| Telemetría no trunca | Límites explícitos y `SafeCast` en `contracts/src/ArbFoldCoordinator.sol:L216-L226` | Alcanzar el límite de vida útil revierte el fold completo; no hay reset. |
| Continuidad operativa de los tres pools | Un retiro parcial debe dejar ambos lados sobre el mínimo, pero un retiro total `(0,0)` está permitido (`contracts/src/ArbFoldHook.sol:L159-L169`) | Los LP tokens son ERC-20 transferibles; quien controle todo el supply puede ejecutar el retiro total mediante `removeLiquidity` público (`contracts/lib/openzeppelin-uniswap-hooks/src/base/BaseCustomAccounting.sol:L192-L218`). No existe un guard del coordinador contra ese estado terminal. |
| Tokens compatibles y misma escala económica | El deployment usa tres instancias del mismo `DemoToken`, y el runtime público de las tres coincide con ese artefacto; `DemoToken` hereda ERC-20 y tiene mint abierto (`contracts/src/DemoToken.sol:L4-L12`) | Los constructores genéricos no consultan `decimals`, comportamiento de transferencias ni identidad de bytecode (`contracts/src/ArbFoldCoordinator.sol:L63-L73`, `contracts/src/ArbFoldRouter.sol:L53-L56`). `CycleMath` usa límites expresados con `ether` para las tres monedas (`contracts/src/CycleMath.sol:L11-L14`). |

## Supuestos no enforced por los contratos

- **Tipo exacto de hook.** `_validateHook` exige código, coordinator, manager y tres campos del `PoolKey`, pero no el runtime, permisos, fee dinámico, tick spacing, inicialización, operator approval ni correspondencia reserva/claim (`contracts/src/ArbFoldCoordinator.sol:L161-L173`). El deployment público establece esas propiedades por procedimiento y el verificador las lee (`contracts/script/VerifyArbFoldDeployment.s.sol:L120-L140`); no son una propiedad del configurador genérico.
- **Pairing del router.** El constructor acepta manager y coordinador sin validarlos (`contracts/src/ArbFoldRouter.sol:L53-L56`). El verificador externo sí compara ambos bindings (`contracts/script/VerifyArbFoldDeployment.s.sol:L67-L76`).
- **Manager y tokens en los constructores.** El coordinador sólo rechaza direcciones nulas (`contracts/src/ArbFoldCoordinator.sol:L63-L73`); no exige código del manager, tokens distintos/ordenados ni código de tokens. El deployer ordena sus tres tokens (`contracts/script/DeployArbFold.s.sol:L233-L242`) y el manager v4 rechaza currencies desordenadas o iguales al inicializar (`contracts/lib/openzeppelin-uniswap-hooks/lib/v4-core/src/PoolManager.sol:L117-L126`).
- **Configuración implica operatividad.** `configured=true` se escribe tras validar interfaces (`contracts/src/ArbFoldCoordinator.sol:L85-L93`), no tras verificar financiación, inicialización u operator approval. El script público hace initialize/fund/authorize antes de configurar (`contracts/script/DeployArbFold.s.sol:L113-L144`).
- **Igualdad reserva/claim en cada fold.** Nada la lee dentro de `fold`; la comprobación final sólo vuelve a leer reservas (`contracts/src/ArbFoldCoordinator.sol:L153-L155`, `L229-L236`). Una transferencia entrante no autorizada puede crear surplus, pero un tercero no puede retirar claims del hook sin ser el hook o su operador; la donación no demuestra falta de backing.
- **Mínimo como recepción ERC-20 efectiva.** El router compara `minAmountOut` con el delta nominal devuelto por el manager (`contracts/src/ArbFoldRouter.sol:L86-L90`), no con la variación de balance del receptor. El despliegue público usa `DemoToken` estándar, pero la clase genérica no impone ese token.
- **Disponibilidad frente al propietario de LP.** El contrato no bloquea ni demora el retiro total. La autoridad es económica (posesión de LP), no el `admin` del coordinador. La lectura pública del 2026-09-02 muestra que el deployer conserva 100% del supply en los tres hooks; detalle en `audit-context/LIVE_CHECKS.md`.

## Dependencias externas y cajas negras

- **PoolManager público:** dirección `0x9cB2…6C95` fijada como manager oficial en el manifiesto (`deployments/unichain-sepolia-1301-v0.1.json:L46-L47`) y como constante del validador (`app/live-core.js:L5`, `L39-L42`). Sus 24.009 bytes y hash también están fijados (`deployments/unichain-sepolia-1301-v0.1.json:L92-L95`) y `check:live` los confronta con `eth_getCode` (`scripts/check-live-demo.mjs:L65-L87`). Esto prueba identidad con el runtime publicado; no equivale a verificación de fuente del manager ni a equivalencia con un artefacto local vendorizado.
- **ERC-20 arbitrario en la clase genérica:** el settle heredado usa `SafeERC20.safeTransferFrom/safeTransfer` (`contracts/lib/openzeppelin-uniswap-hooks/src/utils/CurrencySettler.sol:L32-L51`). Los tres tokens públicos no son caja negra después de la comparación de runtime registrada en `LIVE_CHECKS.md`.
- **RPC público:** `check-live-demo.mjs` confía en la respuesta de `https://sepolia.unichain.org` por defecto (`scripts/check-live-demo.mjs:L12-L23`). Fija bloques para los snapshots canónicos, pero no para la lectura actual ni confronta proveedores.
- **Fuente de manager oficial durante deployment:** el shell resuelve la dirección mediante un script/feed externo y sólo comprueba chain/code antes de emitir transacciones (`scripts/deploy-unichain-sepolia.sh:L109-L113`).

## Deployment y monitor live: estado actual

El manifiesto primario es explícitamente el v0.1 (`deployments/README.md:L1-L5`). Registra chain 1301, manager oficial, direcciones, commit desplegado `6670e626…`, dependencia `12048bb…`, 28 transacciones, demo, aprobación de simulación y nueve identidades de runtime: PoolManager más los ocho contratos/tokens del proyecto (`deployments/unichain-sepolia-1301-v0.1.json:L1-L128`). `git diff 6670e626…17c4e5c -- contracts/src contracts/script` no muestra cambios; los contratos y scripts Solidity actuales corresponden al snapshot desplegado, aunque la capa de verificación JS/shell sí fue reforzada después.

La reproducción independiente del 2026-09-02 está en `audit-context/LIVE_CHECKS.md`: los nueve tamaños/hashes coinciden con la red; los ocho runtimes propios coinciden con los artefactos compilados fuera de sus offsets inmutables; `VerifyArbFoldDeployment` pasa sobre bindings, pool keys, operator, claims/reservas y backing; y la transacción canónica coincide en receipt, topología/valores de eventos y snapshots históricos exactos. La etiqueta `sourceVerification` continúa siendo `not-available` (`deployments/unichain-sepolia-1301-v0.1.json:L50`), por lo que no se afirma verificación de fuente en el explorador.

El `npm run check:live` actual sí entrega PASS. Su cobertura efectiva es:

- fija ambas direcciones de manager a la constante oficial y exige exactamente nueve entradas de runtime bien formadas (`app/live-core.js:L19-L42`, `L85-L94`);
- compara el bytecode vivo de PoolManager, coordinator, tres hooks, router y tres tokens con tamaños/hashes publicados (`scripts/check-live-demo.mjs:L65-L87`);
- correlaciona la tx canónica con sender, router, bloque, único `SwapAndFold`, rondas, `FoldCompleted`, parámetros, output, reward y residual (`scripts/check-live-demo.mjs:L95-L122`);
- compara los seis valores de `network()` en bloque canónico − 1 y bloque canónico con los snapshots exactos publicados (`scripts/check-live-demo.mjs:L153-L200`);
- confronta manager/tokens/hooks del coordinador y manager/coordinator del router con el manifiesto (`scripts/check-live-demo.mjs:L156-L198`);
- confirma receipt/metadatos de la aprobación, balance/allowance actuales ≥25.000 y dos simulaciones read-only de 1.000 tokens (`scripts/check-live-demo.mjs:L70-L94`, `L202-L254`). La tx `0xbc1f…d5ea2` decodifica independientemente como `approve(router, 25000e18)` y la allowance viva es exactamente esa cantidad.

Límites que siguen fuera de ese PASS: `check:live` no relee pool keys, `isOperator`, igualdad claim/reserva ni backing; no recorre las 28 deployment txs ni demuestra procedencia de fuente; y sólo imprime el residual actual, sin exigir que sea ≤ `RESIDUAL_THRESHOLD`. El verificador Solidity cubre los primeros estados (`contracts/script/VerifyArbFoldDeployment.s.sol:L56-L140`) y también pasó en esta revalidación. El finalizador ahora genera las nueve identidades desde el RPC (`scripts/finalize-manifest.sh:L75-L113`), pero fijar un hash observado no prueba por sí solo qué fuente produjo ese runtime.

## Contraste con el dossier generado anterior

El HEAD no contenía `audit-context/` antes de esta pasada. Sí conserva una copia histórica en `research/generated/audit-context/DOSSIER.md`, cuya propia cabecera la fija a `f9d46e8820349ab0f2b0ea0627cc1eb7acd9811e` y 62 pruebas. No puede usarse como descripción del HEAD actual sin estas correcciones:

- Su estado persistente enumera `lastResidualProfit` como slot y los tres contadores como `uint256` públicos. Ahora los contadores están empaquetados en `Telemetry` (`contracts/src/ArbFoldCoordinator.sol:L44-L50`) y `lastResidualProfit` se calcula sobre el estado actual (`L124-L128`).
- Afirma que `fold` sólo exige solver no nulo y desarrolla el caso de alias con un hook registrado. El HEAD rechaza cero, coordinador, manager y cualquier hook registrado (`contracts/src/ArbFoldCoordinator.sol:L131-L135`); la regresión actual lo prueba en `contracts/test/ArbFoldResearchFindings.t.sol:L10-L23`.
- Describe cada ronda releyendo `network()`. El HEAD mantiene `currentState` en memoria, hace que `_applyDirect` lo devuelva y al final compara una única relectura contra el estado calculado (`contracts/src/ArbFoldCoordinator.sol:L137-L155`, `L175-L214`).
- Describe un residual persistido al terminar el fold. El evento usa `_terminalResidual`, con recálculo específico al agotar ocho rondas, mientras el getter público siempre recalcula (`contracts/src/ArbFoldCoordinator.sol:L153-L158`, `L238-L244`, `L124-L128`).
- Sus rangos de líneas de coordinator y su conteo de pruebas están desactualizados; la ejecución actual produjo 82/82.

Las afirmaciones históricas sobre arquitectura básica, custom curve, claims ERC-6909 y orden swap→fold siguen respaldadas por el código, pero este dossier y los registros bajo `audit-context/functions/` sustituyen sus detalles operativos.

## Cobertura exacta

**Analizado completamente:** `contracts/src/ArbFoldCoordinator.sol`, `ArbFoldHook.sol`, `ArbFoldRouter.sol`, `CycleMath.sol`, `ArbFoldHookDeployer.sol`, `DemoToken.sol`, `IArbFold.sol`; entradas heredadas relevantes de `BaseHook.sol`, `BaseCustomAccounting.sol`, `BaseCustomCurve.sol`, `CurrencySettler.sol`, `ERC20.sol`, `PoolManager.sol` y `ERC6909.sol`; los tres scripts Solidity de despliegue/demo/verificación; los scripts shell de despliegue/finalización; checker live, validación de manifiesto, manifiesto v0.1 y plan.

**Ejecutado:** `forge test --summary` (82/82 pruebas), `VerifyArbFoldDeployment` contra Unichain Sepolia (PASS), comparación de nueve runtimes, comparación de ocho artefactos propios/runtime excluyendo inmutables, decodificación de tx canónica y de la aprobación, snapshots históricos, bindings y lecturas actuales. `npm run check:live` fue ejecutado y pasó. Detalle reproducible: `audit-context/LIVE_CHECKS.md`.

**No analizado como parte de esta fase:** exactitud económica del closed-form frente a búsqueda exhaustiva fuera de las pruebas existentes; benchmark económico; UI completa; propiedad/administración del PoolManager oficial; todos los métodos de v4 que ARBFOLD no alcanza; historial completo de transacciones posterior al demo canónico.

## Preguntas abiertas

- ¿El PASS público debe incorporar las comprobaciones de pool keys, operator, claims/reservas y backing que hoy sólo ejecuta `VerifyArbFoldDeployment`, o la división actual entre monitor JS y verificador Solidity es deliberada?
- ¿`residual <= RESIDUAL_THRESHOLD` es requisito de todo fold o únicamente de la demo canónica? El contrato permite terminar por `MAX_ROUNDS` con residual mayor.
- ¿La igualdad exacta claim/reserva debe ser permanente frente a transferencias ERC-6909 entrantes de terceros? Está verificada en deployment, no enforced en runtime.
- ¿El sistema genérico pretende aceptar cualquier implementación que satisfaga `IArbFoldHook`, o sólo el runtime exacto de `ArbFoldHook`? El configurador implementa lo primero; la evidencia pública opera como lo segundo.
