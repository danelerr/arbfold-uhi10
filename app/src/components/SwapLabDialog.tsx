import { useEffect, useRef } from "react";
import { EXPLORER_URL, abbreviated, tokenAmount } from "../lib/arbfold";
import type { DeploymentManifest } from "../types";
import { useSwapLab } from "../hooks/useSwapLab";
import { SwapComposer } from "./SwapComposer";
import { SwapResult } from "./SwapResult";

interface SwapLabDialogProps {
  open: boolean;
  onClose: () => void;
  manifest: DeploymentManifest | null;
  liveReady: boolean;
  proofLabel: string;
  onLiveStateChanged: () => Promise<void>;
}

export function SwapLabDialog({
  open,
  onClose,
  manifest,
  liveReady,
  proofLabel,
  onLiveStateChanged,
}: SwapLabDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lab = useSwapLab({ manifest, liveReady, onLiveStateChanged });

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

  return (
    <dialog
      id="swap-lab-dialog"
      className="swap-lab-dialog"
      aria-labelledby="swap-lab-title"
      ref={dialog}
      onClick={(event) => { if (event.target === dialog.current) onClose(); }}
    >
      <div className="lab-shell">
        <header className="lab-header">
          <div>
            <p className="eyebrow">Unichain Sepolia · Immutable v0 live deployment</p>
            <h2 id="swap-lab-title">Try ARBFOLD on testnet</h2>
            <p>Make one real test-token swap. ARBFOLD then checks the three-pool cycle and folds any profitable arbitrage before the transaction ends.</p>
          </div>
          <button id="swap-lab-close" className="close-button" type="button" onClick={onClose}>Close</button>
        </header>

        <section className="lab-context" aria-label="Demo tokens and pools">
          <div className="lab-context-copy">
            <span>Demo network</span>
            <p>Three valueless test tokens used only to demonstrate ARBFOLD on Unichain Sepolia.</p>
          </div>
          <div className="network-assets">
            <div className="token-list">
              <span><b>ARFX</b><small>valueless test token</small></span>
              <span><b>ARFY</b><small>valueless test token</small></span>
              <span><b>ARFZ</b><small>valueless test token</small></span>
            </div>
            <div className="pool-group">
              <small>Three Uniswap v4 pools</small>
              <div className="pool-list" aria-label="Three Uniswap v4 pools">
                <span>ARFX / ARFY</span><span>ARFX / ARFZ</span><span>ARFY / ARFZ</span>
              </div>
            </div>
          </div>
        </section>

        <div className="lab-surface">
          {lab.result
            ? <SwapResult result={lab.result} onReset={lab.resetResult} />
            : <SwapComposer lab={lab} liveReady={liveReady} />}
        </div>

        <details className="lab-details">
          <summary>Demo details</summary>
          <dl>
            <div><dt>Deployment</dt><dd>{liveReady ? "Public v0 deployment checked" : proofLabel}</dd></div>
            <div><dt>Wallet</dt><dd>{lab.account ? abbreviated(lab.account) : "Not connected"}</dd></div>
            <div><dt>Gas</dt><dd>{lab.account ? lab.gasBalanceLabel : "—"}</dd></div>
            <div><dt>Selected route</dt><dd>{lab.inputToken.symbol} → {lab.outputToken.symbol} · hook {lab.route.hook} · zeroForOne {String(lab.route.zeroForOne)}</dd></div>
            <div><dt>Input balance</dt><dd>{lab.account ? `${tokenAmount(lab.balances[lab.inputRole], 6, lab.inputToken.decimals)} ${lab.inputToken.symbol}` : "—"}</dd></div>
          </dl>
          <p>The visible quote is calculated from public reserves without signing or changing state.</p>
          {manifest && <a href={`${EXPLORER_URL}/tx/${manifest.canonicalDemoTransaction}`} target="_blank" rel="noreferrer">View the public reference transaction</a>}
        </details>
      </div>
    </dialog>
  );
}
