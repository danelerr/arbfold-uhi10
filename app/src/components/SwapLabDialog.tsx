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
            <p className="eyebrow">Unichain Sepolia · Swap Lab</p>
            <h2 id="swap-lab-title">ARBFOLD Swap Lab</h2>
            <p>Ejecuta un swap real en testnet y observa cómo ARBFOLD revisa y pliega el ciclo resultante entre tres pools.</p>
          </div>
          <button id="swap-lab-close" className="close-button" type="button" onClick={onClose}>Cerrar</button>
        </header>

        <section className="lab-context" aria-label="Tokens y pools de la demostración">
          <p>Estos son tres tokens de prueba sin valor utilizados únicamente para demostrar ARBFOLD en Unichain Sepolia.</p>
          <div className="token-list">
            <span><b>ARFX</b><small>token de prueba sin valor</small></span>
            <span><b>ARFY</b><small>token de prueba sin valor</small></span>
            <span><b>ARFZ</b><small>token de prueba sin valor</small></span>
          </div>
          <div className="pool-list" aria-label="Tres pools de Uniswap v4">
            <span>ARFX / ARFY</span><span>ARFX / ARFZ</span><span>ARFY / ARFZ</span>
          </div>
        </section>

        <div className="lab-surface">
          {lab.result
            ? <SwapResult result={lab.result} onReset={lab.resetResult} />
            : <SwapComposer lab={lab} liveReady={liveReady} />}
        </div>

        <details className="lab-details">
          <summary>Detalles de la demo</summary>
          <dl>
            <div><dt>Deployment</dt><dd>{liveReady ? "Verificado" : proofLabel}</dd></div>
            <div><dt>Wallet</dt><dd>{lab.account ? abbreviated(lab.account) : "No conectada"}</dd></div>
            <div><dt>Gas</dt><dd>{lab.account ? lab.gasBalanceLabel : "—"}</dd></div>
            <div><dt>Ruta seleccionada</dt><dd>{lab.inputToken.symbol} → {lab.outputToken.symbol} · hook {lab.route.hook} · zeroForOne {String(lab.route.zeroForOne)}</dd></div>
            <div><dt>Balance de entrada</dt><dd>{lab.account ? `${tokenAmount(lab.balances[lab.inputRole], 6, lab.inputToken.decimals)} ${lab.inputToken.symbol}` : "—"}</dd></div>
          </dl>
          <p>La cotización visible se calcula con las reservas públicas sin firmar ni cambiar el estado.</p>
          {manifest && <a href={`${EXPLORER_URL}/tx/${manifest.canonicalDemoTransaction}`} target="_blank" rel="noreferrer">Ver transacción pública de referencia</a>}
        </details>
      </div>
    </dialog>
  );
}
