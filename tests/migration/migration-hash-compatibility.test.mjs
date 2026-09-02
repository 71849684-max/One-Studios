import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("migration hash verification works when Get-FileHash is unavailable", () => {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "migration-hash-"));
  const fixturePath = join(fixtureDirectory, "fixture.txt");
  const helperPath = join(root, "ops", "migration", "Migration-Hash.ps1");
  writeFileSync(fixturePath, "one-studios\n", "utf8");

  try {
    const command = [
      "Import-Module Microsoft.PowerShell.Management",
      "Import-Module Microsoft.PowerShell.Utility",
      "Remove-Item Function:\\Get-FileHash -ErrorAction SilentlyContinue",
      "$PSModuleAutoLoadingPreference = 'None'",
      `. '${helperPath.replaceAll("'", "''")}'`,
      `(Get-MigrationSha256Hex -LiteralPath '${fixturePath.replaceAll("'", "''")}')`,
    ].join("; ");
    const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(
      result.stdout.trim(),
      "8eeb442e6628afdf0b51cb475077ac5b846b36de1482290f847dd879ea4038a2",
    );
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});
