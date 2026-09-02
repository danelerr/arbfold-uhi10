import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const preflightSource = await import("node:fs/promises")
  .then(({ readFile }) => readFile(new URL("../../scripts/submission-preflight.mjs", import.meta.url), "utf8"));

test("public preflight binds the immutable submission tag to current main", () => {
  assert.match(preflightSource, /git/);
  assert.match(preflightSource, /ls-remote/);
  assert.match(preflightSource, /refs\/tags\/uhi10-submission\^\{\}/);
  assert.match(preflightSource, /refs\.submission === refs\.main/);
  assert.doesNotMatch(preflightSource, /api\.github\.com\/repos\/danelerr\/arbfold-uhi10\/commits/);
});

test("public preflight verifies all published Sourcify creation and runtime matches", () => {
  assert.match(preflightSource, /sourceVerificationTargets/);
  assert.match(preflightSource, /creationMatch === "match"/);
  assert.match(preflightSource, /runtimeMatch === "match"/);
  assert.match(preflightSource, /Public source verification matches all eight active ARBFOLD contracts/);
});

test("submission preflight validates automated evidence and isolates manual fields", () => {
  const result = spawnSync(process.execPath, ["scripts/submission-preflight.mjs"], {
    cwd: new URL("../..", import.meta.url),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /AUTOMATED_CHECKS \d+\/\d+ PASS/);
  assert.match(result.stdout, /MANUAL_PENDING 1/);
  assert.match(result.stdout, /STATUS READY_FOR_MANUAL_FINISH/);
  assert.doesNotMatch(result.stdout, /^FAIL /m);
});

test("strict submission preflight fails while human-owned fields remain", () => {
  const result = spawnSync(process.execPath, ["scripts/submission-preflight.mjs", "--strict"], {
    cwd: new URL("../..", import.meta.url),
    encoding: "utf8",
  });
  assert.equal(result.status, 2, result.stderr || result.stdout);
  assert.match(result.stdout, /AUTOMATED_CHECKS \d+\/\d+ PASS/);
  assert.match(result.stdout, /MANUAL_PENDING 1/);
  assert.match(result.stderr, /STATUS BLOCKED_BY_MANUAL_FIELDS/);
  assert.doesNotMatch(result.stdout, /STATUS READY_TO_SUBMIT/);
});
