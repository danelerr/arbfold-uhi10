import { useCallback, useEffect, useState } from "react";
import { BenchmarkDemo } from "./components/BenchmarkDemo";
import { SwapLabDialog } from "./components/SwapLabDialog";
import {
  EXPLORER_URL,
  loadBenchmark,
  loadManifest,
  readLiveState,
  verifyDeployment,
} from "./lib/arbfold";
import type { BenchmarkRow, DeploymentManifest } from "./types";

const REPOSITORY = "https://github.com/danelerr/arbfold-uhi10";
const RELEASE_REF = `${REPOSITORY}/blob/uhi10-submission`;

export default function App() {
  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [manifest, setManifest] = useState<DeploymentManifest | null>(null);
  const [liveReady, setLiveReady] = useState(false);
  const [proofLabel, setProofLabel] = useState("Verifying public deployment");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    let active = true;
    loadBenchmark()
      .then((nextRows) => { if (active) setRows(nextRows); })
      .catch(() => { if (active) setProofLabel("Benchmark data unavailable"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function initializeDeployment() {
      try {
        const nextManifest = await loadManifest();
        if (!active) return;
        setManifest(nextManifest);
        const state = await verifyDeployment(nextManifest);
        if (!active) return;
        setLiveReady(true);
        setProofLabel(`Public deployment verified · block ${state.blockNumber.toLocaleString("en-US")}`);
      } catch {
        if (!active) return;
        setLiveReady(false);
        setProofLabel("Public RPC verification unavailable");
      }
    }
    void initializeDeployment();
    return () => { active = false; };
  }, []);

  const refreshLiveState = useCallback(async () => {
    if (!manifest) return;
    const state = await readLiveState(manifest);
    setLiveReady(true);
    setProofLabel(`Public deployment verified · block ${state.blockNumber.toLocaleString("en-US")}`);
  }, [manifest]);

  const closeDialog = useCallback(() => setDialogOpen(false), []);
  const transactionUrl = manifest
    ? `${EXPLORER_URL}/tx/${manifest.canonicalDemoTransaction}`
    : EXPLORER_URL;

  return (
    <>
      <a className="skip-link" href="#main">Skip to demo</a>
      <header className="site-header shell">
        <a className="brand" href="#top" aria-label="ARBFOLD demo home">
          <span className="brand-mark">A</span>
          <span>ARBFOLD</span>
        </a>
        <a className="header-link" href={REPOSITORY}>GitHub</a>
      </header>

      <main id="main">
        <BenchmarkDemo rows={rows} onOpenTestnet={() => setDialogOpen(true)} />

        <section className="verify shell" aria-labelledby="verify-title">
          <div className="section-label">
            <h2 id="verify-title">Verify everything</h2>
            <p>{proofLabel}</p>
          </div>
          <nav className="verify-links" aria-label="Technical evidence">
            <a href={transactionUrl} target="_blank" rel="noreferrer">Onchain transaction</a>
            <a href={`${RELEASE_REF}/benchmark/optimized-release-candidate-results/REPORT.md`}>v0.1 benchmark</a>
            <a href={`${REPOSITORY}/tree/uhi10-submission/contracts/test`}>Tests and invariants</a>
            <a href={`${RELEASE_REF}/docs/ARCHITECTURE.md`}>Architecture</a>
          </nav>
          <p className="evidence-summary">82 Solidity tests · release fuzzing · stateful invariants · versioned raw evidence</p>
        </section>
      </main>

      <SwapLabDialog
        open={dialogOpen}
        onClose={closeDialog}
        manifest={manifest}
        liveReady={liveReady}
        proofLabel={proofLabel}
        onLiveStateChanged={refreshLiveState}
      />

      <footer className="site-footer shell">
        <span>ARBFOLD</span>
        <span>Direct state settlement for cyclic arbitrage · research-grade.</span>
      </footer>
    </>
  );
}
