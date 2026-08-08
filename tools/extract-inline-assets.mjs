import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = join(root, "index.html");
let html = readFileSync(indexPath, "utf8");

function slug(attrs, fallback) {
  const id = attrs.match(/\bid=["']([^"']+)["']/i)?.[1];
  return String(id || fallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const generated = [];

// Extract inline JavaScript first. This protects HTML fragments contained inside
// JavaScript template literals (for example <style>...</style> in print views)
// from being mistaken for top-level HTML styles by the next pass.
let scriptIndex = 0;
html = html.replace(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi, (_full, rawAttrs, content) => {
  scriptIndex += 1;
  const attrs = rawAttrs.trim();
  const name = `${String(scriptIndex).padStart(2, "0")}-${slug(attrs, "runtime")}.js`;
  const relativePath = `assets/js/legacy-inline/${name}`;
  const target = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${content.trim()}\n`, "utf8");
  generated.push({ name: `legacy-script-${name.replace(/\.js$/, "")}`, path: relativePath, mode: "legacy-extracted-script" });
  return `<script${attrs ? ` ${attrs}` : ""} src="${relativePath}"></script>`;
});

let styleIndex = 0;
html = html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (_full, rawAttrs, content) => {
  styleIndex += 1;
  const attrs = rawAttrs.trim();
  const name = `${String(styleIndex).padStart(2, "0")}-${slug(attrs, "base")}.css`;
  const relativePath = `assets/css/legacy-inline/${name}`;
  const target = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${content.trim()}\n`, "utf8");
  generated.push({ name: `legacy-style-${name.replace(/\.css$/, "")}`, path: relativePath, mode: "legacy-extracted-style" });
  return `<link${attrs ? ` ${attrs}` : ""} rel="stylesheet" href="${relativePath}">`;
});

if (styleIndex || scriptIndex) writeFileSync(indexPath, html, "utf8");

const htmlAssets = [...html.matchAll(/(?:src|href)=["']((?:assets|config|solicitudes|src)\/[^"']+\.(?:js|css|png|webp|webmanifest))["']/gi)]
  .map((match) => match[1]);

const workerPath = join(root, "service-worker.js");
let worker = readFileSync(workerPath, "utf8");
worker = worker.replace(/const SHELL=(\[[\s\S]*?\]);/, (_full, literal) => {
  const shell = JSON.parse(literal);
  for (const asset of [...generated.map((item) => item.path), ...htmlAssets]) {
    const path = `./${asset}`;
    if (!shell.includes(path)) shell.push(path);
  }
  return `const SHELL=${JSON.stringify(shell)};`;
});
writeFileSync(workerPath, worker, "utf8");

const manifestPath = join(root, "config", "build-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.modules ||= [];
for (const item of generated) {
  if (!manifest.modules.some((module) => module.path === item.path)) {
    manifest.modules.push({ ...item, origin: "refactor-baseline-v1" });
  }
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Extraídos ${styleIndex} bloques CSS y ${scriptIndex} bloques JavaScript; precache reconciliado.`);
