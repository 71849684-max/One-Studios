import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("hosted restore carries the three application-owned Storage policies", () => {
  const sql = readFileSync(
    join(root, "ops", "migration", "hosted-storage-policies.sql"),
    "utf8",
  );
  for (const policy of [
    "treasury_evidence_storage_read",
    "treasury_evidence_storage_insert",
    "treasury_evidence_storage_delete_own",
  ]) {
    assert.match(sql, new RegExp(`create policy ${policy}\\b`, "i"));
    assert.match(sql, new RegExp(`drop policy if exists ${policy}\\b`, "i"));
  }
  assert.match(sql, /on storage\.objects/gi);
  assert.doesNotMatch(sql, /drop table|truncate|delete\s+from/i);
  assert.doesNotMatch(sql, /^\s*(begin|commit)\s*;/im);
});
