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
  assert.ok(existsSync(output), "build output must exist before inspection");
  const files = filesUnder(output).map((file) => relative(output, file).replaceAll("\\", "/"));
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

test("Vercel serves only the generated artifact and excludes local sources", () => {
  const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
  assert.equal(vercel.buildCommand, "npm run build:vercel");
  assert.equal(vercel.outputDirectory, ".vercel-static");

  const ignored = new Set(
    readFileSync(join(root, ".vercelignore"), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );
  for (const entry of [
    "SAKURA_LOCAL_BRIDGE/", "SAKURA_INSTALLER/", "SAKURA_PACKAGING/", "dist/",
    "tools/installers/", "supabase/", "database/", "archive/", "docs/", "tests/",
    "api/sakura-web.js", "api/decolecta.php", ".migration-private/",
  ]) {
    assert.ok(ignored.has(entry), `missing .vercelignore entry: ${entry}`);
  }
});
