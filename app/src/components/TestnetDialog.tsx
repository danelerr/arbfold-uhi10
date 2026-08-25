import { useEffect, useRef } from "react";
import { parseUnits } from "viem";
import { parseDemoAmount } from "../../live-core.js";
import { EXPLORER_URL, abbreviated, tokenAmount } from "../lib/arbfold";
import type { DeploymentManifest } from "../types";
import { useArbFoldDemo } from "../hooks/useArbFoldDemo";

interface TestnetDialogProps {
  open: boolean;
  onClose: () => void;
  manifest: DeploymentManifest | null;
  liveReady: boolean;
  proofLabel: string;
  onLiveStateChanged: () => Promise<void>;
}

function inputSummary(value: string): string {
  try {
    return `${tokenAmount(parseUnits(parseDemoAmount(value), 18))} Demo USD-1`;
  } catch {
    return "Enter a valid amount";
  }
}

export function TestnetDialog({
  open,
  onClose,
  manifest,
  liveReady,
  proofLabel,
  onLiveStateChanged,
}: TestnetDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const demo = useArbFoldDemo({ manifest, liveReady, onLiveStateChanged });

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const handleClose = () => onClose();
    node.addEventListener("close", handleClose);
    return () => node.removeEventListener("close", handleClose);
  }, [onClose]);

  const walletStatus = demo.account
    ? abbreviated(demo.account)
    : demo.candidate
      ? `${demo.candidateName} detected`
      : "No browser wallet detected";
  const quoteLabel = demo.quoteLoading
    ? "Calculating…"
    : demo.quote !== null
      ? `${tokenAmount(demo.quote)} Demo ETH`
      : "Quote unavailable";

  return (
    <dialog
      id="testnet-dialog"
      className="testnet-dialog"
      aria-labelledby="testnet-title"
      ref={dialog}
      onClick={(event) => { if (event.target === dialog.current) onClose(); }}
    >
      <div className="dialog-shell">
        <header className="dialog-header">
          <div>
            <p className="eyebrow">Unichain Sepolia · testnet only</p>
            <h2 id="testnet-title">Run one real swap + fold</h2>
            <p className="dialog-intro">Swap valueless test tokens through the deployed ARBFOLD router. Your swap and the three-pool reserve transition settle together in one transaction.</p>
          </div>
          <button id="dialog-close" className="close-button" type="button" onClick={onClose}>Close</button>
        </header>

        <section className="trade-receipt" aria-label="Testnet transaction summary">
          <div className="trade-asset">
            <span>You spend</span>
            <strong>{inputSummary(demo.amount)}</strong>
            <small>Free test token · no market value</small>
          </div>
          <div className="trade-route" aria-hidden="true"><span>User swap</span><b>+</b><span>ARBFOLD</span></div>
          <div className="trade-asset receive-asset">
            <span>Estimated receive</span>
            <strong>{quoteLabel}</strong>
            <small>Demo ETH · no market value</small>
          </div>
        </section>
        <p className="demo-safety"><strong>No real assets are involved.</strong> The only wallet balance used is Unichain Sepolia test ETH for network gas.</p>

        <div id="execute-live" className="wallet-flow">
          <div id="wallet-step-connect" className={`wallet-step ${demo.account ? "is-complete" : liveReady && demo.candidate ? "is-ready" : ""}`}>
            <span className="step-number">1</span>
            <div className="step-copy">
              <strong>Connect your testnet wallet</strong>
              <small>Reads your address and switches MetaMask to Unichain Sepolia. This step does not spend or approve anything.</small>
              <span className={`live-status ${demo.account ? "ready" : !demo.candidate ? "error" : ""}`}>{walletStatus}</span>
              {demo.account && <dl className="wallet-balances"><div><dt>Network gas balance</dt><dd>{demo.gasBalance}</dd></div></dl>}
              {!demo.candidate && <a id="wallet-provider-help" className="wallet-provider-help" href="https://metamask.io/download/" target="_blank" rel="noreferrer">Install a browser wallet</a>}
            </div>
            <button id="live-connect" className="button secondary" type="button" disabled={demo.busy || !liveReady || !demo.candidate || Boolean(demo.account)} onClick={demo.connect}>
              {demo.account ? "Connected" : liveReady ? "Connect wallet" : "Verifying"}
            </button>
          </div>

          <div id="wallet-step-prepare" className={`wallet-step ${demo.prepared ? "is-complete" : demo.account ? "is-ready" : ""}`}>
            <span className="step-number">2</span>
            <div className="step-copy">
              <strong>Create free Demo USD-1</strong>
              <small>Mints the test token to your wallet and grants only this demo router a capped 25,000-token spending limit. MetaMask may ask for two confirmations.</small>
              <dl className="wallet-balances">
                <div><dt>Your Demo USD-1</dt><dd>{demo.account ? tokenAmount(demo.balance) : "Not connected"}</dd></div>
                <div><dt>Router spending limit</dt><dd>{demo.account ? tokenAmount(demo.allowance) : "Not connected"}</dd></div>
              </dl>
            </div>
            <button id="live-prepare" className="button secondary" type="button" disabled={demo.busy || !demo.account || demo.prepared || Boolean(demo.amountError)} onClick={demo.prepare}>
              {demo.prepared ? "Tokens ready" : "Get tokens + approve"}
            </button>
          </div>

          <div id="wallet-step-execute" className={`wallet-step execute-step ${demo.prepared ? "is-ready" : ""}`}>
            <span className="step-number">3</span>
            <div className="execute-content">
              <div className="step-copy">
                <strong>Choose your test-token swap</strong>
                <small>This amount is taken from your Demo USD-1 balance. The router sends Demo ETH and applies ARBFOLD in the same transaction.</small>
              </div>
              <div className="execution-controls">
                <label htmlFor="wallet-amount">
                  <span>You spend</span>
                  <div className="wallet-amount"><input id="wallet-amount" inputMode="decimal" value={demo.amount} onChange={(event) => demo.setAmount(event.target.value)} aria-describedby="wallet-amount-error" /><b>Demo USD-1</b></div>
                  <small id="wallet-amount-error" className={`input-help ${demo.amountError ? "error" : ""}`}>{demo.amountError || "Choose 100–25,000 test tokens · up to 6 decimals"}</small>
                </label>
                <button id="live-execute" className="button primary" type="button" disabled={demo.busy || !demo.prepared || Boolean(demo.amountError)} onClick={demo.execute}>Swap + run ARBFOLD</button>
              </div>
              <dl className="execution-preview">
                <div><dt>Route</dt><dd>Demo USD-1 → Demo ETH</dd></div>
                <div><dt>ARBFOLD action</dt><dd>Verify and apply the three-pool final state</dd></div>
                <div><dt>You sign</dt><dd>One atomic transaction</dd></div>
              </dl>
            </div>
          </div>
          <p id="live-action-status" className="action-status" role="status" aria-live="polite">{demo.status}</p>
        </div>

        {demo.result && <article id="live-result" className="transaction-result">
          <header><div><span>Transaction confirmed on Unichain Sepolia</span><strong>Swap + ARBFOLD completed</strong></div><a id="live-result-tx" className="inline-link" href={`${EXPLORER_URL}/tx/${demo.result.hash}`} target="_blank" rel="noreferrer">View transaction</a></header>
          <dl>
            <div><dt>You received</dt><dd>{tokenAmount(demo.result.output)} Demo ETH</dd></div>
            <div><dt>Direct transitions</dt><dd>{demo.result.rounds.toString()} ({demo.result.roundEvents} event{demo.result.roundEvents === 1 ? "" : "s"})</dd></div>
            <div><dt>Remaining cycle</dt><dd>{demo.result.residual.toString()} wei</dd></div>
            <div><dt>Gas used</dt><dd>{demo.result.gasUsed.toLocaleString("en-US")}</dd></div>
          </dl>
        </article>}

        <details className="simulation-fallback">
          <summary>No wallet? Preview the deployed transaction without signing.</summary>
          <p className="simulation-explainer">This performs an RPC dry-run against the same deployed router. It estimates output and gas, but does not use your wallet, spend tokens or change blockchain state.</p>
          <div className="simulation-form">
            <label htmlFor="live-amount"><span>Test tokens to simulate</span><div><input id="live-amount" inputMode="decimal" value={demo.simulationAmount} onChange={(event) => demo.setSimulationAmount(event.target.value)} /><b>Demo USD-1</b></div><small className={demo.simulationError ? "error" : ""}>{demo.simulationError || "Choose 100–25,000 test tokens · up to 6 decimals"}</small></label>
            <button id="live-simulate" className="button secondary" type="button" disabled={demo.busy || !liveReady || Boolean(demo.simulationError)} onClick={demo.simulate}>Preview output + gas</button>
          </div>
          <p className="simulation-result" role="status" aria-live="polite">{demo.simulationStatus}</p>
        </details>

        <footer className="dialog-footer"><span className={`proof-status ${liveReady ? "ready" : "pending"}`}>{proofLabel}</span><span>Official v4 PoolManager · demo assets only · not audited</span></footer>
      </div>
    </dialog>
  );
}
