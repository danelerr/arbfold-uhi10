import { TOKEN_SYMBOLS } from "../../swap-lab-core.js";
import { tokenAmount } from "../lib/arbfold";
import type { TokenRole } from "../types";
import type { useSwapLab } from "../hooks/useSwapLab";
import { CycleFoldAnimation } from "./CycleFoldAnimation";

type SwapLab = ReturnType<typeof useSwapLab>;

interface SwapComposerProps {
  lab: SwapLab;
  liveReady: boolean;
}

const ROLES: TokenRole[] = ["b", "a", "c"];

function displayAmount(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString("en-US", { maximumFractionDigits: 6 }) : value;
}

function actionCopy(lab: SwapLab, liveReady: boolean) {
  const symbol = lab.inputToken.symbol;
  if (lab.busy) {
    const labels = {
      connect: "Abriendo wallet…",
      switch: "Cambiando red…",
      mint: "Esperando confirmación…",
      approve: "Esperando confirmación…",
      quote: "Actualizando cotización…",
      execute: "Ejecutando swap + ARBFOLD…",
      refresh: "Comprobando gas…",
      preview: "Preparando vista…",
    } as const;
    return { label: labels[lab.activeAction ?? "quote"], explanation: lab.status, disabled: true };
  }
  switch (lab.actionKind) {
    case "verify":
      return {
        label: !liveReady || lab.error ? "Reintentar verificación" : "Verificando deployment…",
        explanation: lab.error || (liveReady ? "Comprobando los símbolos y decimales de los tres tokens." : "El RPC público no pudo confirmar todavía el router y los pools publicados."),
        disabled: liveReady && !lab.error,
      };
    case "install":
      return { label: "Instalar una wallet", explanation: "No se detectó una wallet compatible en este navegador.", disabled: false };
    case "connect":
      return { label: "Conectar wallet", explanation: `Conecta ${lab.candidateName}. Este paso no firma ni gasta nada.`, disabled: false };
    case "switch":
      return { label: "Cambiar a Unichain Sepolia", explanation: "Cambia únicamente la red activa de tu wallet.", disabled: false };
    case "gas":
      return { label: "Volver a comprobar el gas", explanation: "Necesitas una pequeña cantidad de ETH de prueba en Unichain Sepolia para enviar transacciones.", disabled: false };
    case "invalid":
      return { label: "Revisa la cantidad", explanation: lab.amountError, disabled: true };
    case "mint":
      return {
        label: `Obtener ${tokenAmount(lab.missingAmount, 6, lab.inputToken.decimals)} ${symbol} de prueba`,
        explanation: `Crea únicamente los ${symbol} de prueba sin valor que faltan para ejecutar este swap en testnet.`,
        disabled: false,
      };
    case "approve":
      return {
        label: "Permitir este swap",
        explanation: `Permite que el router desplegado de ARBFOLD utilice exactamente ${tokenAmount(lab.parsedAmount, 6, lab.inputToken.decimals)} ${symbol} para esta transacción.`,
        disabled: false,
      };
    case "quote":
      return { label: "Actualizar cotización", explanation: "Lee nuevamente las reservas públicas antes de preparar la transacción.", disabled: lab.quoteLoading };
    case "execute":
      return { label: "Ejecutar swap + ARBFOLD", explanation: "Firmas una sola transacción en Unichain Sepolia.", disabled: false };
  }
}

