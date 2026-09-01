# Supabase Production Migration and Vercel Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clone the frozen Supabase Docker database into a new hosted Supabase project while preserving three users and password hashes, validate parity, and connect the verified web-only artifact to Vercel production.

**Architecture:** Read-only export scripts create private roles, schema, data, migration-history, and inventory artifacts under `.migration-private`. A guarded restore script targets only the explicitly supplied new Supabase connection, restores in a transaction with triggers disabled for data import, and runs exact parity queries before Vercel receives the new public URL and anonymous key.

**Tech Stack:** Supabase CLI, PostgreSQL 17 `psql`/`pg_dump`, Docker Desktop, PowerShell 7 or Windows PowerShell 5.1, Vercel, Supabase Auth/PostgreSQL/Storage/Realtime.

**Spec:** `docs/superpowers/specs/2026-09-01-vercel-supabase-production-design.md`

## Global Constraints

- Treat Docker as read-only and keep it available after cutover.
- Source container is `supabase_db_Plataforma_Marketing`; source database is PostgreSQL 17.6 on port 54322.
- Destination must be a new empty hosted Supabase project owned through `71849684@continental.edu.pe`.
- Preserve `auth.users`, `auth.identities`, UUID relationships, business data, RLS, RPC, buckets, and all 16 migration versions.
- Do not copy active sessions or refresh tokens; users must sign in again with existing passwords.
- Never run `supabase db reset --linked` or `supabase db push --include-seed`.
- Never execute `supabase/seed.sql` against the hosted project.
- Never print or commit the target database password, service role key, or DeColecta token.
- Stop before restore unless the target project reference and database hostname are explicitly confirmed as the newly created project.
- Do not promote Vercel until source/target parity and authenticated smoke tests pass.

---

### Task 1: Create private migration workspace and inventory contract

**Files:**
- Create: `ops/migration/source-inventory.sql`
- Create: `ops/migration/target-verification.sql`
- Create: `tests/migration/verify-inventory-sql.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: PostgreSQL schemas `auth`, `storage`, `public`, `marketing_app`, and `supabase_migrations`.
- Produces: result sets named `database_summary`, `business_counts`, `storage_counts`, `migration_versions`, `security_objects`, and an automated SQL contract test.

- [ ] **Step 1: Write the failing SQL contract test**

Create `tests/migration/verify-inventory-sql.mjs` that reads both SQL files and asserts that they contain only read-only statements and all required count aliases:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const file of ["ops/migration/source-inventory.sql", "ops/migration/target-verification.sql"]) {
  test(`${file} is read-only and complete`, () => {
    const sql = readFileSync(file, "utf8");
    assert.doesNotMatch(sql, /\b(insert|update|delete|drop|truncate|alter|create)\b/i);
    for (const name of ["auth_users", "members", "clients", "contracts", "installments", "movements", "storage_buckets", "storage_objects"]) {
      assert.match(sql, new RegExp(`\\bas\\s+${name}\\b`, "i"));
    }
    assert.match(sql, /supabase_migrations\.schema_migrations/i);
    assert.match(sql, /pg_policies/i);
    assert.match(sql, /pg_proc/i);
  });
}
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run `node --test tests/migration/verify-inventory-sql.mjs`.

Expected: FAIL because the SQL files do not exist.

- [ ] **Step 3: Create the source inventory query**

Create `ops/migration/source-inventory.sql` using only `SELECT`. It must output:

```sql
select current_database() as database_name,
       current_setting('server_version') as postgres_version,
       pg_database_size(current_database()) as database_bytes;

select (select count(*) from auth.users) as auth_users,
       (select count(*) from marketing_app.members) as members,
       (select count(*) from marketing_app.clients) as clients,
       (select count(*) from marketing_app.campaigns) as campaigns,
       (select count(*) from marketing_app.tasks) as tasks,
       (select count(*) from marketing_app.messages) as messages,
       (select count(*) from marketing_app.posts) as posts,
       (select count(*) from marketing_app.treasury_contracts) as contracts,
       (select count(*) from marketing_app.treasury_installments) as installments,
       (select count(*) from marketing_app.treasury_movements) as movements,
       (select count(*) from public.interarea_requests) as requests,
       (select count(*) from marketing_app.roles) as roles,
       (select count(*) from marketing_app.role_permissions) as role_permissions,
       (select count(*) from storage.buckets) as storage_buckets,
       (select count(*) from storage.objects) as storage_objects;

