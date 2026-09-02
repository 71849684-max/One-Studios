import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

for (const relativePath of [
  "ops/migration/source-inventory.sql",
  "ops/migration/target-verification.sql",
]) {
  test(`${relativePath} is read-only and complete`, () => {
    const sql = readFileSync(join(root, relativePath), "utf8");
    assert.match(sql.trimStart(), /^select\b/i);
    assert.doesNotMatch(sql, /\b(insert|update|delete|drop|truncate|alter|create)\b/i);
    for (const name of [
      "auth_users", "members", "clients", "contracts", "installments",
      "movements", "storage_buckets", "storage_objects",
    ]) {
      assert.match(sql, new RegExp(`\\bas\\s+${name}\\b`, "i"));
    }
    assert.match(sql, /supabase_migrations\.schema_migrations/i);
    assert.match(sql, /pg_policies/i);
    assert.match(sql, /pg_proc/i);
  });
}
