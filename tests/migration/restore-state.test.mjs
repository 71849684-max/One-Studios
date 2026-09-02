import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const helperPath = join(root, "ops", "migration", "Migration-RestoreState.ps1");

function resolveMode(state) {
  const quote = (value) => value.replaceAll("'", "''");
  const command = `. '${quote(helperPath)}'; Resolve-MigrationRestoreMode -PreflightState '${quote(state)}'`;
  return spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    { encoding: "utf8" },
  );
}

test("restore state accepts only a fresh target or the exact verified resume checkpoint", () => {
  const fresh = resolveMode("17|0|0|0|t");
  assert.equal(fresh.status, 0, fresh.stderr);
  assert.equal(fresh.stdout.trim(), "fresh");

  const resume = resolveMode("17|3|3|59|t");
  assert.equal(resume.status, 0, resume.stderr);
  assert.equal(resume.stdout.trim(), "resume-history");

  const verify = resolveMode("17|3|3|59|f");
  assert.equal(verify.status, 0, verify.stderr);
  assert.equal(verify.stdout.trim(), "resume-verification");

  const unknown = resolveMode("17|3|2|59|t");
  assert.notEqual(unknown.status, 0);
});
