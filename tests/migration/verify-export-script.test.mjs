import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("local Supabase export is guarded and never seeds or resets", () => {
  const script = readFileSync(join(root, "ops", "migration", "Export-LocalSupabase.ps1"), "utf8");
  for (const required of [
    "supabase_db_Plataforma_Marketing", "source-inventory.sql", "--role-only",
    "--data-only", "--use-copy", "--schema", "supabase_migrations",
    "Get-FileHash", ".migration-private", "docker inspect",
  ]) {
    assert.ok(script.includes(required), required);
  }
  assert.doesNotMatch(script, /db reset|include-seed|seed\.sql/i);
  assert.doesNotMatch(script, /docker\s+(stop|restart|rm)/i);
});
