import assert from "node:assert/strict";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = join(root, ".vercel-static");

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://127.0.0.1").pathname);
  const requested = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const candidate = normalize(join(output, requested.replace(/^\//, "")));
  return candidate.startsWith(output) ? candidate : "";
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const server = createServer((request, response) => {
  const path = resolveRequestPath(request.url || "/");
  if (!path || !existsSync(path) || !statSync(path).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": contentTypes[extname(path)] || "application/octet-stream" });
  createReadStream(path).pipe(response);
});

await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const address = server.address();
const base = `http://127.0.0.1:${address.port}`;

try {
  for (const path of [
    "/", "/config/public-runtime-config.js", "/service-worker.js",
    "/solicitudes/", "/manifest.webmanifest",
  ]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, path);
    assert.ok((await response.arrayBuffer()).byteLength > 0, path);
  }

  for (const path of [
    "/supabase/seed.sql",
    "/database/mariadb/ONE_STUDIOS_LOCAL_BASELINE.sql",
    "/api/sakura-web",
    "/tools/installers/OllamaSetup.exe",
  ]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 404, path);
  }

  console.log("Vercel artifact smoke test passed.");
} finally {
  await new Promise((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
}