select version from supabase_migrations.schema_migrations order by version;
select schemaname, tablename, policyname, roles, cmd from pg_policies
where schemaname in ('marketing_app','public','storage') order by 1,2,3;
select n.nspname as schema_name, p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('marketing_app','public') order by 1,2,3;
```

Copy the same query into `target-verification.sql`. Keeping identical count queries makes source and target outputs directly comparable.

- [ ] **Step 4: Add the migration contract script**

Add to `package.json`:

```json
"test:migration": "node --test tests/migration/*.test.mjs"
```

- [ ] **Step 5: Run the SQL contract test**

Run `npm run test:migration`.

Expected: PASS.

- [ ] **Step 6: Commit the inventory contract**

```powershell
git add package.json ops/migration/source-inventory.sql ops/migration/target-verification.sql tests/migration/verify-inventory-sql.mjs
git commit -m "test: define Supabase migration parity contract"
```

---

### Task 2: Implement the guarded source export

**Files:**
- Create: `ops/migration/Export-LocalSupabase.ps1`
- Create: `tests/migration/verify-export-script.mjs`

**Interfaces:**
- Consumes: running Docker container `supabase_db_Plataforma_Marketing`, local connection `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, and `npx supabase@latest`.
- Produces: `.migration-private/YYYYMMDDTHHMMSSZ/roles.sql`, `schema.sql`, `data.sql`, `history_schema.sql`, `history_data.sql`, `source-inventory.txt`, and `SHA256SUMS.txt`; prints only the output directory and file hashes.

- [ ] **Step 1: Write script safety tests**

Create a Node test that reads `Export-LocalSupabase.ps1` and asserts it contains:

```js
for (const required of [
  "supabase_db_Plataforma_Marketing", "source-inventory.sql", "--role-only",
  "--data-only", "--use-copy", "--schema", "supabase_migrations",
  "Get-FileHash", ".migration-private"
]) assert.match(script, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.doesNotMatch(script, /db reset|include-seed|seed\.sql/i);
```

- [ ] **Step 2: Run the test to verify it fails**

Run `npm run test:migration`.

Expected: FAIL because `Export-LocalSupabase.ps1` does not exist.

- [ ] **Step 3: Create the export script with preflight checks**

The script must set `$ErrorActionPreference = 'Stop'`, resolve the repository root relative to `$PSScriptRoot`, create a directory whose name is generated with `(Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')` under `.migration-private`, and verify:

```powershell
$migrationContainer = 'supabase_db_Plataforma_Marketing'
$migrationSourceUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
$migrationState = docker inspect -f '{{.State.Health.Status}}' $migrationContainer
if ($migrationState -ne 'healthy') { throw "Source Supabase database is not healthy: $migrationState" }
docker exec $migrationContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'select 1' | Out-Null
```

Do not stop or restart any container.

- [ ] **Step 4: Export inventory and logical artifacts**

Run the inventory through `docker exec -i ... psql` and save only its output to the private directory. Invoke these exact logical dump operations:

```powershell
npx --yes supabase@latest db dump --db-url $migrationSourceUrl -f $migrationRoles --role-only
npx --yes supabase@latest db dump --db-url $migrationSourceUrl -f $migrationSchema
npx --yes supabase@latest db dump --db-url $migrationSourceUrl -f $migrationData --use-copy --data-only -x 'storage.buckets_vectors' -x 'storage.vector_indexes'
npx --yes supabase@latest db dump --db-url $migrationSourceUrl -f $migrationHistorySchema --schema supabase_migrations
npx --yes supabase@latest db dump --db-url $migrationSourceUrl -f $migrationHistoryData --use-copy --data-only --schema supabase_migrations
```

