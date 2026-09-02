(function registerTreasuryRepository(global) {
  "use strict";

  function client() {
    return typeof sb !== "undefined" ? sb : null;
  }

  function failure(error) {
    return { ok: false, data: null, error: String(error?.message || error || "Error no identificado") };
  }

  async function rpc(name, payload) {
    const supabase = client();
    if (!supabase) return failure("La conexión con Supabase no está disponible.");
    try {
      const api = typeof supabase.schema === "function"
        ? supabase.schema("marketing_app")
        : supabase;
      const { data, error } = await api.rpc(name, payload || {});
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error || "La operación fue rechazada.");
      return { ok: true, data, error: null };
    } catch (error) {
      return failure(error);
    }
  }

  async function lookupDocument(type, documentNumber) {
    const supabase = client();
    if (!supabase) return failure("Debes iniciar sesión para consultar documentos.");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("La sesión ha caducado. Vuelve a ingresar.");
      const hostname = String(global.location.hostname || "").toLowerCase();
      const local = ["localhost", "127.0.0.1", "::1"].includes(hostname)
        || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
      const endpoint = local ? "api/decolecta.php" : "api/decolecta";
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Requested-With": "fetch",
        },
        body: JSON.stringify({ type, document: documentNumber }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) throw new Error(body.error || "No se pudo consultar el documento.");
      return { ok: true, data: body.data, error: null };
    } catch (error) {
      return failure(error);
    }
  }

  async function loadTreasury() {
    const base = await rpc("ibm_treasury_bootstrap");
    if (!base.ok) return base;
    const extras = await rpc("ibm_treasury_movement_extras");
    base.data ||= {};
    base.data.capabilities ||= {};
    if (extras.ok) {
      base.data.capabilities.edit_movements = extras.data?.edit_movements === true;
      base.data.evidence = extras.data?.evidence || [];
    } else {
      base.data.capabilities.edit_movements = false;
      base.data.evidence = [];
    }
    return base;
  }

  function safeFileName(name) {
    return String(name || "evidencia.jpg")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-")
      .slice(-150);
  }

  async function uploadMovementEvidence(movementId, file) {
    const supabase = client();
    if (!supabase) return failure("La conexión con Supabase no está disponible.");
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file?.type)) return failure("Solo se permiten imágenes JPG, PNG o WebP.");
    if (!file.size || file.size > 10 * 1024 * 1024) return failure("Cada evidencia debe pesar como máximo 10 MB.");
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.id) throw userError || new Error("La sesión ha caducado.");
      const path = `${userData.user.id}/movements/${movementId}/${Date.now()}-${safeFileName(file.name)}`;
      const bucket = supabase.storage.from("treasury-evidence");
      const { error: uploadError } = await bucket.upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const registered = await rpc("ibm_treasury_register_evidence", {
        p_movement_id: movementId,
        p_storage_path: path,
        p_file_name: file.name,
        p_mime_type: file.type,
        p_file_size: file.size,
      });
      if (!registered.ok) {
        await bucket.remove([path]);
        return registered;
      }
      return registered;
    } catch (error) {
      return failure(error);
    }
  }

  async function createEvidenceUrl(storagePath) {
    const supabase = client();
    if (!supabase) return failure("La conexión con Supabase no está disponible.");
    try {
      const { data, error } = await supabase.storage.from("treasury-evidence").createSignedUrl(storagePath, 900);
      if (error) throw error;
      return { ok: true, data: data?.signedUrl || "", error: null };
    } catch (error) {
      return failure(error);
    }
  }

  global.OneStudios ||= {};
  global.OneStudios.services ||= {};
  global.OneStudios.services.treasury = Object.freeze({
    load: loadTreasury,
    createContract: (payload) => rpc("ibm_treasury_create_contract", { p_payload: payload }),
    updateContract: (contractId, payload) => rpc("ibm_treasury_update_contract", { p_contract_id: contractId, p_payload: payload }),
    setContractStatus: (contractId, status, reason) => rpc("ibm_treasury_set_contract_status", { p_contract_id: contractId, p_status: status, p_reason: reason || "" }),
    addMovement: (payload) => rpc("ibm_treasury_add_movement", { p_payload: payload }),
    updateMovement: (movementId, payload, reason) => rpc("ibm_treasury_update_movement", { p_movement_id: movementId, p_payload: payload, p_reason: reason }),
    uploadMovementEvidence,
    createEvidenceUrl,
    lookupDocument,
  });
})(window);
