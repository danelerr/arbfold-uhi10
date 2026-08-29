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
      <p className="eyebrow">Confirmed on Unichain Sepolia</p>
      <h3 id="swap-result-title">{decoded ? (folded ? "ARBFOLD completed" : "Swap completed") : "Transaction confirmed"}</h3>

      <div className="result-trade">
        <div><span>You sent</span><strong>{tokenAmount(result.input)} {inputSymbol}</strong></div>
        <i aria-hidden="true">→</i>
        <div><span>You received</span><strong>{result.output === null ? "Unavailable" : `${tokenAmount(result.output)} ${outputSymbol}`}</strong></div>
      </div>

      {decoded && folded && (
        <div className="result-story">
          <p>What happened next</p>
          <ol>
            <li>The {poolLeft}/{poolRight} pool moved</li>
            <li>A profitable cycle was found across the three pools</li>
            <li>ARBFOLD applied {result.rounds?.toString()} verified {result.rounds === 1n ? "fold" : "folds"}</li>
            <li>Remaining arbitrage: {result.residual === null ? "—" : tokenAmount(result.residual)} ARFY</li>
          </ol>
          <CycleFoldAnimation cycle={cycle} folded />
        </div>
      )}

      {decoded && !folded && (
        <p className="no-fold-result">ARBFOLD checked the three-pool network. This swap did not require a profitable fold.</p>
      )}

      {result.decodeWarning && (
        <p className="lab-error" role="status">The transaction was confirmed, but some receipt events could not be decoded: {result.decodeWarning}</p>
      )}

      <dl className="lab-metrics">
        <div><dt>Gas</dt><dd>{result.gasUsed.toLocaleString("en-US")}</dd></div>
        <div><dt>Fold rounds</dt><dd>{result.rounds?.toString() ?? "—"}</dd></div>
        <div><dt>Solver reward</dt><dd>{result.reward === null ? "—" : `${tokenAmount(result.reward)} ARFY`}</dd></div>
        <div><dt>Remaining arbitrage</dt><dd>{result.residual === null ? "—" : `${tokenAmount(result.residual)} ARFY`}</dd></div>
      </dl>

      <div className="result-actions">
        <button className="button primary" type="button" onClick={onReset}>Run another swap</button>
        <a className="button quiet" href={`${EXPLORER_URL}/tx/${result.hash}`} target="_blank" rel="noreferrer">View transaction</a>
      </div>
    </section>
  );
}
