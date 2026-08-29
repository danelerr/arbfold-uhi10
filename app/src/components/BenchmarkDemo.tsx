import { useEffect, useMemo, useRef, useState } from "react";
import type { BenchmarkRow } from "../types";

interface BenchmarkDemoProps {
  rows: BenchmarkRow[];
  onOpenTestnet: () => void;
}

const replaySequence = [
  "backrun-0",
  "backrun-1",
  "backrun-2",
  "backrun-3",
  "backrun-4",
  "direct-0",
  "direct-1",
  "direct-2",
] as const;

export function BenchmarkDemo({ rows, onOpenTestnet }: BenchmarkDemoProps) {
  const [selectedSize, setSelectedSize] = useState(100_000);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const timers = useRef<number[]>([]);
  const selected = useMemo(
    () => rows.find((row) => row.size === selectedSize) ?? rows.find((row) => row.size === 100_000) ?? rows[0],
    [rows, selectedSize],
  );

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  function replay() {
    if (!selected || running) return;
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setActiveStep(null);
    setCompletedSteps(new Set());
    setComplete(false);
    setRunning(true);
    replaySequence.forEach((step, index) => {
      timers.current.push(window.setTimeout(() => {
        setActiveStep(step);
        setCompletedSteps(new Set(replaySequence.slice(0, index)));
      }, 220 + index * 260));
    });
    timers.current.push(window.setTimeout(() => {
      setActiveStep(null);
      setCompletedSteps(new Set(replaySequence));
      setRunning(false);
      setComplete(true);
    }, 220 + replaySequence.length * 260));
  }

  const stepClass = (key: string) => [
    activeStep === key ? "is-active" : "",
    completedSteps.has(key) ? "is-done" : "",
  ].filter(Boolean).join(" ");

  const reduction = selected?.reduction ?? 0;
  const gasDelta = selected ? selected.backrun - selected.direct : 0;
  const resultLabel = reduction >= 0
    ? `${Math.abs(reduction).toFixed(2)}% less gas`
    : `${Math.abs(reduction).toFixed(2)}% more gas`;

  return <>
    <section id="top" className="hero shell">
      <div className="hero-copy">
        <p className="eyebrow">Controlled Foundry Benchmark</p>
        <h1><span>3 arbitrage swaps.</span><em>1 verified transition.</em></h1>
        <p className="hero-summary">ARBFOLD reaches the same result without replaying three arbitrage swaps.</p>
        <div className="hero-actions">
          <button id="replay-demo" className="button primary" type="button" disabled={!selected || running} onClick={replay}>
            {running ? "Replaying…" : complete ? "Replay again" : "Replay demo"}
          </button>
          <button id="hero-execute" className="button secondary" type="button" onClick={onOpenTestnet}>Open Swap Lab</button>
          <a className="button quiet" href="https://github.com/danelerr/arbfold-uhi10">GitHub</a>
        </div>
      </div>

      <div id="replay-console" className={`comparison ${running ? "is-replaying" : ""}`} aria-label="ARBFOLD interactive benchmark">
          <div className="paths">
            <article className="execution-path conventional-path">
              <header><span>3-swap backrun</span><strong><b>{selected?.backrun.toLocaleString("en-US") ?? "—"}</b><small>gas</small></strong></header>
              <div className="steps conventional-steps">
                {['User swap', 'Swap A/B', 'Swap B/C', 'Swap C/A', 'Reinject'].map((label, index) => (
                  <span className={stepClass(`backrun-${index}`)} key={label}>{label}</span>
                ))}
              </div>
            </article>
            <article className="execution-path direct-path">
              <header><span>ARBFOLD</span><strong><b>{selected?.direct.toLocaleString("en-US") ?? "—"}</b><small>gas</small></strong></header>
              <div className="steps direct-steps">
                {['Same user swap', 'Verify cycle', 'Apply state'].map((label, index) => (
                  <span className={stepClass(`direct-${index}`)} key={label}>{label}</span>
                ))}
              </div>
            </article>
          </div>

          <div id="replay-result" className="result is-revealed" aria-live="polite">
            <div className="result-number">
              <span><b>{selected ? `${selected.size / 1_000}k` : "—"}</b> benchmark</span>
              <strong className={reduction < 0 ? "regression" : ""}>{selected ? resultLabel : "Loading benchmark"}</strong>
              <small>{selected ? `${Math.abs(gasDelta).toLocaleString("en-US")} ${gasDelta >= 0 ? "gas avoided" : "additional gas"}` : ""}</small>
            </div>
            <dl className="result-facts">
              <div><dt>User output</dt><dd>Same</dd></div>
              <div><dt>Solver reward</dt><dd>Same</dd></div>
              <div><dt>Final reserves</dt><dd>Equivalent</dd></div>
            </dl>
          </div>
          <p id="replay-status" className="replay-status">
            {running ? "Replaying both equivalent execution paths…" : complete ? "Replay complete · same output · same reward · equivalent final reserves" : selected ? `Selected ${selected.size / 1_000}k benchmark` : "Loading benchmark"}
          </p>
        </div>
    </section>

    <section className="why shell" aria-labelledby="why-title">
      <h2 id="why-title">Why?</h2>
      <p>Arbitrage normally reconciles these pools through three additional swaps. ARBFOLD asks: if cooperating pools can verify the same final state, why replay every intermediate trade?</p>
    </section>

    <section className="benchmark shell" aria-labelledby="benchmark-title">
      <div className="section-label"><h2 id="benchmark-title">Full benchmark</h2><p>Workload-dependent. ARBFOLD is not always cheaper.</p></div>
      <div className="benchmark-grid" role="group" aria-label="Benchmark workload">
          {rows.map((row) => (
            <button
              className={row.size === selected?.size ? "active" : ""}
              data-size={row.size}
              key={row.size}
              type="button"
              onClick={() => { setSelectedSize(row.size); setComplete(false); }}
            >
              <span>{row.size / 1_000}k</span>
              <strong className={row.reduction < 0 ? "regression" : ""}>{row.reduction >= 0 ? "−" : "+"}{Math.abs(row.reduction).toFixed(2)}%</strong>
            </button>
          ))}
      </div>
      <p className="benchmark-boundary">La testnet pública es mutable. Las transacciones live son exploratorias y no se utilizan como benchmark de gas apples-to-apples.</p>
      <a className="inline-link" href="https://github.com/danelerr/arbfold-uhi10/blob/main/benchmark/release-candidate-results/REPORT.md">View methodology</a>
    </section>
  </>;
}