export function SwapComposer({ lab, liveReady }: SwapComposerProps) {
  const copy = actionCopy(lab, liveReady);
  const cycleText = lab.cycle.map((role) => TOKEN_SYMBOLS[role]).join(" → ");
  const currentAmount = displayAmount(lab.amount);
  const outputOptions = ROLES.filter((role) => role !== lab.inputRole);
  const inputOptions = ROLES.filter((role) => role !== lab.outputRole);
  const actionIsLink = lab.actionKind === "install";
  const handlePrimary = () => {
    if (lab.actionKind === "verify" && (!liveReady || lab.error)) {
      window.location.reload();
      return;
    }
    lab.runPrimaryAction();
  };

  return (
    <>
      <div className="swap-composer" aria-label="ARBFOLD Swap Lab">
        <div className="swap-field">
          <label htmlFor="lab-amount">Envías</label>
          <div className="asset-input">
            <input
              id="lab-amount"
              inputMode="decimal"
              value={lab.amount}
              onChange={(event) => lab.setAmount(event.target.value)}
              aria-describedby="lab-amount-help"
            />
            <strong>{lab.inputToken.symbol}</strong>
          </div>
          <small id="lab-amount-help" className={lab.amountError ? "form-error" : ""}>
            {lab.amountError || "Token de prueba sin valor · 1,000–25,000"}
          </small>
        </div>

        <div className="swap-direction" aria-hidden="true">→</div>

        <div className="swap-field output-field">
          <span>Recibes</span>
          <output>{lab.quoteLoading ? "Actualizando…" : lab.quote === null ? "—" : tokenAmount(lab.quote, 6, lab.outputToken.decimals)}</output>
          <strong>{lab.outputToken.symbol}</strong>
          <small>Cotización actual · se valida otra vez antes de firmar</small>
        </div>
      </div>

      <details className="route-explorer">
        <summary>Explorar otra ruta</summary>
        <div className="route-controls">
          <label>
            Token de entrada
            <select value={lab.inputRole} onChange={(event) => lab.setInputRole(event.target.value as TokenRole)}>
              {inputOptions.map((role) => <option value={role} key={role}>{TOKEN_SYMBOLS[role]}</option>)}
            </select>
          </label>
          <button className="invert-route" type="button" onClick={lab.invertRoute} aria-label="Invertir ruta">⇄</button>
          <label>
            Token de salida
            <select value={lab.outputRole} onChange={(event) => lab.setOutputRole(event.target.value as TokenRole)}>
              {outputOptions.map((role) => <option value={role} key={role}>{TOKEN_SYMBOLS[role]}</option>)}
            </select>
          </label>
        </div>
      </details>

      <section className="cycle-explanation" aria-labelledby="cycle-title">
        <div>
          <p id="cycle-title">Después de tu swap, ARBFOLD revisa este ciclo</p>
          <CycleFoldAnimation cycle={lab.cycle} />
        </div>
        <p>Si recorrer este ciclo devolviera más {lab.inputToken.symbol} de los que se utilizaron al comenzar, existe una oportunidad de arbitraje cíclico.</p>
      </section>

      <section className="what-happens" aria-labelledby="happens-title">
        <h3 id="happens-title">Qué ocurrirá</h3>
        <ol>
          <li><b>Tu swap mueve un pool</b><span>Intercambias {currentAmount} {lab.inputToken.symbol} → {lab.outputToken.symbol}.</span></li>
          <li><b>ARBFOLD revisa el ciclo de tres pools</b><span>{cycleText}</span></li>
          <li><b>Si existe arbitraje, ARBFOLD lo pliega</b><span>En lugar de reproducir tres swaps de arbitraje, los pools aplican directamente la transición verificada equivalente.</span></li>
        </ol>
      </section>

      {lab.confirmationCount === 2 && lab.actionKind === "mint" && (
        <p className="confirmation-note">Se requieren 2 confirmaciones en tu wallet: obtener los tokens de prueba y luego permitir el swap. Se solicitarán una por una.</p>
      )}

      <div className="primary-action-area">
        {actionIsLink ? (
          <a className="button primary lab-primary" href="https://metamask.io/download/" target="_blank" rel="noreferrer">{copy.label}</a>
        ) : (
          <button
            id="lab-primary-action"
            className="button primary lab-primary"
            type="button"
            disabled={copy.disabled}
            onClick={handlePrimary}
          >
            {copy.label}
          </button>
        )}
        <p>{copy.explanation}</p>
      </div>

      {lab.error && <p className="lab-error" role="alert">{lab.error}</p>}
    </>
  );
}
