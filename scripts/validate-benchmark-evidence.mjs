#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  deriveBenchmarkFacts,
} from "../app/benchmark-core.js";
import { validateBenchmarkEvidenceWithProvenance } from "./benchmark-provenance.mjs";

const evidencePath = process.argv[2];

if (!evidencePath || process.argv.length !== 3) {
  console.error("Usage: node scripts/validate-benchmark-evidence.mjs <raw.json>");
  process.exit(64);
}

try {
  const source = await readFile(resolve(evidencePath), "utf8");
  const validated = await validateBenchmarkEvidenceWithProvenance(JSON.parse(source), {
    environmentPath: process.env.ARBFOLD_ENVIRONMENT_PATH
      ? resolve(process.env.ARBFOLD_ENVIRONMENT_PATH)
      : undefined,
  });
  const { payload } = validated;
  const canonicalRows = payload.frozen_grid.filter((row) => row.input_tokens === 100_000);
  if (canonicalRows.length !== 1) {
    throw new Error("validated evidence must contain exactly one canonical 100k row");
  }
  process.stdout.write(`${JSON.stringify({
    canonical: canonicalRows[0],
    facts: deriveBenchmarkFacts(payload),
    residual_threshold_wei_a: payload.residual_threshold_wei_a,
    provenance: validated.provenance,
  })}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
