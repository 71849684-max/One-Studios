# Web-Only Vercel Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and verify a Vercel deployment artifact containing the One Studios web system and DeColecta API, with every SAKURA and local-only component excluded.

**Architecture:** A deterministic Node.js build copies an explicit set of browser directories into `.vercel-static`, transforms the main HTML and PWA shell to remove SAKURA, and generates public Supabase configuration from Vercel environment variables. Vercel serves that output directory while retaining `api/decolecta.js` as the only deployed serverless function.

**Tech Stack:** Node.js 20+, vanilla HTML/CSS/JavaScript, Vercel static output and Node.js Functions, Supabase JS, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-01-vercel-supabase-production-design.md`

## Global Constraints

- Publish the web system, Solicitudes 360, and `/api/decolecta` only.
- Exclude all SAKURA UI, scripts, styles, APIs, Ollama, local bridge, installers, SQL, backups, tests, and internal documentation.
- Never place a `service_role`, database password, or DeColecta token in browser output.
- Generate the browser-visible Supabase URL and anonymous key from `SUPABASE_URL` and `SUPABASE_ANON_KEY` at build time.
- Keep the existing local application usable; production-only transformations occur in `.vercel-static`.
- Node.js must remain at version 20 or newer.
- Every task must preserve unrelated working-tree changes.

---

### Task 1: Lock the production artifact contract with failing tests

**Files:**
- Create: `tests/deployment/vercel-artifact.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: source tree rooted at the repository directory.
- Produces: test contract for `.vercel-static`, `npm run test:deployment`, and required build-time environment variable names.

- [ ] **Step 1: Create the deployment test file**

Create `tests/deployment/vercel-artifact.test.mjs` with Node's built-in test runner. It must resolve the repository root and output directory, recursively list output files, and define these tests:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = join(root, ".vercel-static");

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

test("production artifact exists and contains both web clients", () => {
  assert.ok(existsSync(join(output, "index.html")));
  assert.ok(existsSync(join(output, "solicitudes", "index.html")));
  assert.ok(existsSync(join(output, "service-worker.js")));
});

test("production artifact contains no Sakura or private source paths", () => {
  const files = filesUnder(output).map((file) => relative(output, file).replaceAll("\\\\", "/"));
  assert.equal(files.some((file) => /sakura/i.test(file)), false);
  for (const forbidden of ["supabase/", "database/", "archive/", "docs/", "tests/", "tools/"]) {
    assert.equal(files.some((file) => file.startsWith(forbidden)), false, forbidden);
  }
  const html = readFileSync(join(output, "index.html"), "utf8");
  assert.doesNotMatch(html, /sakura/i);
});

