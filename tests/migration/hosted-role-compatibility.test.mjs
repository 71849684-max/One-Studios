import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("hosted role preparation removes only the managed log_min_messages grant", () => {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "hosted-roles-"));
  const sourcePath = join(fixtureDirectory, "roles.sql");
  const destinationPath = join(fixtureDirectory, "roles-hosted.sql");
  const helperPath = join(root, "ops", "migration", "Migration-SqlCompatibility.ps1");
  writeFileSync(
    sourcePath,
    [
      "ALTER ROLE \"anon\" SET \"statement_timeout\" TO '3s';",
      "GRANT SET ON PARAMETER \"log_min_messages\" TO \"supabase_realtime_admin\";",
      "RESET ALL;",
      "",
    ].join("\n"),
    "utf8",
  );

  try {
    const quote = (value) => value.replaceAll("'", "''");
    const command = [
      `. '${quote(helperPath)}'`,
      `Convert-MigrationRolesForHostedSupabase -SourcePath '${quote(sourcePath)}' -DestinationPath '${quote(destinationPath)}'`,
    ].join("; ");
    const result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      { encoding: "utf8" },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(
      readFileSync(destinationPath, "utf8").replaceAll("\r\n", "\n"),
      "ALTER ROLE \"anon\" SET \"statement_timeout\" TO '3s';\nRESET ALL;\n",
    );
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});

test("hosted data preparation keeps application data and only portable managed records", () => {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "hosted-data-"));
  const sourcePath = join(fixtureDirectory, "data.sql");
  const destinationPath = join(fixtureDirectory, "data-hosted.sql");
  const helperPath = join(root, "ops", "migration", "Migration-SqlCompatibility.ps1");
  writeFileSync(
    sourcePath,
    [
      'COPY "auth"."audit_log_entries" ("id") FROM stdin;',
      "audit-entry",
      "\\.",
      'COPY "auth"."users" ("id") FROM stdin;',
      "user-one",
      "\\.",
      'COPY "auth"."identities" ("id") FROM stdin;',
      "identity-one",
      "\\.",
      'COPY "storage"."buckets" ("id") FROM stdin;',
      "one-studios",
      "\\.",
      'COPY "storage"."objects" ("id") FROM stdin;',
      "\\.",
      'COPY "storage"."iceberg_namespaces" ("id") FROM stdin;',
      "\\.",
      'COPY "storage"."iceberg_tables" ("id") FROM stdin;',
      "\\.",
      'COPY "supabase_functions"."hooks" ("id") FROM stdin;',
      "\\.",
      'COPY "marketing_app"."clients" ("id") FROM stdin;',
      "client-one",
      "\\.",
      `SELECT pg_catalog.setval('"supabase_functions"."hooks_id_seq"', 1, false);`,
      `SELECT pg_catalog.setval('"marketing_app"."clients_id_seq"', 1, true);`,
      "",
    ].join("\n"),
    "utf8",
  );

  try {
    const quote = (value) => value.replaceAll("'", "''");
    const command = [
      `. '${quote(helperPath)}'`,
      `Convert-MigrationDataForHostedSupabase -SourcePath '${quote(sourcePath)}' -DestinationPath '${quote(destinationPath)}'`,
    ].join("; ");
    const result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      { encoding: "utf8" },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(
      readFileSync(destinationPath, "utf8").replaceAll("\r\n", "\n"),
      [
        'COPY "auth"."users" ("id") FROM stdin;',
        "user-one",
        "\\.",
        'COPY "auth"."identities" ("id") FROM stdin;',
        "identity-one",
        "\\.",
        'COPY "storage"."buckets" ("id") FROM stdin;',
        "one-studios",
        "\\.",
        'COPY "storage"."objects" ("id") FROM stdin;',
        "\\.",
        'COPY "marketing_app"."clients" ("id") FROM stdin;',
        "client-one",
        "\\.",
        `SELECT pg_catalog.setval('"marketing_app"."clients_id_seq"', 1, true);`,
        "",
      ].join("\n"),
    );
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});
