import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RESIDUAL_THRESHOLD_WEI_A,
  validateBenchmarkPayload,
} from "../app/benchmark-core.js";
import {
  optimizedBenchmarkEnvironment,
  optimizedSourceManifest,
} from "./evidence-sources.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const ENVIRONMENT_SCHEMA = "arbfold-v0.1-environment-v5";
const SHA256_HEX = /^[0-9a-f]{64}$/;

function invalid(detail) {
  throw new Error(`Invalid ARBFOLD v0.1 release provenance: ${detail}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseJson(text, detail) {
  try {
    const value = JSON.parse(text);
    if (!isRecord(value)) invalid(`${detail} is not an object`);
    return value;
  } catch (error) {
    if (error instanceof SyntaxError) invalid(`${detail} is not valid JSON`);
    throw error;
  }
}

async function validateManifestEntries(manifestText, rootDir) {
  if (!manifestText.endsWith("\n")) invalid("source manifest must end with one newline");
  const lines = manifestText.slice(0, -1).split("\n");
  if (lines.length === 0 || lines.some((line) => line.length === 0)) {
    invalid("source manifest must contain non-empty entries");
  }

  const seen = new Set();
  const observedPaths = [];
  for (const [index, line] of lines.entries()) {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    if (!match) invalid(`source manifest line ${index + 1} is malformed`);
    const [, expectedDigest, relativePath] = match;
    if (isAbsolute(relativePath) || relativePath.includes("\\")) {
      invalid(`source manifest line ${index + 1} has an unsafe path`);
    }
    const absolutePath = resolve(rootDir, relativePath);
    const fromRoot = relative(rootDir, absolutePath);
    if (fromRoot === "" || fromRoot === ".." || fromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
      || isAbsolute(fromRoot)) {
      invalid(`source manifest line ${index + 1} escapes the repository`);
    }
    if (seen.has(relativePath)) invalid(`source manifest duplicates ${relativePath}`);
    seen.add(relativePath);
    observedPaths.push(relativePath);
    let source;
    try {
      source = await readFile(absolutePath);
    } catch {
      invalid(`source manifest entry is missing from the worktree: ${relativePath}`);
    }
    if (sha256(source) !== expectedDigest) {
      invalid(`source manifest entry does not match the worktree: ${relativePath}`);
    }
  }

  const expectedPaths = [];
  for (const directory of ["contracts/src", "contracts/test"]) {
    const entries = await readdir(resolve(rootDir, directory), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".sol")) {
        expectedPaths.push(`${directory}/${entry.name}`);
      }
    }
  }
  expectedPaths.push("contracts/foundry.toml", "scripts/generate-v01-benchmark.py");
  expectedPaths.sort();
  if (observedPaths.length !== expectedPaths.length
    || !observedPaths.every((path, index) => path === expectedPaths[index])) {
    invalid("source manifest path set does not match the optimized-v0.1 scope");
  }
  return lines.length;
}

function validateEnvironment(environment, payload, manifestDigest) {
  if (environment.schema !== ENVIRONMENT_SCHEMA) {
    invalid(`environment schema must be ${ENVIRONMENT_SCHEMA}`);
  }
  if (!SHA256_HEX.test(environment.source_tree_sha256 ?? "")) {
    invalid("environment source_tree_sha256 is malformed");
  }
  if (environment.source_tree_sha256 !== manifestDigest
    || payload.source_tree_sha256 !== manifestDigest) {
    invalid("raw/environment source_tree_sha256 does not match the source manifest");
  }
  if (environment.residual_threshold_wei_a !== RESIDUAL_THRESHOLD_WEI_A) {
    invalid("environment residual threshold contradicts the benchmark payload");
  }

  const selected = payload.compiler_matrix[0];
  if (environment.selected_compiler_configuration !== selected.name
    || environment.optimizer_enabled !== true
    || environment.optimizer_runs !== selected.optimizer_runs
    || environment.via_ir !== selected.via_ir) {
    invalid("environment selected compiler configuration contradicts compiler_matrix");
  }

  const failed = payload.compiler_matrix[3];
  if (sha256(Buffer.from(failed.error, "utf8")) !== failed.error_sha256) {
    invalid("compiler_matrix compile-failure error_sha256 contradicts its error text");
  }
}

export async function validateBenchmarkEvidenceWithProvenance(
  payload,
  {
    rootDir = ROOT,
    environmentPath = fileURLToPath(optimizedBenchmarkEnvironment),
    manifestPath = fileURLToPath(optimizedSourceManifest),
  } = {},
) {
  const validated = validateBenchmarkPayload(payload);
  const [manifestBytes, environmentText] = await Promise.all([
    readFile(manifestPath),
    readFile(environmentPath, "utf8"),
  ]);
  const manifestText = manifestBytes.toString("utf8");
  const manifestDigest = sha256(manifestBytes);
  const environment = parseJson(environmentText, "environment.json");
  const manifestEntries = await validateManifestEntries(manifestText, rootDir);
  validateEnvironment(environment, validated, manifestDigest);
  return {
    payload: validated,
    environment,
    provenance: {
      manifest_entries: manifestEntries,
      source_tree_sha256: manifestDigest,
      selected_compiler_configuration: environment.selected_compiler_configuration,
    },
  };
}
