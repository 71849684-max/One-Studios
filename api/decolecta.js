const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const requests = new Map();

function send(response, status, payload) {
  response.statusCode = status;
  Object.entries(JSON_HEADERS).forEach(([key, value]) => response.setHeader(key, value));
  response.end(JSON.stringify(payload));
}

function normalizeDocument(type, value) {
  const document = String(value || "").replace(/\D+/g, "");
  const expected = type === "ruc" ? 11 : 8;
  return document.length === expected ? document : "";
}

function normalizeProvider(type, payload, document) {
  const source = payload?.data || payload || {};
  if (type === "ruc") {
    return {
      document,
      document_type: "RUC",
      name: String(source.razon_social || source.nombre_o_razon_social || source.nombre || "").trim(),
      address: String(source.direccion || source.domicilio_fiscal || "").trim(),
      status: String(source.estado || "").trim(),
      condition: String(source.condicion || "").trim(),
    };
  }
  const fullName = source.nombre_completo || [source.nombres, source.apellido_paterno, source.apellido_materno].filter(Boolean).join(" ");
  return {
    document,
    document_type: "DNI",
    name: String(fullName || source.nombre || "").replace(/\s+/g, " ").trim(),
    address: String(source.direccion || "").trim(),
  };
}

async function authenticatedUser(authorization) {
  const base = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anon = String(process.env.SUPABASE_ANON_KEY || "");
  if (!base || !anon || !authorization?.startsWith("Bearer ")) return null;
  const response = await fetch(`${base}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: anon },
  });
  if (!response.ok) return null;
  return response.json();
}

function withinLimit(subject) {
  const now = Date.now();
  const recent = (requests.get(subject) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 12) return false;
  recent.push(now);
  requests.set(subject, recent);
  return true;
}

export default async function handler(request, response) {
  if (request.method !== "POST") return send(response, 405, { ok: false, error: "Método no permitido." });
  try {
    const user = await authenticatedUser(request.headers.authorization);
    if (!user?.id) return send(response, 401, { ok: false, error: "Sesión no válida." });
    if (!withinLimit(user.id)) return send(response, 429, { ok: false, error: "Demasiadas consultas. Intenta en un minuto." });

    const type = String(request.body?.type || "").toLowerCase();
    if (!['dni', 'ruc'].includes(type)) return send(response, 400, { ok: false, error: "Tipo de documento no válido." });
    const document = normalizeDocument(type, request.body?.document);
    if (!document) return send(response, 400, { ok: false, error: type === "ruc" ? "El RUC debe tener 11 dígitos." : "El DNI debe tener 8 dígitos." });

    const token = String(process.env.DECOLECTA_TOKEN || "");
    const endpoint = type === "ruc"
      ? String(process.env.DECOLECTA_RUC_ENDPOINT || "https://api.decolecta.com/v1/sunat/ruc")
      : String(process.env.DECOLECTA_DNI_ENDPOINT || "https://api.decolecta.com/v1/reniec/dni");
    if (!token) return send(response, 503, { ok: false, error: "La integración DeColecta aún no está configurada en el servidor." });

    const url = new URL(endpoint);
    url.searchParams.set(type, document);
    const provider = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await provider.json().catch(() => ({}));
    if (!provider.ok) {
      const status = provider.status === 404 ? 404 : 502;
      return send(response, status, { ok: false, error: status === 404 ? "No se encontró información para el documento." : "DeColecta no respondió correctamente." });
    }
    const data = normalizeProvider(type, payload, document);
    if (!data.name) return send(response, 404, { ok: false, error: "La consulta no devolvió un nombre válido." });
    return send(response, 200, { ok: true, data });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return send(response, 502, { ok: false, error: timedOut ? "La consulta superó el tiempo de espera." : "No se pudo completar la consulta." });
  }
}
