import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, ".vercel-static");
const supabaseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const supabaseAnonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) {
  throw new Error("SUPABASE_URL must be a hosted https://*.supabase.co URL.");
}
if (!supabaseAnonKey || /service_role/i.test(supabaseAnonKey)) {
  throw new Error("SUPABASE_ANON_KEY is missing or unsafe for browser output.");
}

function normalized(path) {
  return path.replaceAll("\\", "/");
}

function productionFilter(source) {
  return !/sakura/i.test(normalized(relative(root, source)));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const entry of ["assets", "src", "solicitudes"]) {
  cpSync(join(root, entry), join(output, entry), {
    recursive: true,
    filter: productionFilter,
  });
}

const manifest = JSON.parse(readFileSync(join(root, "manifest.webmanifest"), "utf8"));
manifest.name = "ONE STUDIOS Marketing Cloud";
manifest.short_name = "ONE STUDIOS";
manifest.description = "Sistema web de operación y colaboración de ONE STUDIOS.";
writeJson(join(output, "manifest.webmanifest"), manifest);

let html = readFileSync(join(root, "index.html"), "utf8");
html = html
  .replace(/<title>[\s\S]*?<\/title>/i, "<title>ONE STUDIOS Marketing Cloud</title>")
  .replace(/<(?:link|script)\b(?=[^>]*(?:href|src|data-inbestiga-module)=["'][^"']*sakura[^"']*["'])[^>]*>(?:<\/script>)?/gi, "")
  .replace(/<button\b[^>]*id=["']sakuraNativeLauncher["'][\s\S]*?<\/button>/i, "");

if (/sakura/i.test(html)) throw new Error("SAKURA remains in production index.html.");
writeFileSync(join(output, "index.html"), html);

mkdirSync(join(output, "config"), { recursive: true });
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

const sourceBuildManifest = JSON.parse(readFileSync(join(root, "config", "build-manifest.json"), "utf8"));
const productionBuildManifest = {
  product: "ONE STUDIOS Marketing Cloud",
  version: "v17.16.7",
  frontend_version: "17.16.7",
  build: "WEB SYSTEM",
  entrypoint: "index.html",
  modules: (sourceBuildManifest.modules || []).filter((module) => {
    const path = String(module.path || "");
    return path && !/sakura/i.test(`${module.name || ""} ${path}`) && existsSync(join(output, path));
  }),
};
writeJson(join(output, "config", "build-manifest.json"), productionBuildManifest);
cpSync(join(root, "config", "rpc-manifest.json"), join(output, "config", "rpc-manifest.json"));

function localReferences(document) {
  const references = [];
  for (const match of document.matchAll(/(?:src|href)=["']([^"'#]+)["']/gi)) {
    const raw = match[1];
    if (/^(?:https?:|data:|mailto:|tel:|javascript:)/i.test(raw)) continue;
    const path = raw.split("?")[0];
    if (!path || path === "/") continue;
    references.push(`/${path.replace(/^\.\//, "").replace(/^\//, "")}`);
  }
  return references;
}

const solicitudesHtml = readFileSync(join(output, "solicitudes", "index.html"), "utf8");
const shell = [...new Set([
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/config/public-runtime-config.js",
  "/config/build-manifest.json",
  "/config/rpc-manifest.json",
  "/solicitudes/",
  "/solicitudes/index.html",
  "/solicitudes/manifest.webmanifest",
  "/solicitudes/service-worker.js",
  ...localReferences(html),
  ...localReferences(solicitudesHtml),
])].sort();

for (const path of shell) {
  if (["/", "/solicitudes/"].includes(path)) continue;
  const file = join(output, decodeURIComponent(path.replace(/^\//, "")));
  if (!existsSync(file)) throw new Error(`Production PWA reference missing: ${path}`);
}

const serviceWorker = `/* generated web-only PWA shell */
const CACHE_NAME="one-studios-web-v18";
const SHELL=${JSON.stringify(shell, null, 2)};
self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("install",event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);await Promise.all(SHELL.map(async path=>{const response=await fetch(new Request(path,{cache:"reload"}));if(!response.ok)throw new Error(\`\${path}: HTTP \${response.status}\`);await cache.put(path,response.clone())}));await self.skipWaiting()})())});
self.addEventListener("activate",event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)));await self.clients.claim()})())});
self.addEventListener("fetch",event=>{const request=event.request;if(request.method!=="GET")return;const url=new URL(request.url);if(url.origin!==self.location.origin)return;if(request.mode==="navigate"){event.respondWith(fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));return response}).catch(()=>caches.match("/index.html")));return}event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy))}return response}).catch(()=>caches.match(request))) });
`;
writeFileSync(join(output, "service-worker.js"), serviceWorker);

console.log(`Vercel artifact created: ${relative(root, output)}`);
console.log(`PWA shell entries: ${shell.length}`);
