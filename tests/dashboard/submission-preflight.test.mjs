import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("submission preflight validates automated evidence and isolates manual fields", () => {
  const result = spawnSync(process.execPath, ["scripts/submission-preflight.mjs"], {
    cwd: new URL("../..", import.meta.url),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /AUTOMATED_CHECKS \d+\/\d+ PASS/);
  assert.match(result.stdout, /MANUAL_PENDING 3/);
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
  assert.match(result.stdout, /MANUAL_PENDING 3/);
  assert.match(result.stderr, /STATUS BLOCKED_BY_MANUAL_FIELDS/);
  assert.doesNotMatch(result.stdout, /STATUS READY_TO_SUBMIT/);
});