Use descriptive task-scoped variable names; do not use `$HOME`, `$home`, or `$CODEX_HOME`.

- [ ] **Step 5: Hash and validate every artifact**

Reject any artifact with length zero. Generate SHA-256 using `Get-FileHash`, write `SHA256SUMS.txt`, then scan SQL artifacts and fail if the cleartext local development password `SakuraLocal#2026!` appears. The bcrypt hashes in `auth.users` are expected and must not be printed.

- [ ] **Step 6: Run tests and a real read-only export**

Run:

```powershell
npm run test:migration
powershell -NoProfile -ExecutionPolicy Bypass -File .\ops\migration\Export-LocalSupabase.ps1
```

Expected: PASS; output names a timestamped private directory containing six non-empty artifacts plus hashes. Docker remains healthy.

- [ ] **Step 7: Commit only scripts and tests**

```powershell
git add ops/migration/Export-LocalSupabase.ps1 tests/migration/verify-export-script.mjs
git commit -m "feat: add guarded local Supabase export"
```

Confirm `git status --short` does not list `.migration-private`.

---

### Task 3: Create the new hosted Supabase project and record non-secret identifiers

**Files:**
- Create: `config/production-project.example.json`
- Create locally but do not commit: `.migration-private/production-project.json`

**Interfaces:**
- Consumes: confirmed Supabase account for `71849684@continental.edu.pe`.
- Produces: hosted project reference, public URL, anonymous key, region, PostgreSQL major version, and a database password held only in the user's password manager or interactive prompt.

- [ ] **Step 1: Add the non-secret project metadata shape**

Create the committed example:

```json
{
  "projectRef": "",
  "supabaseUrl": "",
  "region": "",
  "postgresMajorVersion": 17
}
```

Do not add database passwords or service keys to this file.

- [ ] **Step 2: User creates and confirms the new Supabase project**

In the Supabase dashboard signed in as `71849684@continental.edu.pe`, create a new project in the geographically closest appropriate region, generate a unique database password in a password manager, and wait until project health is green. Record the project reference and public URL in `.migration-private/production-project.json` using the same shape as the example.

- [ ] **Step 3: Validate the destination is new and empty**

Connect with `psql` using an interactively supplied password and run read-only checks:

```sql
select current_setting('server_version_num')::int / 10000 as postgres_major;
select count(*) from auth.users;
select count(*) from information_schema.tables where table_schema = 'marketing_app';
```

Expected: major version 17, `auth.users = 0`, and no `marketing_app` tables.

- [ ] **Step 4: Commit only the safe metadata example**

```powershell
git add config/production-project.example.json
git commit -m "docs: define hosted Supabase project metadata"
```

---

### Task 4: Implement the guarded restore and parity verifier

**Files:**
- Create: `ops/migration/Restore-HostedSupabase.ps1`
- Create: `tests/migration/verify-restore-script.mjs`

**Interfaces:**
- Consumes: timestamped export directory, exact new `projectRef`, target session-pooler host, database name, database user, and an interactively entered database password.
- Produces: restored hosted database, `target-verification.txt`, `parity-report.txt`, and exit code 0 only when fixed counts and 16 migration versions match.

- [ ] **Step 1: Write restore-script safety tests**

The Node test must require these strings:

```js
for (const required of [
  "Read-Host", "-AsSecureString", "ON_ERROR_STOP", "single-transaction",
  "session_replication_role", "roles.sql", "schema.sql", "data.sql",
  "history_schema.sql", "history_data.sql", "target-verification.sql",
  "auth_users", "contracts", "movements"
]) assert.match(script, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
assert.doesNotMatch(script, /db reset|include-seed|seed\.sql|service_role/i);
```

- [ ] **Step 2: Run the test to verify it fails**

Run `npm run test:migration`.

Expected: FAIL because the restore script is absent.

- [ ] **Step 3: Add target identity and empty-state gates**

