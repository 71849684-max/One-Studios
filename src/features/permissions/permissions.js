(function permissionManagerFeature(global) {
  "use strict";

  const root = document.getElementById("permissionManager");
  if (!root) return;

  const catalogFallback = [
    ["home.view", "Principal", "Ver", "Abrir el inicio y sus indicadores", 10],
    ["myday.view", "Trabajo personal", "Ver Mi día", "Consultar prioridades y agenda propias", 20],
    ["tasks.view", "Tareas", "Ver", "Consultar tareas disponibles para la sesión", 30],
    ["tasks.create", "Tareas", "Crear", "Registrar tareas nuevas", 31],
    ["tasks.edit", "Tareas", "Editar", "Actualizar tareas existentes", 32],
    ["tasks.assign", "Tareas", "Asignar", "Cambiar responsables y carga", 33],
    ["tasks.approve", "Tareas", "Aprobar", "Validar u observar entregas", 34],
    ["campaigns.view", "Campañas", "Ver", "Consultar campañas y briefs", 40],
    ["campaigns.create", "Campañas", "Crear", "Registrar campañas y briefs", 41],
    ["campaigns.edit", "Campañas", "Editar", "Modificar campañas", 42],
    ["editorial.view", "Editorial", "Ver", "Consultar el calendario editorial", 50],
    ["editorial.create", "Editorial", "Crear", "Programar contenidos", 51],
    ["editorial.edit", "Editorial", "Editar", "Modificar publicaciones programadas", 52],
    ["creativeRoomsClean.view", "Creativo", "Ver Canvas", "Abrir salas creativas y Canvas", 60],
    ["creativeRoomsClean.create", "Creativo", "Crear", "Crear salas y recursos creativos", 61],
    ["assets.view", "Archivos", "Ver", "Consultar archivos y entregables", 70],
    ["assets.create", "Archivos", "Subir", "Incorporar archivos al sistema", 71],
    ["messages.view", "Comunicación", "Ver mensajes", "Usar mensajería interna", 80],
    ["wall.view", "Comunicación", "Ver Muro", "Consultar publicaciones internas", 81],
    ["wall.create", "Comunicación", "Publicar", "Crear publicaciones internas", 82],
    ["reports.view", "Reportes", "Ver", "Consultar reportes operativos", 90],
    ["reports.export", "Reportes", "Exportar", "Descargar reportes", 91],
    ["treasury.view", "Finanzas", "Ver", "Consultar contratos, cuotas y bóveda", 100],
    ["treasury.create", "Finanzas", "Crear contratos", "Registrar contratos y cuotas", 101],
    ["treasury.edit", "Finanzas", "Editar contratos", "Corregir datos y cambiar estados", 102],
    ["treasury.record_payment", "Finanzas", "Registrar movimientos", "Registrar cobros, gastos, aportes y retiros", 103],
    ["treasury.edit_movements", "Finanzas", "Editar movimientos", "Corregir movimientos con motivo y auditoría", 104],
    ["treasury.cancel", "Finanzas", "Anular contratos", "Anular contratos dejando trazabilidad", 104],
    ["treasury.export", "Finanzas", "Imprimir y exportar", "Generar documentos financieros", 105],
    ["treasury.audit", "Finanzas", "Ver auditoría", "Consultar quién creó o modificó operaciones financieras", 106],
    ["control.view", "Control", "Ver", "Consultar indicadores gerenciales", 110],
    ["workload.view", "Control", "Ver carga", "Consultar capacidad del equipo", 111],
    ["auditpro.view", "Seguridad", "Ver auditoría", "Consultar trazabilidad", 120],
    ["auditpro.export", "Seguridad", "Exportar auditoría", "Descargar trazabilidad", 121],
    ["governance.view", "Seguridad", "Ver gobernanza", "Consultar controles de seguridad", 122],
    ["admin.view", "Administración", "Ver", "Abrir administración", 130],
    ["admin.manage_users", "Administración", "Gestionar usuarios", "Crear y actualizar miembros", 131],
    ["permissions.view", "Administración", "Ver permisos", "Consultar distribución de accesos", 132],
    ["permissions.manage", "Administración", "Gestionar permisos", "Cambiar roles y excepciones personales", 133],
  ].map(([code, module_name, action_name, description, sort_order]) => ({ code, module_code: code.split(".")[0], module_name, action_code: code.split(".")[1], action_name, description, sort_order }));

  const ui = { tab: "roles", role: "", memberId: "", search: "", loading: false };
  const store = { catalog: [], roles: [], members: [], rolePermissions: [], memberPermissions: [], effectivePermissions: [], canManage: false, loaded: false, error: "" };
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const codeOf = (row) => row.permission_code || [row.module, row.action].filter(Boolean).join(".");
  const roleName = (role) => role?.name || role?.label || role?.code || "Rol";
  const currentRole = () => ui.role || store.roles[0]?.code || "member";
  const currentMember = () => store.members.find((row) => row.id === ui.memberId);

  function api() {
    return typeof sb !== "undefined" ? sb : null;
  }

  async function rpc(name, payload = {}) {
    const client = api();
    if (!client) throw new Error("La conexión con Supabase no está disponible.");
    const { data, error } = await client.rpc(name, payload);
    if (error) throw error;
    if (data?.ok === false) throw new Error(data.error || "La operación fue rechazada.");
    return data || {};
  }

  function normalizeLegacyRules(rows) {
    return (rows || []).map((row) => {
      const code = codeOf(row);
      return { ...row, permission_code: code, module: row.module || code.split(".")[0], action: row.action || code.split(".")[1] };
    }).filter((row) => row.permission_code);
  }

  function syncGlobalState() {
    if (typeof state === "undefined") return;
    state.role_permissions = normalizeLegacyRules(store.rolePermissions);
    state.member_permissions = store.memberPermissions;
    state.effective_permissions = store.effectivePermissions;
    if (typeof applyRoleNavigation === "function") applyRoleNavigation();
    if (typeof applyVisualPermissions === "function") applyVisualPermissions();
    const allowed = (code) => {
      const effective = store.effectivePermissions.find((row) => row.permission_code === code);
      return effective ? effective.allowed === true : ruleAllowed(typeof member !== "undefined" ? member?.role_code : "", code);
    };
    [["finanzas",allowed("treasury.view")],["control",allowed("control.view")||allowed("reports.view")||allowed("auditpro.view")],["admin",allowed("admin.view")||allowed("permissions.view")]].forEach(([id,visible])=>{const button=document.querySelector(`[data-v472-menu="${id}"]`);if(button)button.hidden=!visible;});
    global.dispatchEvent(new CustomEvent("inbestiga:permissions-ready"));
  }

  async function load(options = {}) {
    if (ui.loading) return;
    ui.loading = true;
    if (!options.silent) renderLoading();
    try {
      const data = await rpc("ibm_permissions_bootstrap");
      store.catalog = data.catalog?.length ? data.catalog : catalogFallback;
      store.roles = data.roles || [];
      store.members = data.members || [];
      store.rolePermissions = normalizeLegacyRules(data.role_permissions || []);
      store.memberPermissions = data.member_permissions || [];
      store.effectivePermissions = data.effective_permissions || [];
      store.canManage = data.can_manage === true;
      store.error = "";
    } catch (error) {
      store.catalog = catalogFallback;
      store.roles = typeof state !== "undefined" ? state.roles || [] : [];
      store.members = typeof state !== "undefined" ? state.members || [] : [];
      store.rolePermissions = normalizeLegacyRules(typeof state !== "undefined" ? state.role_permissions || [] : []);
      try {
        const personal = await rpc("ibm_my_effective_permissions");
        store.effectivePermissions = personal.effective_permissions || [];
      } catch (_) {
        store.effectivePermissions = [];
      }
      store.canManage = typeof isDirector === "function" && isDirector();
      store.error = store.effectivePermissions.length ? "" : /ibm_permissions_bootstrap|schema cache|pgrst202/i.test(error.message || "")
        ? "Falta aplicar la migración de permisos v18 en Supabase. La matriz se muestra en modo compatible."
        : String(error.message || error);
    } finally {
      ui.loading = false;
      store.loaded = true;
    }
    if (!ui.role || !store.roles.some((row) => row.code === ui.role)) ui.role = store.roles[0]?.code || "member";
    if (!ui.memberId || !store.members.some((row) => row.id === ui.memberId)) ui.memberId = store.members[0]?.id || "";
    syncGlobalState();
    render();
  }

  function ruleAllowed(roleCode, permissionCode) {
    const rule = store.rolePermissions.find((row) => row.role_code === roleCode && row.permission_code === permissionCode);
    return rule ? rule.allowed === true : false;
  }

  function memberMode(memberId, permissionCode) {
    const rule = store.memberPermissions.find((row) => row.member_id === memberId && row.permission_code === permissionCode);
    return !rule ? "inherit" : rule.allowed ? "allow" : "deny";
  }

  function filteredCatalog() {
    const query = ui.search.trim().toLocaleLowerCase("es");
    if (!query) return store.catalog;
    return store.catalog.filter((row) => [row.module_name, row.action_name, row.description, row.code].some((value) => String(value || "").toLocaleLowerCase("es").includes(query)));
  }

  function groupedCatalog() {
    const groups = new Map();
    filteredCatalog().sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)).forEach((row) => {
      const key = row.module_name || row.module_code;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    return groups;
  }

  function summaryMarkup() {
    const role = currentRole();
    const allowed = store.catalog.filter((row) => ruleAllowed(role, row.code)).length;
    const denied = Math.max(0, store.catalog.length - allowed);
    const overrides = store.memberPermissions.filter((row) => row.member_id === ui.memberId).length;
    return `<div class="pm-summary"><article><span>Permisos habilitados</span><strong>${allowed}</strong><small>para ${esc(roleName(store.roles.find((row) => row.code === role)))}</small></article><article><span>Permisos restringidos</span><strong>${denied}</strong><small>bloqueados explícitamente</small></article><article><span>Excepciones personales</span><strong>${overrides}</strong><small>${esc(currentMember()?.full_name || "Selecciona una persona")}</small></article><article><span>Modelo de seguridad</span><strong>RLS</strong><small>validación real en Supabase</small></article></div>`;
  }

  function roleMatrixMarkup() {
    const role = currentRole();
    const groups = groupedCatalog();
    if (!groups.size) return `<div class="pm-empty">No hay permisos que coincidan con la búsqueda.</div>`;
    return [...groups.entries()].map(([name, rows]) => {
      const count = rows.filter((row) => ruleAllowed(role, row.code)).length;
      return `<section class="pm-module"><header><div><h3>${esc(name)}</h3><p>${count} de ${rows.length} habilitados</p></div><button type="button" class="pm-link" data-pm-toggle-module="${esc(rows[0].module_code)}" ${store.canManage ? "" : "disabled"}>${count === rows.length ? "Restringir grupo" : "Habilitar grupo"}</button></header><div class="pm-permission-list">${rows.map((row) => `<label class="pm-permission-row"><span><strong>${esc(row.action_name)}</strong><small>${esc(row.description)}</small><code>${esc(row.code)}</code></span><input type="checkbox" data-pm-role-permission="${esc(row.code)}" ${ruleAllowed(role, row.code) ? "checked" : ""} ${store.canManage ? "" : "disabled"}><i aria-hidden="true"></i></label>`).join("")}</div></section>`;
    }).join("");
  }

  function memberMatrixMarkup() {
    const person = currentMember();
    if (!person) return `<div class="pm-empty">No hay usuarios activos para configurar.</div>`;
    const groups = groupedCatalog();
    return `<div class="pm-person-note"><strong>Herencia segura</strong><span>Una excepción sólo debe usarse cuando el rol no representa una necesidad particular. “Heredar del rol” elimina la excepción.</span></div>${[...groups.entries()].map(([name, rows]) => `<section class="pm-module"><header><div><h3>${esc(name)}</h3><p>Acceso personal de ${esc(person.full_name)}</p></div></header><div class="pm-permission-list">${rows.map((row) => { const mode = memberMode(person.id, row.code); const inherited = ruleAllowed(person.role_code, row.code); return `<label class="pm-member-row"><span><strong>${esc(row.action_name)}</strong><small>Rol ${esc(roleName(store.roles.find((role) => role.code === person.role_code)))}: ${inherited ? "permitido" : "restringido"}</small><code>${esc(row.code)}</code></span><select data-pm-member-permission="${esc(row.code)}" ${store.canManage ? "" : "disabled"}><option value="inherit" ${mode === "inherit" ? "selected" : ""}>Heredar del rol</option><option value="allow" ${mode === "allow" ? "selected" : ""}>Permitir como excepción</option><option value="deny" ${mode === "deny" ? "selected" : ""}>Restringir como excepción</option></select></label>`; }).join("")}</div></section>`).join("")}`;
  }

  function renderLoading() {
    root.innerHTML = `<div class="pm-loading"><span></span><strong>Cargando distribución de permisos…</strong></div>`;
  }

  function render() {
    if (!store.loaded) return renderLoading();
    const roleOptions = store.roles.map((role) => `<option value="${esc(role.code)}" ${role.code === currentRole() ? "selected" : ""}>${esc(roleName(role))}</option>`).join("");
    const memberOptions = store.members.filter((row) => row.status !== "inactive").map((row) => `<option value="${esc(row.id)}" ${row.id === ui.memberId ? "selected" : ""}>${esc(row.full_name)} · ${esc(roleName(store.roles.find((role) => role.code === row.role_code)))}</option>`).join("");
    root.innerHTML = `<div class="pm-shell">
      <header class="pm-hero"><div><span class="pm-eyebrow">Administración de acceso</span><h2>Permisos claros, por rol y por persona</h2><p>Define qué puede consultar o modificar cada perfil. Los cambios se validan también en Supabase mediante RLS.</p></div><span class="pm-security-badge">Seguridad aplicada en servidor</span></header>
      ${store.error ? `<div class="pm-alert">${esc(store.error)}</div>` : ""}
      ${summaryMarkup()}
      <div class="pm-toolbar"><div class="pm-tabs" role="tablist"><button type="button" data-pm-tab="roles" class="${ui.tab === "roles" ? "active" : ""}">Permisos por rol</button><button type="button" data-pm-tab="members" class="${ui.tab === "members" ? "active" : ""}">Excepciones por persona</button></div><label class="pm-search"><span>Buscar permiso</span><input id="pmSearch" value="${esc(ui.search)}" placeholder="Ej. contratos, aprobar, reportes"></label></div>
      <div class="pm-config-bar">${ui.tab === "roles" ? `<label><span>Rol que vas a configurar</span><select id="pmRoleSelect">${roleOptions}</select></label><label><span>Plantilla recomendada</span><select id="pmPreset"><option value="basic">Operación básica</option><option value="supervision">Supervisión</option><option value="finance">Tesorería</option><option value="full">Acceso completo</option></select></label><button type="button" id="pmApplyPreset" ${store.canManage ? "" : "disabled"}>Aplicar plantilla</button>` : `<label class="pm-grow"><span>Persona</span><select id="pmMemberSelect">${memberOptions}</select></label><div class="pm-context"><strong>${esc(currentMember()?.full_name || "Sin selección")}</strong><span>Rol base: ${esc(roleName(store.roles.find((role) => role.code === currentMember()?.role_code)))}</span></div>`}</div>
      <div class="pm-matrix">${ui.tab === "roles" ? roleMatrixMarkup() : memberMatrixMarkup()}</div>
      ${!store.canManage ? `<div class="pm-readonly">Tu cuenta puede consultar esta distribución, pero no modificarla.</div>` : ""}
    </div>`;
  }

  async function setRolePermission(code, allowed) {
    try {
      await rpc("ibm_permissions_set_role", { p_role_code: currentRole(), p_permission_code: code, p_allowed: allowed });
      await load({ silent: true });
      if (typeof toast === "function") toast("Permiso actualizado", `${allowed ? "Habilitado" : "Restringido"}: ${code}`);
    } catch (error) {
      if (typeof toast === "function") toast("No se pudo actualizar", error.message || String(error));
      await load({ silent: true });
    }
  }

  async function setMemberPermission(code, mode) {
    try {
      await rpc("ibm_permissions_set_member", { p_member_id: ui.memberId, p_permission_code: code, p_mode: mode });
      await load({ silent: true });
      if (typeof toast === "function") toast("Excepción actualizada", mode === "inherit" ? "Se restableció la herencia del rol." : "La excepción personal quedó guardada.");
    } catch (error) {
      if (typeof toast === "function") toast("No se pudo actualizar", error.message || String(error));
      await load({ silent: true });
    }
  }

  async function applyPreset() {
    const select = document.getElementById("pmPreset");
    try {
      await rpc("ibm_permissions_apply_preset", { p_role_code: currentRole(), p_preset_code: select?.value || "basic" });
      await load({ silent: true });
      if (typeof toast === "function") toast("Plantilla aplicada", "Revisa la matriz antes de asignar el rol a más personas.");
    } catch (error) {
      if (typeof toast === "function") toast("No se pudo aplicar", error.message || String(error));
    }
  }

  root.addEventListener("click", async (event) => {
    const tabButton = event.target.closest("[data-pm-tab]");
    if (tabButton) { ui.tab = tabButton.dataset.pmTab; render(); return; }
    if (event.target.closest("#pmApplyPreset")) { await applyPreset(); return; }
    const groupButton = event.target.closest("[data-pm-toggle-module]");
    if (groupButton) {
      const rows = store.catalog.filter((row) => row.module_code === groupButton.dataset.pmToggleModule);
      const allow = !rows.every((row) => ruleAllowed(currentRole(), row.code));
      groupButton.disabled = true;
      try { await rpc("ibm_permissions_set_module", { p_role_code: currentRole(), p_module_code: groupButton.dataset.pmToggleModule, p_allowed: allow }); await load({ silent: true }); }
      catch (error) { if (typeof toast === "function") toast("No se pudo actualizar el grupo", error.message || String(error)); groupButton.disabled = false; }
    }
  });

  root.addEventListener("change", async (event) => {
    if (event.target.id === "pmRoleSelect") { ui.role = event.target.value; render(); return; }
    if (event.target.id === "pmMemberSelect") { ui.memberId = event.target.value; render(); return; }
    if (event.target.matches("[data-pm-role-permission]")) { event.target.disabled = true; await setRolePermission(event.target.dataset.pmRolePermission, event.target.checked); return; }
    if (event.target.matches("[data-pm-member-permission]")) { event.target.disabled = true; await setMemberPermission(event.target.dataset.pmMemberPermission, event.target.value); }
  });

  root.addEventListener("input", (event) => {
    if (event.target.id !== "pmSearch") return;
    ui.search = event.target.value;
    const selection = [event.target.selectionStart, event.target.selectionEnd];
    render();
    const input = document.getElementById("pmSearch");
    input?.focus();
    input?.setSelectionRange(...selection);
  });

  global.renderPermissions = render;
  global.OneStudios ||= {};
  global.OneStudios.permissions = Object.freeze({ load, render, isAllowed: (code) => {
    if (!store.loaded && typeof hasVisualPermission === "function") { const [module, action] = String(code).split("."); return hasVisualPermission(module, action); }
    const effective = store.effectivePermissions.find((row) => row.permission_code === code);
    if (effective) return effective.allowed === true;
    const role = typeof member !== "undefined" ? member?.role_code : "";
    return ruleAllowed(role, code);
  } });

  global.addEventListener("inbestiga:session-ready", () => load());
  if (typeof member !== "undefined" && member?.id) load(); else renderLoading();
})(window);