test("runtime config contains only public production values", () => {
  const config = readFileSync(join(output, "config", "public-runtime-config.js"), "utf8");
  assert.match(config, /https:\/\/production-check\.supabase\.co/);
  assert.match(config, /test-anon-key/);
  assert.match(config, /enabled:false/);
  assert.doesNotMatch(config, /service_role|DECOLECTA_TOKEN|postgresql:\/\//i);
});
```

- [ ] **Step 2: Add the deployment test script**

Add this script to `package.json` without changing the existing `verify` and `test` scripts:

```json
"test:deployment": "node --test tests/deployment/*.test.mjs"
```

- [ ] **Step 3: Run the test to verify the contract fails**

Run:

```powershell
$env:SUPABASE_URL='https://production-check.supabase.co'
$env:SUPABASE_ANON_KEY='test-anon-key'
npm run test:deployment
```

Expected: FAIL because `.vercel-static/index.html` does not exist.

- [ ] **Step 4: Commit the test contract**

```powershell
git add package.json tests/deployment/vercel-artifact.test.mjs
git commit -m "test: define web-only Vercel artifact contract"
```

---

### Task 2: Build the allowlisted web artifact

**Files:**
- Create: `tools/build-vercel.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `SUPABASE_URL: string`, `SUPABASE_ANON_KEY: string`, source `index.html`, `service-worker.js`, `manifest.webmanifest`, `assets/`, `src/`, `config/`, and `solicitudes/`.
- Produces: `buildVercelArtifact({ root, output, supabaseUrl, supabaseAnonKey }): void` behavior through the CLI entry point and the `.vercel-static/` tree.

- [ ] **Step 1: Add the build entry point and validation**

Create `tools/build-vercel.mjs`. Use only Node built-ins. At the top, import `cpSync`, `existsSync`, `mkdirSync`, `readFileSync`, `rmSync`, and `writeFileSync` from `node:fs`, plus path and URL helpers. Resolve `root` from the script directory and set `output` to `.vercel-static`.

Validate the environment exactly as follows:

```js
const supabaseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const supabaseAnonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) {
  throw new Error("SUPABASE_URL must be a hosted https://*.supabase.co URL.");
}
if (!supabaseAnonKey || /service_role/i.test(supabaseAnonKey)) {
  throw new Error("SUPABASE_ANON_KEY is missing or unsafe for browser output.");
}
```

- [ ] **Step 2: Copy only the allowed browser source**

Reset `.vercel-static`, create it, and copy these exact entries:

```js
const entries = ["assets", "src", "solicitudes", "manifest.webmanifest"];
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const entry of entries) {
  cpSync(join(root, entry), join(output, entry), {
    recursive: true,
    filter: (source) => !/sakura/i.test(relative(root, source).replaceAll("\\\\", "/")),
  });
}
mkdirSync(join(output, "config"), { recursive: true });
```

Do not copy the repository's `config/public-runtime-config.js`; generate it in Step 4.

- [ ] **Step 3: Transform the main HTML without changing local source**

Read `index.html`, remove every `link` or `script` tag whose `href`, `src`, or `data-inbestiga-module` contains `sakura`, remove the full element carrying `id="sakuraNativeLauncher"`, and replace the current title with `ONE STUDIOS Marketing Cloud`. Use explicit checks after transformation:

```js
let html = readFileSync(join(root, "index.html"), "utf8");
html = html
  .replace(/<title>[\s\S]*?<\/title>/i, "<title>ONE STUDIOS Marketing Cloud</title>")
  .replace(/<(?:link|script)\b(?=[^>]*(?:href|src|data-inbestiga-module)=["'][^"']*sakura[^"']*["'])[^>]*>(?:<\/script>)?/gi, "")
  .replace(/<button\b[^>]*id=["']sakuraNativeLauncher["'][\s\S]*?<\/button>/i, "");

if (/sakura/i.test(html)) throw new Error("SAKURA remains in production index.html.");
writeFileSync(join(output, "index.html"), html);
```

If the assertion reports a remaining occurrence, remove that exact production-only block with another narrowly scoped expression; do not delete unrelated application text.

- [ ] **Step 4: Generate public runtime configuration**

Write `.vercel-static/config/public-runtime-config.js` with JSON-encoded values so quotes cannot break JavaScript:

```js
const runtime = `/* generated for Vercel; public values only */
(function(){
  "use strict";
  window.INBESTIGA_PUBLIC_RUNTIME_CONFIG=Object.freeze({
    managed:true,
    version:"v18-web",
    environment:"production",
    supabaseUrl:${JSON.stringify(supabaseUrl)},
    supabaseAnonKey:${JSON.stringify(supabaseAnonKey)},
    sakura:Object.freeze({enabled:false})
  });
})();
`;
writeFileSync(join(output, "config", "public-runtime-config.js"), runtime);
```

- [ ] **Step 5: Generate a service worker from files that actually exist**

Build a shell list containing `/`, `/index.html`, `/manifest.webmanifest`, `/config/public-runtime-config.js`, `/solicitudes/index.html`, `/solicitudes/manifest.webmanifest`, both Solicitudes assets, icons, and every local `src` or `href` found in the transformed `index.html`. Reject any shell path that is missing from `.vercel-static`. Generate `service-worker.js` with cache name `one-studios-web-v18` and the same install/activate/fetch strategy used by the existing worker.

The missing-reference check must be concrete:

```js
for (const path of shell) {
  if (path === "/") continue;
  const file = join(output, decodeURIComponent(path.replace(/^\//, "")));
  if (!existsSync(file)) throw new Error(`Production PWA reference missing: ${path}`);
}
```

- [ ] **Step 6: Add build scripts and ignore generated output**

Add these scripts to `package.json`:

```json
"build:vercel": "node tools/build-vercel.mjs",
"verify:vercel": "npm run build:vercel && npm run test:deployment"
```

Add `.vercel-static/` and `.migration-private/` to `.gitignore`.

- [ ] **Step 7: Run the build and deployment tests**

```powershell
$env:SUPABASE_URL='https://production-check.supabase.co'
$env:SUPABASE_ANON_KEY='test-anon-key'
npm run verify:vercel
```

Expected: PASS, with `.vercel-static` containing both web clients and no file or HTML occurrence matching `sakura` case-insensitively.

- [ ] **Step 8: Run the existing baseline test**

```powershell
npm test
```

Expected: `Baseline válido.`

- [ ] **Step 9: Commit the production builder**

```powershell
git add .gitignore package.json tools/build-vercel.mjs
git commit -m "build: create web-only Vercel artifact"
```

---

### Task 3: Constrain the Vercel source upload and serverless API

**Files:**
- Modify: `.vercelignore`
- Modify: `vercel.json`
- Test: `tests/deployment/vercel-artifact.test.mjs`

**Interfaces:**
- Consumes: `npm run build:vercel` and `.vercel-static` from Task 2.
- Produces: Vercel configuration that serves `.vercel-static` and exposes only `api/decolecta.js` under `/api`.

- [ ] **Step 1: Extend the test contract for Vercel configuration**

Add a test that parses `vercel.json`, asserts `buildCommand === "npm run build:vercel"`, `outputDirectory === ".vercel-static"`, and reads `.vercelignore` to require these entries:

```js
const requiredIgnoreEntries = [
  "SAKURA_LOCAL_BRIDGE/", "SAKURA_INSTALLER/", "SAKURA_PACKAGING/", "dist/",
  "tools/installers/", "supabase/", "database/", "archive/", "docs/", "tests/",
  "api/sakura-web.js", "api/decolecta.php", ".migration-private/"
];
```

- [ ] **Step 2: Run the test to verify it fails**

Run `npm run test:deployment`.

Expected: FAIL because build/output settings and ignore entries are absent.

- [ ] **Step 3: Replace `.vercelignore` with the explicit private/local list**

The file must contain the exact required entries above plus:

```text
*.bat
*.cmd
*.ps1
*.pyc
__pycache__/
.git/
.github/
.idea/
.migration-private/
```

Do not ignore `api/decolecta.js`, `package.json`, `vercel.json`, or `tools/build-vercel.mjs` because Vercel needs them to build and serve the API.

- [ ] **Step 4: Configure the production build in `vercel.json`**

Add these top-level properties while preserving existing headers and redirects:

```json
{
  "buildCommand": "npm run build:vercel",
  "outputDirectory": ".vercel-static"
}
```

Add a security header rule for all routes with `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`. Do not add a broad Content Security Policy in this release because the current clients load Supabase from CDNs and require a separately tested policy.

- [ ] **Step 5: Verify the API source has no browser-exposed secrets**

Run:

```powershell
rg -n "service_role|DECOLECTA_TOKEN\s*=|postgresql://" api/decolecta.js .vercel-static
```

Expected: no hard-coded value. The reference `process.env.DECOLECTA_TOKEN` is allowed.

- [ ] **Step 6: Run all project and deployment checks**

```powershell
$env:SUPABASE_URL='https://production-check.supabase.co'
$env:SUPABASE_ANON_KEY='test-anon-key'
npm test
npm run verify:vercel
```

Expected: both commands PASS.

- [ ] **Step 7: Commit Vercel constraints**

```powershell
git add .vercelignore vercel.json tests/deployment/vercel-artifact.test.mjs
git commit -m "chore: constrain Vercel to web system and DeColecta"
```

---

### Task 4: Validate the web-only package in a local HTTP server

**Files:**
- Create: `tests/deployment/smoke-vercel-artifact.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `.vercel-static` and a free localhost port.
- Produces: `npm run smoke:vercel`, which returns exit code 0 only when public routes and exclusion checks pass.

- [ ] **Step 1: Write the smoke verifier**

Create a Node script that serves `.vercel-static` with `node:http`, requests `/`, `/config/public-runtime-config.js`, `/service-worker.js`, `/solicitudes/`, and `/manifest.webmanifest`, and asserts HTTP 200 plus non-empty bodies. It must also request `/supabase/seed.sql`, `/database/mariadb/ONE_STUDIOS_LOCAL_BASELINE.sql`, and `/api/sakura-web` from the static server and assert HTTP 404.

Use port `0` so Windows selects a free port, and close the server in `finally`.

- [ ] **Step 2: Add the smoke script**

```json
"smoke:vercel": "node tests/deployment/smoke-vercel-artifact.mjs"
```

- [ ] **Step 3: Run the complete local package validation**

```powershell
$env:SUPABASE_URL='https://production-check.supabase.co'
$env:SUPABASE_ANON_KEY='test-anon-key'
npm run verify:vercel
npm run smoke:vercel
```

Expected: all tests PASS and all private-path requests return 404.

- [ ] **Step 4: Commit the smoke check**

```powershell
git add package.json tests/deployment/smoke-vercel-artifact.mjs
git commit -m "test: verify web-only deployment routes"
```

