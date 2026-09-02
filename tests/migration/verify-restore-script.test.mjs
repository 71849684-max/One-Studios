import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("hosted Supabase restore is guarded and targets only a new project", () => {
  const script = readFileSync(join(root, "ops", "migration", "Restore-HostedSupabase.ps1"), "utf8");
  for (const required of [
    "Read-Host", "-AsSecureString", "ON_ERROR_STOP", "single-transaction",
    "session_replication_role", "roles.sql", "schema.sql", "data.sql",
    "history_schema.sql", "history_data.sql", "target-verification.sql",
    "hosted-storage-policies.sql",
    "auth_users", "contracts", "movements", "vbdtdihxmapezhkfmugi",
    "SHA256SUMS.txt",
  ]) {
    assert.ok(script.toLowerCase().includes(required.toLowerCase()), required);
  }
  assert.doesNotMatch(script, /db reset|include-seed|seed\.sql|service_role/i);
  assert.doesNotMatch(script, /docker\s+(stop|restart|rm)/i);
  assert.doesNotMatch(script, /truncate[\s\S]*restart identity/i);
});
