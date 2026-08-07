(function registerSupabaseService(global) {
  "use strict";

  const CLIENT_VERSION = "17.16.7";

  function createClient(config) {
    const url = String(config?.url || "").trim();
    const key = String(config?.key || "").trim();

    if (!url || !key || typeof global.supabase?.createClient !== "function") return null;

    return global.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          "X-Client-Info": `one-studios-marketing-cloud/${CLIENT_VERSION}`,
        },
      },
    });
  }

  global.OneStudios ||= {};
  global.OneStudios.services ||= {};
  global.OneStudios.services.supabase = Object.freeze({
    version: CLIENT_VERSION,
    createClient,
  });

  document.currentScript?.setAttribute("data-service-ready", CLIENT_VERSION);
})(window);