The restore script must accept mandatory parameters `ExportDirectory`, `ProjectRef`, `DatabaseHost`, and `DatabaseUser`. It must reject a host that does not contain the exact `ProjectRef`, reject the known old project reference `vbdtdihxmapezhkfmugi`, request the password with `Read-Host -AsSecureString`, and query the target before restore. Continue only if Auth has zero users and `marketing_app` has zero tables.

- [ ] **Step 4: Verify backup hashes before connecting**

Recompute SHA-256 for each SQL file and compare it with `SHA256SUMS.txt`. Abort before any remote statement if one differs.

- [ ] **Step 5: Restore in the official order**

Use PostgreSQL 17 `psql` from the healthy local database container or a pinned `postgres:17` client. Copy SQL files to `/tmp/one-studios-migration-$migrationRunId`, where `$migrationRunId` is generated with `(Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')`. Invoke:

```text
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command "SET session_replication_role = replica" \
  --file data.sql \
  --dbname $env:MIGRATION_TARGET_DB_URL
```

Then restore `history_schema.sql` and `history_data.sql` in a second single transaction only if `supabase_migrations.schema_migrations` is not already populated by the first restore. Do not ignore SQL errors.

- [ ] **Step 6: Explicitly invalidate old sessions**

After user and identity rows are restored, clear target-only session state in a single transaction:

```sql
truncate table auth.refresh_tokens, auth.sessions, auth.mfa_amr_claims,
  auth.mfa_challenges, auth.flow_state, auth.one_time_tokens restart identity cascade;
```

This statement targets only the newly restored hosted project and ensures every user signs in again under the new JWT keys. It must never run on Docker.

- [ ] **Step 7: Run target inventory and compare fixed counts**

Run `target-verification.sql` on the target and save output. Compare at minimum:

```text
auth_users=3
members=3
clients=1
contracts=2
installments=4
movements=11
roles=5
role_permissions=247
storage_buckets=3
storage_objects=0
migration_versions=16
```

Also compare the full policy and function lists from source and target. Write `parity-report.txt` without emails, names, tokens, password hashes, or connection strings.

- [ ] **Step 8: Run tests but stop before the real restore until Task 3 is complete**

Run `npm run test:migration`.

Expected: PASS. The restore command is run only after the user supplies and confirms the brand-new project reference and the preflight reports an empty target.

- [ ] **Step 9: Commit the guarded restore implementation**

```powershell
git add ops/migration/Restore-HostedSupabase.ps1 tests/migration/verify-restore-script.mjs
git commit -m "feat: add guarded hosted Supabase restore"
```

---

### Task 5: Execute restoration and authenticate all migrated users

**Files:**
- Generated privately: `.migration-private/YYYYMMDDTHHMMSSZ/target-verification.txt`
- Generated privately: `.migration-private/YYYYMMDDTHHMMSSZ/parity-report.txt`
- No committed source changes.

**Interfaces:**
- Consumes: successful export, new empty project metadata, and restore script.
- Produces: verified hosted Supabase database and three successful password logins.

- [ ] **Step 1: Reconfirm the local source is frozen and healthy**

Run `docker ps` and the source inventory again. Compare fixed business counts with the export inventory. If any count changed, generate a fresh export and use only the newest timestamped directory.

- [ ] **Step 2: Execute the guarded restore**

Run the restore script with the exact new project reference and session-pooler host. Enter the database password only at the secure prompt. Expected: preflight confirms empty destination, restore completes without ignored errors, and parity exits 0.

- [ ] **Step 3: Configure hosted Supabase APIs**

In Supabase settings, expose schemas `public`, `graphql_public`, and `marketing_app`. Confirm Realtime publication includes the tables expected by the application. Confirm the three Storage buckets are private and carry the restored policies.

- [ ] **Step 4: Configure Auth production URLs provisionally**

Set Site URL to the initial Vercel production URL once available. Add the exact production URL and the Vercel preview pattern to redirect URLs. Do not reuse the local JWT secret; migrated users will obtain new sessions.

- [ ] **Step 5: Test all three users**

