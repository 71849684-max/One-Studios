import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];

function filesUnder(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "SAKURA_DATA"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesUnder(path));
    else result.push(path);
  }
  return result;
}

const files = filesUnder(root);

for (const file of files.filter((path) => extname(path) === ".json")) {
  try {
    JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`JSON inválido: ${relative(root, file)} — ${error.message}`);
  }
}

for (const file of files.filter((path) => extname(path) === ".js")) {
  const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (check.status !== 0) errors.push(`JavaScript inválido: ${relative(root, file)} — ${check.stderr.trim()}`);
}

const html = readFileSync(join(root, "index.html"), "utf8");
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((code) => code.trim());

for (const [index, code] of inlineScripts.entries()) {
  const check = spawnSync(process.execPath, ["--check"], { input: code, encoding: "utf8" });
  if (check.status !== 0) errors.push(`JavaScript inline inválido #${index + 1}: ${check.stderr.trim()}`);
}

const localRefs = new Set();
for (const match of html.matchAll(/(?:src|href)=["']([^"'#?]+)["']/gi)) {
  const value = match[1];
  if (/^(?:https?:|data:|mailto:|tel:|javascript:)/i.test(value) || value.includes("${")) continue;
  localRefs.add(value.replace(/^\.\//, ""));
}

const serviceWorker = readFileSync(join(root, "service-worker.js"), "utf8");
for (const match of serviceWorker.matchAll(/["']\.\/([^"']+)["']/g)) {
  if (match[1] !== "__pwa_status__.json") localRefs.add(match[1]);
}

const buildManifest = JSON.parse(readFileSync(join(root, "config", "build-manifest.json"), "utf8"));
for (const module of buildManifest.modules || []) localRefs.add(module.path);

for (const path of localRefs) {
  if (!existsSync(join(root, decodeURIComponent(path)))) errors.push(`Referencia inexistente: ${path}`);
}

const versions = {
  html: html.match(/data-inbestiga-build=["']v([^"']+)/i)?.[1],
  manifest: String(buildManifest.frontend_version || ""),
  pwa: JSON.parse(readFileSync(join(root, "manifest.webmanifest"), "utf8")).id?.match(/v([\d-]+)$/)?.[1]?.replaceAll("-", "."),
};

if (!versions.html || versions.html !== versions.manifest) {
  errors.push(`Versiones desalineadas: HTML=${versions.html || "?"}, manifest=${versions.manifest || "?"}`);
}

const htmlAssets = new Set([...html.matchAll(/(?:src|href)=["']((?:assets|config|solicitudes|src)\/[^"']+\.(?:js|css|png|webp|webmanifest))["']/gi)].map((match) => match[1]));
const cachedAssets = new Set([...serviceWorker.matchAll(/["']\.\/((?:assets|config|solicitudes|src)\/[^"']+)["']/g)].map((match) => match[1]));
const uncached = [...htmlAssets].filter((path) => !cachedAssets.has(path));
if (uncached.length) warnings.push(`${uncached.length} recursos cargados por HTML no están en el precache PWA.`);

console.log(`Archivos revisados: ${files.length}`);
console.log(`JavaScript externo: ${files.filter((path) => extname(path) === ".js").length}`);
console.log(`JavaScript inline: ${inlineScripts.length}`);
console.log(`JSON: ${files.filter((path) => extname(path) === ".json").length}`);
console.log(`Referencias locales: ${localRefs.size}`);
for (const warning of warnings) console.warn(`ADVERTENCIA: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);

if (errors.length) process.exit(1);
console.log("Baseline válido.");
