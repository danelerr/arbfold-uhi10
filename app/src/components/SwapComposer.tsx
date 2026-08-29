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
      connect: "Opening wallet…",
      switch: "Switching network…",
      mint: "Waiting for confirmation…",
      approve: "Waiting for confirmation…",
      quote: "Refreshing quote…",
      execute: "Running swap + ARBFOLD…",
      refresh: "Checking gas…",
      preview: "Preparing preview…",
    } as const;
    return { label: labels[lab.activeAction ?? "quote"], explanation: lab.status, disabled: true };
  }
  switch (lab.actionKind) {
    case "verify":
      return {
        label: !liveReady || lab.error ? "Retry verification" : "Verifying deployment…",
        explanation: lab.error || (liveReady ? "Checking the symbols and decimals of all three tokens." : "The public RPC has not confirmed the deployed router and pools yet."),
        disabled: liveReady && !lab.error,
      };
    case "install":
      return { label: "Install a wallet", explanation: "No compatible browser wallet was detected.", disabled: false };
    case "connect":
      return { label: "Connect wallet", explanation: `Connect ${lab.candidateName}. This step does not sign or spend anything.`, disabled: false };
    case "switch":
      return { label: "Switch to Unichain Sepolia", explanation: "This only changes the active network in your wallet.", disabled: false };
    case "gas":
      return { label: "Check gas balance again", explanation: "You need a small amount of Unichain Sepolia test ETH to send transactions.", disabled: false };
    case "invalid":
      return { label: "Check the amount", explanation: lab.amountError, disabled: true };
    case "mint":
      return {
        label: `Get ${tokenAmount(lab.missingAmount, 6, lab.inputToken.decimals)} test ${symbol}`,
        explanation: `Create only the missing valueless ${symbol} needed for this testnet swap.`,
        disabled: false,
      };
    case "approve":
      return {
        label: "Allow this demo swap",
        explanation: `Allow the deployed ARBFOLD router to use exactly ${tokenAmount(lab.parsedAmount, 6, lab.inputToken.decimals)} ${symbol} for this transaction.`,
        disabled: false,
      };
    case "quote":
      return { label: "Refresh quote", explanation: "Read the current public reserves again before preparing the transaction.", disabled: lab.quoteLoading };
    case "execute":
      return { label: "Run swap + ARBFOLD", explanation: "You sign one transaction on Unichain Sepolia.", disabled: false };
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
          <label htmlFor="lab-amount">You pay</label>
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
            {lab.amountError || "Valueless test token · 1,000–25,000"}
          </small>
        </div>

        <div className="swap-direction" aria-hidden="true">→</div>

        <div className="swap-field output-field">
          <span>You receive</span>
          <output>{lab.quoteLoading ? "Updating…" : lab.quote === null ? "—" : tokenAmount(lab.quote, 6, lab.outputToken.decimals)}</output>
          <strong>{lab.outputToken.symbol}</strong>
          <small>Current quote · checked again before you sign</small>
        </div>
      </div>

      <details className="route-explorer">
        <summary>Explore another route</summary>
        <div className="route-controls">
          <label>
            Input token
            <select value={lab.inputRole} onChange={(event) => lab.setInputRole(event.target.value as TokenRole)}>
              {inputOptions.map((role) => <option value={role} key={role}>{TOKEN_SYMBOLS[role]}</option>)}
            </select>
          </label>
          <button className="invert-route" type="button" onClick={lab.invertRoute} aria-label="Reverse route">⇄</button>
          <label>
            Output token
            <select value={lab.outputRole} onChange={(event) => lab.setOutputRole(event.target.value as TokenRole)}>
              {outputOptions.map((role) => <option value={role} key={role}>{TOKEN_SYMBOLS[role]}</option>)}
            </select>
          </label>
        </div>
      </details>

      <section className="cycle-explanation" aria-labelledby="cycle-title">
        <div>
          <p id="cycle-title">After your swap, ARBFOLD checks this cycle</p>
          <CycleFoldAnimation cycle={lab.cycle} />
        </div>
        <p>If completing this cycle returns more {lab.inputToken.symbol} than it started with, a cyclic arbitrage opportunity exists.</p>
      </section>

      <section className="what-happens" aria-labelledby="happens-title">
        <h3 id="happens-title">What happens</h3>
        <ol>
          <li><b>Your swap moves one pool</b><span>You swap {currentAmount} {lab.inputToken.symbol} → {lab.outputToken.symbol}.</span></li>
          <li><b>ARBFOLD checks all three pools</b><span>{cycleText}</span></li>
          <li><b>If arbitrage exists, ARBFOLD folds it</b><span>Instead of replaying three arbitrage swaps, the pools apply the equivalent verified transition directly.</span></li>
        </ol>
      </section>

      {lab.confirmationCount === 2 && lab.actionKind === "mint" && (
        <p className="confirmation-note">Two wallet confirmations are required: get the test tokens, then allow the swap. They are requested one at a time.</p>
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
