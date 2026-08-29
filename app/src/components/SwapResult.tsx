import { poolSymbols, TOKEN_SYMBOLS } from "../../swap-lab-core.js";
import { EXPLORER_URL, tokenAmount } from "../lib/arbfold";
import type { SwapLabResult } from "../types";
import { CycleFoldAnimation } from "./CycleFoldAnimation";

interface SwapResultProps {
  result: SwapLabResult;
  onReset: () => void;
}

export function SwapResult({ result, onReset }: SwapResultProps) {
  const inputSymbol = TOKEN_SYMBOLS[result.inputRole];
  const outputSymbol = TOKEN_SYMBOLS[result.outputRole];
  const [poolLeft, poolRight] = poolSymbols(result.hook);
  const cycle = [result.inputRole, result.outputRole, (["a", "b", "c"] as const).find((role) => role !== result.inputRole && role !== result.outputRole)!, result.inputRole];
  const folded = result.rounds !== null && result.rounds > 0n;
  const decoded = !result.decodeWarning;

  return (
    <section id="swap-lab-result" className="swap-result" aria-labelledby="swap-result-title">
      <p className="eyebrow">Confirmado en Unichain Sepolia</p>
      <h3 id="swap-result-title">{decoded ? (folded ? "ARBFOLD completado" : "Swap completado") : "Transacción confirmada"}</h3>

      <div className="result-trade">
        <div><span>Enviaste</span><strong>{tokenAmount(result.input)} {inputSymbol}</strong></div>
        <i aria-hidden="true">→</i>
        <div><span>Recibiste</span><strong>{result.output === null ? "No disponible" : `${tokenAmount(result.output)} ${outputSymbol}`}</strong></div>
      </div>

      {decoded && folded && (
        <div className="result-story">
          <p>Qué ocurrió después</p>
          <ol>
            <li>El pool {poolLeft}/{poolRight} cambió</li>
            <li>Se encontró un ciclo rentable entre los tres pools</li>
            <li>ARBFOLD aplicó {result.rounds?.toString()} {result.rounds === 1n ? "fold verificado" : "folds verificados"}</li>
            <li>Arbitraje restante: {result.residual === null ? "—" : tokenAmount(result.residual)} ARFY</li>
          </ol>
          <CycleFoldAnimation cycle={cycle} folded />
        </div>
      )}

      {decoded && !folded && (
        <p className="no-fold-result">ARBFOLD revisó la red de tres pools. No fue necesario ejecutar ningún fold rentable para este swap.</p>
      )}

      {result.decodeWarning && (
        <p className="lab-error" role="status">La transacción sí fue confirmada, pero no se pudieron leer todos sus eventos: {result.decodeWarning}</p>
      )}

      <dl className="lab-metrics">
        <div><dt>Gas</dt><dd>{result.gasUsed.toLocaleString("en-US")}</dd></div>
        <div><dt>Rondas de fold</dt><dd>{result.rounds?.toString() ?? "—"}</dd></div>
        <div><dt>Recompensa del solver</dt><dd>{result.reward === null ? "—" : `${tokenAmount(result.reward)} ARFY`}</dd></div>
        <div><dt>Arbitraje restante</dt><dd>{result.residual === null ? "—" : `${tokenAmount(result.residual)} ARFY`}</dd></div>
      </dl>

      <div className="result-actions">
        <button className="button primary" type="button" onClick={onReset}>Ejecutar otro swap</button>
        <a className="button quiet" href={`${EXPLORER_URL}/tx/${result.hash}`} target="_blank" rel="noreferrer">Ver transacción</a>
      </div>
    </section>
  );
}