For each migrated account, use the Supabase-hosted Auth endpoint or the preview application to sign in with the user's existing password. Record only PASS/FAIL and user UUID suffixes in the private parity report. Never record passwords.

- [ ] **Step 6: Verify RLS and business reads**

Using each user's own session, confirm allowed roles can read expected modules and unauthorized roles receive permission errors for restricted financial operations. Confirm the two contracts, four installments, and eleven movements are readable by an authorized user.

---

### Task 6: Create Vercel project, deploy preview, and cut over production

**Files:**
- Modify: `config/public-runtime-config.js` only if local fallback metadata must change; the deployed version remains generated by the build.
- No secret files committed.

**Interfaces:**
- Consumes: completed web-only package plan, verified hosted Supabase URL/anonymous key, DeColecta token, and GitHub repository.
- Produces: Vercel preview and production deployments connected to the new Supabase project.

- [ ] **Step 1: Ensure all required deployment source is tracked**

Run:

```powershell
git status --short
git ls-files api/decolecta.js supabase/migrations src/features/treasury src/features/permissions
```

Stage and commit only reviewed production source required by the web system. Do not add `.migration-private`, `tools/installers`, `dist`, SAKURA directories, SQL backups, or local credentials.

- [ ] **Step 2: Push the reviewed branch to GitHub**

Run `npm test`, `npm run test:migration`, and `npm run verify:vercel` using the real hosted public URL and anonymous key. Push only after all pass.

- [ ] **Step 3: Create the Vercel project**

Sign in to Vercel as `71849684@continental.edu.pe`, import the GitHub repository, select the repository root, and allow `vercel.json` to provide the build and output settings. Do not deploy from the unfiltered local directory with `vercel --prod`.

- [ ] **Step 4: Add Vercel environment variables**

Add to Preview and Production:

Add `SUPABASE_URL` with the exact URL recorded in
`.migration-private/production-project.json`, `SUPABASE_ANON_KEY` with the
publishable key copied from the new project's API settings, and
`DECOLECTA_TOKEN` with the existing provider token copied from its password
manager. Paste values directly into Vercel's encrypted value fields; do not
store them in a command or repository file.

Do not add a database password or `service_role`. Leave SAKURA/Tavily variables absent.

- [ ] **Step 5: Deploy and inspect Preview**

Verify HTTP 200 for `/`, `/solicitudes/`, `/manifest.webmanifest`, `/service-worker.js`, and `/config/public-runtime-config.js`. Verify HTTP 404 for `/supabase/seed.sql`, `/database/mariadb/ONE_STUDIOS_LOCAL_BASELINE.sql`, `/api/sakura-web`, and a representative installer path.

- [ ] **Step 6: Run authenticated application smoke tests**

In Preview, sign in with each migrated account, verify authorized navigation, test a safe read of contracts and movements, create and remove a reversible test record if the role allows it, verify Realtime, and confirm a Storage upload/delete round trip in an approved bucket.

- [ ] **Step 7: Test DeColecta without exposing its token**

With an authenticated user, submit one valid DNI or RUC lookup through `/api/decolecta`. Confirm a normalized successful response or a controlled provider error. Inspect browser network requests and confirm the token is absent from request headers, bodies, JavaScript, and runtime config.

- [ ] **Step 8: Confirm SAKURA and private artifacts are absent**

Search downloaded HTML, loaded JavaScript/CSS URLs, browser console, and network log for `sakura`, port `8765`, Ollama, and `/api/sakura-web`. Expected: no matches and no missing-resource errors.

- [ ] **Step 9: Promote the verified deployment**

Update Supabase Auth Site URL to the final Vercel production URL, retain the exact preview redirect pattern, redeploy if any environment variable changed, and promote the already verified deployment. Re-run login, financial read, Solicitudes 360, PWA, and DeColecta smoke checks against production.

- [ ] **Step 10: Preserve rollback state**

Keep Docker running or stopped cleanly but undeleted, retain the private timestamped export and hashes, and do not remove local volumes. If production validation fails, stop promotion or roll Vercel back to the previous deployment; the local database remains unchanged.
