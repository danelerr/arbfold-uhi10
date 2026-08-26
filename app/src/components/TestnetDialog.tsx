import { useEffect, useRef, useState } from "react";
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

type DemoStage = "verify" | "connect" | "prepare" | "gas" | "execute" | "complete";

export function TestnetDialog({
  open,
  onClose,
  manifest,
  liveReady,
  proofLabel,
  onLiveStateChanged,
}: TestnetDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [retryingVerification, setRetryingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState("");
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

  const stage: DemoStage = !liveReady
    ? "verify"
    : !demo.account
      ? "connect"
      : demo.result
        ? "complete"
        : !demo.prepared
          ? "prepare"
          : !demo.hasGas
            ? "gas"
            : "execute";

  const quoteLabel = demo.quoteLoading
    ? "Updating quote"
    : demo.quote !== null
      ? `${tokenAmount(demo.quote)} ARFY`
      : "Calculated before signing";

  const retryVerification = async () => {
    setRetryingVerification(true);
    setVerificationError("");
    try {
      await onLiveStateChanged();
    } catch {
      setVerificationError("The public RPC did not respond. The deployment is unchanged; try again in a moment.");
    } finally {
      setRetryingVerification(false);
    }
  };

  const preparationDescription = demo.preparationTransactions === 2
    ? "First get free ARFX. Then allow this demo router to use it for your swap."
    : demo.needsMint
      ? "Get free ARFX for your test swap."
      : "Allow this demo router to use ARFX for your test swap.";
  const prepareButtonLabel = demo.preparationTransactions === 2
    ? "Get ARFX and allow demo swap"
    : demo.needsMint
      ? "Get free ARFX"
      : "Allow demo swap";
  const verificationUnavailable = proofLabel.toLowerCase().includes("unavailable");

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
            <h2 id="testnet-title">Try ARBFOLD live</h2>
            <p className="dialog-intro">Create a three-pool arbitrage cycle with valueless test tokens, then fold it directly.</p>
          </div>
          <button id="dialog-close" className="close-button" type="button" onClick={onClose}>Close</button>
        </header>

        {liveReady && (
          <ol className="demo-progress" aria-label="Testnet demo progress">
            <li data-state={demo.account ? "complete" : stage === "connect" ? "active" : "pending"}>
              <span>1</span><b>Wallet</b>
            </li>
            <li data-state={demo.prepared || demo.result ? "complete" : stage === "prepare" || stage === "gas" ? "active" : "pending"}>
              <span>2</span><b>Prepare demo</b>
            </li>
            <li data-state={demo.result ? "complete" : stage === "execute" ? "active" : "pending"}>
              <span>3</span><b>Run swap</b>
            </li>
          </ol>
        )}

        {demo.account && stage !== "complete" && (
          <div className="session-strip" aria-label="Connected testnet session">
            <span>Connected</span>
            <strong>{abbreviated(demo.account)}</strong>
            <span>{demo.gasBalance}</span>
          </div>
        )}

        <div id="execute-live" className="demo-stage">
          {stage === "verify" && (
            <section className="stage-card" aria-labelledby="verify-stage-title">
              <p className="stage-kicker">Before you begin</p>
              <h3 id="verify-stage-title">Checking the public deployment</h3>
              <p>Wallet actions stay unavailable until the page confirms that the deployed router and pools match the published manifest.</p>
              {verificationUnavailable ? (
                <div className="stage-actions">
                  <button className="button secondary" type="button" disabled={retryingVerification} onClick={retryVerification}>
                    {retryingVerification ? "Checking deployment" : "Retry verification"}
                  </button>
                  <span className="action-explanation">{retryingVerification ? "Reading Unichain Sepolia now." : "The public RPC did not answer the first request."}</span>
                </div>
              ) : <p className="busy-status" role="status">{proofLabel}</p>}
              {verificationError && <p className="form-error" role="alert">{verificationError}</p>}
            </section>
          )}

          {stage === "connect" && (
            <section className="stage-card" aria-labelledby="connect-stage-title">
              <p className="stage-kicker">Step 1 of 3</p>
              <h3 id="connect-stage-title">Connect a testnet wallet</h3>
              <p>Connect to Unichain Sepolia. No transaction is signed yet.</p>
              <div className="demo-scenario" aria-label="Three-pool test scenario">
                <div className="scenario-assets">
                  <div><b>ARFX</b><span>You spend</span></div>
                  <i>ARFX / ARFY</i>
                  <div><b>ARFY</b><span>You receive</span></div>
                  <i>ARFY / ARFZ</i>
                  <div><b>ARFZ</b><span>Closes the cycle</span></div>
                </div>
                <span className="scenario-return">Third pool: ARFZ / ARFX</span>
                <p><strong>Your ARFX-to-ARFY swap moves the first pool.</strong> That opens a cycle across three pools. A normal backrun uses three swaps; ARBFOLD applies the verified end state directly.</p>
                <small><strong>No real assets are involved.</strong> These tokens have no market value. Test ETH is used only for gas.</small>
              </div>
              {demo.candidate ? (
                <div className="stage-actions">
                  <button id="live-connect" className="button primary" type="button" disabled={demo.busy} onClick={demo.connect}>
                    {demo.activeAction === "connect" ? "Opening wallet" : `Connect ${demo.candidateName}`}
                  </button>
                </div>
              ) : (
                <div className="stage-actions">
                  <a id="wallet-provider-help" className="button secondary" href="https://metamask.io/download/" target="_blank" rel="noreferrer">Install MetaMask</a>
                  <span className="action-explanation">No compatible browser wallet was detected.</span>
                </div>
              )}
              {(demo.activeAction === "connect" || demo.error) && <p id="live-action-status" className={demo.error ? "form-error" : "busy-status"} role="status" aria-live="polite">{demo.status}</p>}
            </section>
          )}

          {stage === "prepare" && (
            <section className="stage-card" aria-labelledby="prepare-stage-title">
              <p className="stage-kicker">Step 2 of 3</p>
              <h3 id="prepare-stage-title">Prepare the demo</h3>
              <p>Get free ARFX for your swap and allow the demo router to use it.</p>
              <div className="confirmation-summary">
                <strong>{demo.preparationTransactions} wallet confirmation{demo.preparationTransactions === 1 ? "" : "s"}</strong>
                <span>{preparationDescription}</span>
              </div>
              <div className="stage-actions">
                <button id="live-prepare" className="button primary" type="button" disabled={demo.busy} onClick={demo.prepare}>
                  {demo.activeAction === "prepare" ? "Waiting for wallet" : prepareButtonLabel}
                </button>
              </div>
              {(demo.activeAction === "prepare" || demo.error) && <p id="live-action-status" className={demo.error ? "form-error" : "busy-status"} role="status" aria-live="polite">{demo.status}</p>}
            </section>
          )}

          {stage === "gas" && (
            <section className="stage-card" aria-labelledby="gas-stage-title">
              <p className="stage-kicker">Test ETH needed</p>
              <h3 id="gas-stage-title">Add testnet gas to continue</h3>
              <p>Your ARFX is ready, but this wallet has no Unichain Sepolia test ETH. Test ETH has no market value and is used only to pay network gas.</p>
              <div className="stage-actions">
                <button className="button secondary" type="button" disabled={demo.busy} onClick={demo.refresh}>
                  {demo.activeAction === "refresh" ? "Checking balance" : "Check balance again"}
                </button>
                <span className="action-explanation">Current balance: {demo.gasBalance}</span>
              </div>
              {(demo.activeAction === "refresh" || demo.error) && <p className={demo.error ? "form-error" : "busy-status"} role="status" aria-live="polite">{demo.status}</p>}
            </section>
          )}

          {stage === "execute" && (
            <section className="stage-card execute-card" aria-labelledby="execute-stage-title">
              <p className="stage-kicker">Step 3 of 3</p>
              <h3 id="execute-stage-title">Create the cycle and run ARBFOLD</h3>
              <p>Swap ARFX for ARFY. This moves the first pool, opens the three-pool cycle and folds it before the transaction ends.</p>

              <ol className="execution-story" aria-label="What happens in this transaction">
                <li><span>1</span><b>Your swap moves ARFX / ARFY</b></li>
                <li><span>2</span><b>The three-pool cycle opens</b></li>
                <li><span>3</span><b>ARBFOLD applies the final state</b></li>
              </ol>

              <div className="trade-form">
                <label className="trade-field" htmlFor="wallet-amount">
                  <span>You spend</span>
                  <div>
                    <input id="wallet-amount" inputMode="decimal" value={demo.amount} onChange={(event) => demo.setAmount(event.target.value)} aria-describedby="wallet-amount-help" />
                    <b>ARFX</b>
                  </div>
                  <small id="wallet-amount-help" className={demo.amountError ? "form-error" : ""}>{demo.amountError || "Free test token · choose 100–25,000"}</small>
                </label>

                <span className="trade-direction" aria-hidden="true">to</span>

                <div className="trade-field trade-output" aria-live="polite">
                  <span>Estimated receive</span>
                  <output>{quoteLabel}</output>
                  <small>Free ARFY test token · final quote is checked before signing</small>
                </div>
              </div>

              <div className="stage-actions execute-actions">
                <button id="live-execute" className="button primary" type="button" disabled={demo.busy || Boolean(demo.amountError)} onClick={demo.execute}>
                  {demo.activeAction === "execute" ? "Transaction in progress" : "Swap ARFX and run ARBFOLD"}
                </button>
                <span className="action-explanation">One transaction on testnet.</span>
              </div>
              {(demo.activeAction === "execute" || demo.error) && <p id="live-action-status" className={demo.error ? "form-error" : "busy-status"} role="status" aria-live="polite">{demo.status}</p>}
            </section>
          )}

          {stage === "complete" && demo.result && (
            <section id="live-result" className="stage-card success-card" aria-labelledby="complete-stage-title">
              <p className="stage-kicker">Confirmed on Unichain Sepolia</p>
              <h3 id="complete-stage-title">ARBFOLD folded the cycle</h3>
              <p>Your swap moved ARFX / ARFY. ARBFOLD then replaced the three-swap backrun with a direct, verified reserve transition.</p>
              <dl className="result-summary">
                <div><dt>You received</dt><dd>{tokenAmount(demo.result.output)} ARFY</dd></div>
                <div><dt>Fold rounds</dt><dd>{demo.result.rounds.toString()}</dd></div>
                <div><dt>Remaining cycle</dt><dd>{demo.result.residual.toString()} wei</dd></div>
                <div><dt>Gas used</dt><dd>{demo.result.gasUsed.toLocaleString("en-US")}</dd></div>
              </dl>
              <div className="stage-actions">
                <a id="live-result-tx" className="button primary" href={`${EXPLORER_URL}/tx/${demo.result.hash}`} target="_blank" rel="noreferrer">View transaction</a>
                <button className="button quiet" type="button" onClick={demo.resetResult}>Run another test</button>
              </div>
            </section>
          )}
        </div>

        <details className="simulation-fallback">
          <summary>Preview without a wallet</summary>
          <p className="simulation-explainer">Run a read-only call against the same deployed contracts. It estimates the ARFX-to-ARFY output and gas without signing or changing blockchain state.</p>
          <div className="simulation-form">
            <label htmlFor="live-amount">
              <span>ARFX to simulate</span>
              <div><input id="live-amount" inputMode="decimal" value={demo.simulationAmount} onChange={(event) => demo.setSimulationAmount(event.target.value)} /><b>ARFX</b></div>
              <small className={demo.simulationError ? "error" : ""}>{demo.simulationError || "Choose 100–25,000"}</small>
            </label>
            <button id="live-simulate" className="button secondary" type="button" disabled={demo.busy || !liveReady || Boolean(demo.simulationError)} onClick={demo.simulate}>
              {demo.activeAction === "simulate" ? "Running preview" : "Preview transaction"}
            </button>
          </div>
          <p className="simulation-result" role="status" aria-live="polite">{demo.simulationStatus}</p>
        </details>

        <footer className="dialog-footer">
          <span className={`proof-status ${liveReady ? "ready" : "pending"}`}>{liveReady ? "Deployment verified" : proofLabel}</span>
          <span>Test tokens only · not audited</span>
        </footer>
      </div>
    </dialog>
  );
}
