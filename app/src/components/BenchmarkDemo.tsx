import { useEffect, useMemo, useRef, useState } from "react";
import type { BenchmarkRow } from "../types";

interface BenchmarkDemoProps {
  rows: BenchmarkRow[];
  onOpenTestnet: () => void;
}

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
  const referenceSteps = useMemo(() => {
    if (!selected) return [];
    return [
      "User swap",
      ...Array.from({ length: selected.referenceRounds }, (_, index) => [
        `Round ${index + 1}: 3 arbitrage swaps`,
        `Round ${index + 1}: reinject profit`,
      ]).flat(),
    ];
  }, [selected]);
  const directSteps = useMemo(() => {
    if (!selected) return [];
    return [
      "Same user swap",
      ...Array.from({ length: selected.directRounds }, (_, index) => `Direct settlement round ${index + 1}`),
      "Read final residual",
    ];
  }, [selected]);
  const replaySequence = useMemo(
    () => [
      ...referenceSteps.map((_, index) => `backrun-${index}`),
      ...directSteps.map((_, index) => `direct-${index}`),
    ],
    [directSteps, referenceSteps],
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
        <h1><span>Don’t replay every leg.</span><em>Settle the equivalent state.</em></h1>
        <p className="hero-summary">ARBFOLD applies runtime-checked direct settlement rounds instead of replaying each arbitrage leg.</p>
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
              <header><span>{selected ? `${selected.referenceRounds}-round iterative reference` : "Iterative reference"}</span><strong><b>{selected?.backrun.toLocaleString("en-US") ?? "—"}</b><small>gas</small></strong></header>
              <div className="steps conventional-steps">
                {referenceSteps.map((label, index) => (
                  <span className={stepClass(`backrun-${index}`)} key={label}>{label}</span>
                ))}
              </div>
            </article>
            <article className="execution-path direct-path">
              <header><span>ARBFOLD · one fold() call</span><strong><b>{selected?.direct.toLocaleString("en-US") ?? "—"}</b><small>gas</small></strong></header>
              <div className="steps direct-steps">
                {directSteps.map((label, index) => (
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
              <div><dt>Fixed execution reward</dt><dd>Same</dd></div>
              <div><dt>Final reserves</dt><dd>Equivalent</dd></div>
            </dl>
          </div>
          <p id="replay-status" className="replay-status">
            {running ? "Replaying both equivalent execution paths…" : complete ? "Replay complete · same output · same fixed reward · equivalent final reserves" : selected ? `Selected ${selected.size / 1_000}k benchmark` : "Loading benchmark"}
          </p>
        </div>
    </section>

    <section className="why shell" aria-labelledby="why-title">
      <h2 id="why-title">Why?</h2>
      <p>The iterative reference replays three arbitrage swaps and reinjects profit in every round. One ARBFOLD <code>fold()</code> call can process the equivalent runtime-checked direct settlement rounds.</p>
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
      <p className="benchmark-boundary"><strong>Dense canonical sweep:</strong> 1k–4k execute zero fold rounds and cost more. Every actionable point from 5k–200k was cheaper in the tested canonical path. This is not a universal claim.</p>
      <p className="benchmark-boundary">The public testnet is mutable. Live transactions are exploratory and are not used as an apples-to-apples gas benchmark.</p>
      <a className="inline-link" href="https://github.com/danelerr/arbfold-uhi10/blob/main/benchmark/optimized-release-candidate-results/REPORT.md">View methodology</a>
    </section>
  </>;
}
