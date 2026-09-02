let sb=null, session=null, authUser=null, member=null;
let state={clients:[],areas:[],members:[],campaigns:[],briefs:[],tasks:[],editorial:[],posts:[],comments:[],reactions:[],messages:[],notifications:[],assets:[],roles:[],settings:[],approval_history:[],client_errors:[],report_snapshots:[],role_permissions:[],live_presence:[],live_events:[],user_preferences:{},home_feed_preferences:{},member_work_profiles:[],member_time_events:[],member_work_links:[],member_schedule_blocks:[],member_schedule_exceptions:[],member_schedule_grid_slots:[],member_schedule_submissions:[],schedule_email_logs:[],cr_rooms:[],cr_items:[]};
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

function premiumToast(title, body="", type="info"){
  const stack=$("premiumToastStack");
  if(!stack){return}
  const d=document.createElement("div");
  d.className=`premium-toast ${type}`;
  d.innerHTML=`<div class="toast-icon">${premiumIcon(type)}</div><div><strong>${esc(title)}</strong><p>${esc(body||"")}</p></div>`;
  stack.prepend(d);
  setTimeout(()=>{d.style.opacity="0";d.style.transform="translateY(-8px) scale(.98)";setTimeout(()=>d.remove(),220)},4200);
}
function openPremiumModal({title="Acción",subtitle="",icon="",body="",actions=[]}={}){
  return new Promise(resolve=>{
    const backdrop=$("premiumModalBackdrop"), bodyEl=$("premiumModalBody"), actionsEl=$("premiumModalActions");
    $("premiumModalIcon").textContent=icon;
    $("premiumModalTitle").textContent=title;
    $("premiumModalSub").textContent=subtitle||"";
    bodyEl.innerHTML=body||"";
    actionsEl.innerHTML="";
    let settled=false;
    const close=(value=null)=>{if(settled)return;settled=true;backdrop.classList.remove("open");resolve(value)};
    $("premiumModalClose").onclick=()=>close(null);
    backdrop.onclick=e=>{if(e.target===backdrop)close(null)};
    actions.forEach(a=>{
      const btn=document.createElement("button");
      btn.type="button";
      btn.className=a.className||"ghost";
      btn.innerHTML=a.label||"Aceptar";
      btn.onclick=()=>close(a.value);
      actionsEl.appendChild(btn);
    });
    backdrop.classList.add("open");
    setTimeout(()=>{const first=bodyEl.querySelector("textarea,input,select"); if(first) first.focus()},60);
  });
}
async function premiumInputModal({title,subtitle,icon="",label="Comentario",placeholder="",preview="",confirmLabel="Aceptar",cancelLabel="Cancelar",required=false}){
  const id="premiumInput_"+Math.random().toString(36).slice(2);
  const val=await openPremiumModal({
    title,subtitle,icon,
    body:`${preview?`<div class="modal-preview">${preview}</div>`:""}<label>${esc(label)}<textarea id="${id}" placeholder="${esc(placeholder)}"></textarea></label>`,
    actions:[
      {label:cancelLabel,value:null,className:"ghost"},
      {label:confirmLabel,value:"confirm",className:"primary"}
    ]
  });
  if(val!=="confirm")return null;
  const text=$(id)?.value||"";
  if(required && !text.trim()){
    premiumToast("Falta completar", "Escribe un comentario para continuar.", "warning");
    return await premiumInputModal({title,subtitle,icon,label,placeholder,preview,confirmLabel,cancelLabel,required});
  }
  return text;
}
async function premiumConfirmModal({title,subtitle,icon="",preview="",confirmLabel="Confirmar",cancelLabel="Cancelar"}){
  return await openPremiumModal({
    title,subtitle,icon,
    body:preview?`<div class="modal-preview">${preview}</div>`:"",
    actions:[
      {label:cancelLabel,value:false,className:"ghost"},
      {label:confirmLabel,value:true,className:"primary"}
    ]
  });
}

function managedRuntimeConfig(){const value=window.INBESTIGA_PUBLIC_RUNTIME_CONFIG||{};return {url:String(value.supabaseUrl||"").replace(/\/rest\/v1\/?$/i,"").replace(/\/$/,""),key:String(value.supabaseAnonKey||""),managed:!!value.managed};}
function syncManagedRuntimeConfig(){const value=managedRuntimeConfig();if(!value.url||!value.key)return false;try{localStorage.setItem("IBM_SUPABASE_URL",value.url);localStorage.setItem("IBM_SUPABASE_ANON",value.key);sessionStorage.setItem("IBM_SUPABASE_URL",value.url);sessionStorage.setItem("IBM_SUPABASE_ANON",value.key);}catch(_){/* fallback en memoria */}return true;}
const cfg=()=>{const managed=managedRuntimeConfig();if(managed.url&&managed.key)return managed;return {url:localStorage.getItem("IBM_SUPABASE_URL")||sessionStorage.getItem("IBM_SUPABASE_URL")||"",key:localStorage.getItem("IBM_SUPABASE_ANON")||sessionStorage.getItem("IBM_SUPABASE_ANON")||"",managed:false};};
function friendlyAuthError(error){const message=String(error?.message||error||"");if(/failed to fetch|network|fetch failed|load failed/i.test(message))return "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo nuevamente.";if(/invalid login credentials/i.test(message))return "El correo o la contraseña no son correctos.";if(/email not confirmed/i.test(message))return "El correo todavía no fue confirmado.";if(/too many requests|rate limit/i.test(message))return "Se realizaron demasiados intentos. Espera un momento antes de volver a intentar.";return message||"No se pudo iniciar sesión.";}
function v121LocalDateKey(value=new Date(),timeZone="America/Lima"){
  try{
    const parts=new Intl.DateTimeFormat("en-US",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value);
    const map=Object.fromEntries(parts.map(part=>[part.type,part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }catch(error){
    const local=new Date(value.getTime()-value.getTimezoneOffset()*60000);
    return local.toISOString().slice(0,10);
  }
}
const today=()=>v121LocalDateKey();
function toast(title,body=""){premiumToast(title,body,"info")}
function setBox(id,text,type="ok"){const b=$(id);if(!b)return;b.className="status-box "+type;b.textContent=text}
function hideBox(id){const b=$(id);if(!b)return;b.className="status-box";b.textContent=""}
function show(screen){
  ["setupScreen","loginScreen","appScreen"].forEach(id=>$(id)?.classList.add("hidden"));
  $(screen)?.classList.remove("hidden");
  const sessionReady=screen==="appScreen";
  document.documentElement.dataset.inbestigaSession=sessionReady?"ready":"public";
  const orb=document.getElementById("sakuraNativeLauncher");
  if(orb){
    orb.hidden=false;
    orb.dataset.skSessionReady=sessionReady?"true":"false";
    orb.setAttribute("aria-hidden",sessionReady?"false":"true");
    if(sessionReady){
      orb.style.removeProperty("display");
      requestAnimationFrame(()=>window.INBESTIGA_SAKURA_STATIC_ORB?.mount?.());
    }else{
      orb.style.setProperty("display","none","important");
    }
  }
}
function createClient(){syncManagedRuntimeConfig();const c=cfg(),service=window.OneStudios?.services?.supabase;if(service?.createClient)return service.createClient(c);if(!c.url||!c.key||!window.supabase?.createClient)return null;return window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{headers:{"X-Client-Info":"one-studios-marketing-cloud/17.16.7"}}})}
function by(arr,id){return (arr||[]).find(x=>x.id===id)||{}}
function nameOf(arr,id,key="name"){return by(arr,id)[key]||""}
function memberName(id){return by(state.members,id).full_name||"Usuario"}
function initials(name){return String(name||"iB").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()}
function commentsFor(type,id){return (state.comments||[]).filter(x=>x.entity_type===type&&x.entity_id===id)}
function reactionsFor(type,id){const out={};(state.reactions||[]).filter(x=>x.entity_type===type&&x.entity_id===id).forEach(x=>out[x.reaction]=(out[x.reaction]||0)+1);return out}
function safeOptions(id,html){const el=$(id);if(el)el.innerHTML=html}
function safeVal(id){return $(id)?.value??""}

let v412RealtimeStarted=false;
let v412RenderCycle=0;
const v412TaskView={search:"",assignee:"",priority:"",scope:"all"};
function v412BootElements(){return {overlay:$("v412BootOverlay"),title:$("v412BootTitle"),detail:$("v412BootDetail"),bar:$("v412BootBar"),step:$("v412BootStep"),percent:$("v412BootPercent"),actions:$("v412BootActions")}}
function v412SetBoot(title,detail,percent=0,step="Preparando",error=false){const e=v412BootElements();if(!e.overlay)return;e.overlay.classList.remove("hidden");e.title.textContent=title;e.detail.textContent=detail;e.step.textContent=step;e.percent.textContent=Math.round(percent)+"%";e.bar.style.width=Math.max(0,Math.min(100,percent))+"%";e.actions.classList.toggle("hidden",!error);e.overlay.setAttribute("aria-busy",error?"false":"true")}
function v412HideBoot(){const e=v412BootElements();if(e.overlay)e.overlay.classList.add("hidden")}
function v412Message(err){return err?.message||String(err||"Error no identificado")}
function v412Idle(fn){if("requestIdleCallback" in window){requestIdleCallback(()=>fn(),{timeout:900})}else{requestAnimationFrame(()=>setTimeout(fn,0))}}
function v412LocalError(section,label,err){const target=$(section);if(!target)return;const old=target.querySelector(".v412-module-error");if(old)old.remove();const box=document.createElement("div");box.className="v412-module-error";box.innerHTML=`<strong>${esc(label)} no pudo actualizarse</strong><span>${esc(v412Message(err))}</span>`;target.prepend(box)}
async function v412SafeRender(section,label,fn){const started=performance.now();try{return await fn()}catch(err){console.error(`[v4.16] ${label}`,err);v412LocalError(section,label,err);try{logClientError("v412_render",label,err)}catch(e){}try{v414Audit("error",label,v412Message(err))}catch(e){}return null}finally{try{v414RecordRender(section,label,performance.now()-started)}catch(e){}}}
function v412ConnectionUI(){let el=$("v412Connection");if(!el){el=document.createElement("div");el.id="v412Connection";el.className="v412-connection";el.innerHTML="<i></i><span></span>";document.body.appendChild(el)}const online=navigator.onLine;const app=$("appScreen");el.style.display=app&&!app.classList.contains("hidden")?"flex":"none";el.classList.toggle("offline",!online);el.querySelector("span").textContent=online?"Conectado":"Sin conexión";return online}
function v412StartRealtime(){if(v412RealtimeStarted)return;try{startRealtime();v412RealtimeStarted=true}catch(err){console.error("Realtime",err)}}
function v412StatusKey(value){return String(value||"").toLowerCase().trim().replaceAll(" ","_")}
function v412TaskDone(t){return ["aprobado","publicado","completado","completada","finalizado","finalizada","done","hecho"].includes(v412StatusKey(t?.status))}
function v412TaskAwaitingReview(t){return ["en_revision","corregido"].includes(v412StatusKey(t?.status))}
function v412TaskNeedsAction(t){return !v412TaskDone(t)&&!v412TaskAwaitingReview(t)}
function v412TaskOverdue(t,referenceDate){const key=referenceDate||today();return !!(t?.due_date&&t.due_date<key&&v412TaskNeedsAction(t))}
function v412TaskDueToday(t,referenceDate){const key=referenceDate||today();return !!(t?.due_date===key&&v412TaskNeedsAction(t))}
function v412TaskProgress(t){const map={pendiente:14,en_proceso:42,corregido:62,en_revision:72,observado:54,aprobado:92,publicado:100};return map[v412StatusKey(t?.status)]||18}
function v412DateLabel(value){if(!value)return "Sin fecha";try{return new Date(value+"T12:00:00").toLocaleDateString("es-PE",{day:"2-digit",month:"short"})}catch(e){return value}}
function v412OpenTask(id){
  const t=by(state.tasks,id);if(!t?.id)return;
  const checklist=Array.isArray(t.checklist)?t.checklist:(typeof t.checklist==="string"?(()=>{try{return JSON.parse(t.checklist)}catch(e){return []}})():[]);
  const history=(state.approval_history||[]).filter(h=>h.task_id===t.id).sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||""))).slice(0,8);
  const status=v412StatusKey(t.status),done=v412TaskDone(t),observed=status==="observado"||t.approval_status==="observado";
  const steps=[
    ["Asignada",true],["En ejecución",!["pendiente"].includes(status)],["Revisión",["en_revision","observado","corregido","aprobado","publicado"].includes(status)],["Aprobada",done]
  ];
  const body=`<div class="v412-task-detail"><div class="v413-workflow">${steps.map((x,i)=>`<div class="v413-workflow-step ${x[1]?'done':(!steps.slice(0,i).some(y=>!y[1])?'current':'')}"><strong>${esc(x[0])}</strong></div>`).join("")}</div><div class="v412-task-detail-grid"><div class="v412-task-detail-box"><span>Estado operativo</span><strong>${esc(t.status||"pendiente")}</strong></div><div class="v412-task-detail-box"><span>Aprobación</span><strong>${esc(t.approval_status||"Sin enviar")}</strong></div><div class="v412-task-detail-box"><span>Responsable</span><strong>${esc(memberName(t.assigned_to))}</strong></div><div class="v412-task-detail-box"><span>Prioridad</span><strong>${esc(t.priority||"media")}</strong></div><div class="v412-task-detail-box"><span>Entrega</span><strong>${esc(t.due_date||"Sin fecha")} ${esc(t.due_time||"")}</strong></div><div class="v412-task-detail-box"><span>Proyecto / campaña</span><strong>${esc(nameOf(state.campaigns,t.campaign_id)||"Sin campaña")}</strong></div></div><div class="v412-task-detail-box"><span>Descripción</span><p>${esc(t.description||"Sin descripción")}</p></div>${checklist.length?`<div class="v412-task-detail-box"><span>Checklist</span><ul>${checklist.map(x=>`<li>${esc(typeof x==="string"?x:(x.title||x.text||"Elemento"))}</li>`).join("")}</ul></div>`:""}${t.evidence_url?`<div class="v413-evidence-link"><div><span class="small">EVIDENCIA REGISTRADA</span><br><strong>${esc(t.evidence_url)}</strong></div><a class="ghost" href="${esc(t.evidence_url)}" target="_blank" rel="noopener">Abrir</a></div>`:`<div class="v412-task-detail-box"><span>Evidencia</span><p>Todavía no se registró un enlace de entrega.</p></div>`}${v415LinkedAssetsMarkup(t.id)}${history.length?`<div class="v412-task-detail-box"><span>Historial de revisión</span><div class="v413-history">${history.map(h=>`<div class="v413-history-row"><i class="v413-history-dot"></i><div><strong>${esc(h.actor_role||memberName(h.actor_id)||"Revisión")} · ${esc(h.decision||h.new_status||"")}</strong><p>${esc(h.comment||"")}</p><time>${h.created_at?new Date(h.created_at).toLocaleString("es-PE"):""}</time></div></div>`).join("")}</div></div>`:""}<div class="v413-detail-actions">${!done?`<button class="ghost" type="button" onclick="closePremiumModal();v413PrepareTaskUpdate('${t.id}')">Actualizar progreso</button>`:""}${!done&&t.assigned_to===member.id?`<button class="primary" type="button" onclick="closePremiumModal();v413DeliverTask('${t.id}')">Entregar enlace</button><button class="ghost" type="button" onclick="closePremiumModal();v415PrepareAssetForTask('${t.id}')">Adjuntar archivo</button>`:""}${["en_revision","corregido"].includes(status)?`<button class="ghost" type="button" onclick="closePremiumModal();reviewTask('${t.id}','validate')">Validar</button><button class="ghost" type="button" onclick="closePremiumModal();reviewTask('${t.id}','observe')">Observar</button>`:""}${observed&&t.assigned_to===member.id?`<button class="primary" type="button" onclick="closePremiumModal();v413PrepareTaskUpdate('${t.id}','corregido')">Corregir entrega</button>`:""}</div></div>`;
  openPremiumModal({title:t.title||"Detalle de tarea",subtitle:`${memberName(t.assigned_to)} · ${nameOf(state.clients,t.client_id)||"Sin cliente"}`,icon:"✓",body,actions:[{label:"Cerrar",value:true,className:"ghost"}]});
}
function v412BindTaskBoard(){const board=$("taskKanban");if(board&&board.dataset.v412Bound!=="1"){board.dataset.v412Bound="1";board.addEventListener("click",e=>{const card=e.target.closest("[data-task-id]");if(card)v412OpenTask(card.dataset.taskId)})}const fields={v412TaskSearch:"search",v412TaskAssignee:"assignee",v412TaskPriority:"priority",v412TaskScope:"scope"};Object.entries(fields).forEach(([id,key])=>{const el=$(id);if(!el||el.dataset.v412Bound==="1")return;el.dataset.v412Bound="1";const event=el.tagName==="INPUT"?"input":"change";el.addEventListener(event,()=>{v412TaskView[key]=el.value;renderTasks()})});const clear=$("v412ClearTaskFilters");if(clear&&clear.dataset.v412Bound!=="1"){clear.dataset.v412Bound="1";clear.addEventListener("click",()=>{Object.assign(v412TaskView,{search:"",assignee:"",priority:"",scope:"all"});["v412TaskSearch","v412TaskAssignee","v412TaskPriority"].forEach(id=>{if($(id))$(id).value=""});if($("v412TaskScope"))$("v412TaskScope").value="all";renderTasks()})}}
function v412RenderSchedule(){renderSchedulePro();renderV3591();renderV3592();renderV3593();renderV3594();if(typeof window.v412PolishOperational==="function")window.v412PolishOperational()}
function v412RenderCreative(){if(window.CreativeArenaClean&&typeof window.CreativeArenaClean.init==="function")return window.CreativeArenaClean.init();const root=document.getElementById("creativeArenaCleanRoot");if(root)root.innerHTML="<div class=\"panel\"><h3>Creative Arena</h3><p class=\"small\">El modulo creativo no pudo iniciar.</p></div>"}
function v412RenderSection(id){const map={home:()=>renderHome(),myday:()=>renderMyDay(),tasks:()=>renderTasks(),requests360:()=>window.INBESTIGA_REQUESTS_360?.render?.(),campaigns:()=>renderCampaigns(),editorial:()=>renderEditorial(),calendarOps:()=>v416RenderCalendar(),wall:()=>renderWall(),messages:()=>{renderMessages();renderConversationList()},profile:()=>renderProfile(),team:()=>renderTeam(),reports:()=>renderReports(),search:()=>renderSearch(),notifications:()=>renderNotifications(),approvals:()=>renderApprovals(),workload:()=>renderWorkload(),schedulePro:()=>v412RenderSchedule(),workIntel:()=>renderV356(),creativeRoomsClean:()=>v412RenderCreative(),hub:()=>renderHub(),assets:()=>renderAssets(),templates:()=>renderTemplates(),incidents:()=>renderIncidents(),admin:()=>renderAdmin(),control:()=>renderControl(),performance:()=>renderPerformance(),automations:()=>v416RenderAutomations(),governance:()=>v417RenderGovernance(),auditpro:()=>renderAuditPro(),permissions:()=>renderPermissions(),memberProfile:()=>renderMemberProfile(),socialTrash:()=>renderSocialTrash(),live:()=>{renderPresence();renderLiveFeed()}};const fn=map[id];if(fn)v412SafeRender(id,id,fn)}
window.addEventListener("online",()=>{v412ConnectionUI();premiumToast("Conexión restablecida","Ya puedes seguir trabajando.","success")});
window.addEventListener("offline",()=>{v412ConnectionUI();premiumToast("Sin conexión","Tus datos siguen visibles, pero no se guardarán cambios hasta recuperar internet.","warning")});

async function boot(){
  sb=createClient();
  if(!sb){v412HideBoot();show("setupScreen");return}
  show("loginScreen");
  try{
    const {data,error}=await sb.auth.getSession();
    if(error)throw error;
    if(data.session){session=data.session;authUser=data.session.user;await enterApp()}
  }catch(err){
    v412HideBoot();
    $("loginMsg").textContent="No se pudo verificar la sesión: "+v412Message(err);
  }
}
async function enterApp(){
  v412SetBoot("Preparando tu espacio de trabajo","Verificando tus datos reales en Supabase.",12,"Sesión verificada");
  try{
    v414PerfStart("loadAll");
    await loadAll();
    v414PerfEnd("loadAll");
    if(!member?.id)throw new Error("Usuario no vinculado en marketing_app.members");
    v412SetBoot("Cargando INBESTIGA","Miembros, tareas y preferencias listos.",38,"Datos cargados");
    $("userPill").textContent=`${member.full_name} · ${member.role_code}`;
    show("appScreen");
    window.dispatchEvent(new CustomEvent("inbestiga:session-ready",{detail:{memberId:member.id||null}}));
    window.INBESTIGA_SAKURA_LOADER?.attach?.();
    window.INBESTIGA_SAKURA_POST_LOGIN_ORB?.reveal?.();
    window.INBESTIGA_SAKURA_AFFECTIVE?.syncVisibility?.();
    requestAnimationFrame(()=>{
      window.INBESTIGA_SAKURA_LOADER?.attach?.();
      window.INBESTIGA_SAKURA_AUTHENTICATED_ORB?.mount?.();
    });
    setTimeout(()=>window.INBESTIGA_SAKURA_AUTHENTICATED_ORB?.mount?.(),220);
    v414PerfStart("renderAll");
    await renderAll();
    v414PerfEnd("renderAll");
    window.INBESTIGA_SAKURA_STATIC_ORB?.mount?.();
    window.INBESTIGA_SAKURA_LOADER?.attach?.();
    window.INBESTIGA_SAKURA_AFFECTIVE?.syncVisibility?.();
    window.dispatchEvent(new CustomEvent("inbestiga:authenticated-ui-ready",{detail:{memberId:member.id||null}}));
    v412SetBoot("Activando colaboración","Preparando navegación y actualizaciones en tiempo real.",82,"Interfaz preparada");
    v412StartRealtime();
    const start=(state.user_preferences&&state.user_preferences.default_section)||"home";
    if(start&&$(start))navTo(start);else navTo("home");
    v412ConnectionUI();
    v414PerfEnd("startup");
    v412SetBoot("Todo listo","Tu espacio de trabajo está preparado.",100,"Completado");
    requestAnimationFrame(()=>setTimeout(v412HideBoot,180));
  }catch(err){
    console.error("No se pudo abrir INBESTIGA",err);
    show("loginScreen");
    window.dispatchEvent(new CustomEvent("inbestiga:session-ended"));
    $("loginMsg").textContent="Login correcto, pero ocurrió un error al cargar la interfaz: "+v412Message(err);
    v412SetBoot("No pudimos completar la carga",v412Message(err),100,"Revisión necesaria",true);
  }
}
function v121Array(value){return Array.isArray(value)?value:[]}
function v121NormalizeState(payload){
  const merged={...state,...(payload&&typeof payload==="object"?payload:{})};
  const livePresence=v121Array(merged.live_presence).length?v121Array(merged.live_presence):v121Array(merged.presence);
  merged.live_presence=livePresence;
  merged.presence=livePresence;
  merged.messages=v121Array(merged.messages).map(message=>{
    const recipientId=message.recipient_id??message.receiver_id??null;
    return {...message,recipient_id:recipientId,receiver_id:recipientId};
  });
  merged.notifications=v121Array(merged.notifications).map(notification=>{
    const recipientId=notification.recipient_id??notification.receiver_id??null;
    return {...notification,recipient_id:recipientId,receiver_id:recipientId};
  });
  ["clients","areas","members","campaigns","briefs","tasks","editorial","posts","comments","reactions","assets","roles","settings","approval_history","client_errors","report_snapshots","role_permissions","live_events","member_work_profiles","member_time_events","member_work_links","member_schedule_blocks","member_schedule_exceptions","member_schedule_grid_slots","member_schedule_submissions","schedule_email_logs","cr_rooms","cr_items"].forEach(key=>{if(!Array.isArray(merged[key]))merged[key]=[]});
  merged.role_permissions=merged.role_permissions.map(rule=>{const code=String(rule?.permission_code||[rule?.module,rule?.action].filter(Boolean).join("."));const split=code.split(".");return {...rule,permission_code:code,module:rule?.module||split[0]||"",action:rule?.action||split.slice(1).join(".")||""}});
  if(!Array.isArray(merged.member_permissions))merged.member_permissions=[];
  if(!Array.isArray(merged.effective_permissions))merged.effective_permissions=[];
  return merged;
}
async function loadAll(){
  const {data,error}=await sb.rpc("ibm_v375_bootstrap");
  if(error)throw error;
  state=v121NormalizeState(data||{});
  member=state.member||member;
  return state;
}
function fillSelects(){
  const clients=(state.clients||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("");
  const areas=(state.areas||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("");
  const campaigns='<option value="">Sin campaña</option>'+(state.campaigns||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("");
  const members=(state.members||[]).filter(x=>x.status!=="inactive").map(x=>`<option value="${x.id}">${esc(x.full_name)} · ${esc(x.role_code)}</option>`).join("");
  const roleMap=new Map();
  (state.roles||[]).forEach(role=>{const code=String(role.code||role.role_code||role.slug||role.id||"").trim();if(code)roleMap.set(code,role.label||role.name||role.title||code)});
  (state.members||[]).forEach(person=>{const code=String(person.role_code||"").trim();if(code&&!roleMap.has(code))roleMap.set(code,person.position||code)});
  if(!roleMap.size)roleMap.set("member","Miembro");
  const roleOptions=[...roleMap.entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1]),"es")).map(([code,label])=>`<option value="${esc(code)}">${esc(label)} · ${esc(code)}</option>`).join("");
  ["adminUserRole","permRole"].forEach(id=>{const el=$(id);if(!el)return;const previous=el.value;el.innerHTML=roleOptions;if(roleMap.has(previous))el.value=previous});
  const otherMembers=(state.members||[]).filter(x=>x.id!==member.id && x.status!=="inactive");
  const recipients=otherMembers.length?'<option value="">Selecciona destinatario</option>'+otherMembers.map(x=>`<option value="${x.id}">${esc(x.full_name)} · ${esc(x.role_code)}</option>`).join(""):'<option value="">No hay otro usuario registrado</option>';
  ["taskClient","campaignClient","edClient"].forEach(id=>safeOptions(id,clients));
  ["taskArea","campaignArea"].forEach(id=>safeOptions(id,areas));
  ["taskCampaign","briefCampaign","edCampaign"].forEach(id=>safeOptions(id,campaigns));
  ["taskAssignee","edOwner"].forEach(id=>safeOptions(id,members));
  safeOptions("msgTo",recipients);["boardClient","assetClient","incidentClient"].forEach(id=>safeOptions(id,clients));["boardCampaign","assetCampaign","incidentCampaign"].forEach(id=>safeOptions(id,campaigns));safeOptions("incidentAssignee",members);safeOptions("assetTask",'<option value="">Sin tarea</option>'+(state.tasks||[]).map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join(""));
  safeOptions("updateTaskId",(state.tasks||[]).map(x=>`<option value="${x.id}">${esc(x.title)}</option>`).join(""));
}
async function renderAll(){
  const cycle=++v412RenderCycle;
  fillSelects();
  v412SetBoot("Construyendo el panel","Priorizando Inicio, Tareas, Muro y Perfil 360.",48,"Render esencial");
  await v412SafeRender("home","Inicio",()=>renderHome());
  await v412SafeRender("tasks","Tareas",()=>renderTasks());
  await v412SafeRender("wall","Muro",()=>renderWall());
  await v412SafeRender("profile","Perfil 360",()=>renderProfile());
  await v412SafeRender("messages","Mensajes",()=>renderMessages());
  await v412SafeRender("workIntel","Trabajo 360",()=>renderV356());
  try{updateBadges();applyRoleNavigation();applyVisualPermissions();renderNavPreferences();renderHomeFeedPreferences();v415AfterRender()}catch(err){console.warn("Preferencias visuales",err)}
  if($("settingsUrl"))$("settingsUrl").textContent=cfg().managed?"Conexión automática activa":"Configuración de respaldo";
  v412SetBoot("Finalizando","Los módulos principales ya están disponibles.",72,"Carga progresiva");
  v412Idle(()=>{
    if(cycle!==v412RenderCycle)return;
    [["campaigns","Campañas",renderCampaigns],["editorial","Editorial",renderEditorial],["team","Equipo",renderTeam],["reports","Reportes",renderReports],["calendarOps","Calendario",v416RenderCalendar],["automations","Automatizaciones",v416RenderAutomations],["socialTrash","Basurero",renderSocialTrash]].forEach(([section,label,fn])=>v412SafeRender(section,label,fn));
  });
}
function parseTaskChecklist(value){return String(value||"").split(/\r?\n|,/).map(item=>item.trim()).filter(Boolean)}
async function saveTask(e){e.preventDefault();try{const {error}=await sb.rpc("ibm_v30_create_task",{p_title:safeVal("taskTitle"),p_description:safeVal("taskDescription"),p_assigned_to:safeVal("taskAssignee")||null,p_client_id:safeVal("taskClient")||null,p_area_id:safeVal("taskArea")||null,p_campaign_id:safeVal("taskCampaign")||null,p_due_date:safeVal("taskDue")||null,p_due_time:safeVal("taskTime")||null,p_priority:safeVal("taskPriority"),p_impact:Number(safeVal("taskImpact")||3),p_checklist:parseTaskChecklist(safeVal("taskChecklist"))});if(error)throw error;e.target.reset();toast("Tarea creada");await loadAll();await renderAll()}catch(err){toast("No se pudo crear tarea",err.message)}}
async function updateTask(e){e.preventDefault();try{const q=safeVal("updateQuality");const {error}=await sb.rpc("ibm_v30_update_task",{p_task_id:safeVal("updateTaskId"),p_status:safeVal("updateTaskStatus"),p_evidence_url:safeVal("updateEvidence"),p_quality:q?Number(q):null,p_comment:safeVal("updateComment")});if(error)throw error;e.target.reset();toast("Tarea actualizada");await loadAll();await renderAll()}catch(err){toast("No se pudo actualizar",err.message)}}
function renderTasks(){
  const board=$("taskKanban");if(!board)return;
  const all=state.tasks||[];
  const assignee=$("v412TaskAssignee");
  if(assignee){const previous=v412TaskView.assignee||assignee.value;assignee.innerHTML='<option value="">Todos</option>'+(state.members||[]).filter(m=>m.status!=="inactive").map(m=>`<option value="${m.id}">${esc(m.full_name)}</option>`).join("");assignee.value=previous}
  if($("v412TaskSearch"))$("v412TaskSearch").value=v412TaskView.search;
  if($("v412TaskPriority"))$("v412TaskPriority").value=v412TaskView.priority;
  if($("v412TaskScope"))$("v412TaskScope").value=v412TaskView.scope;
  const query=v412TaskView.search.toLowerCase().trim();
  const visible=all.filter(t=>{
    if(query&&!`${t.title||""} ${t.description||""} ${memberName(t.assigned_to)} ${nameOf(state.clients,t.client_id)} ${nameOf(state.campaigns,t.campaign_id)}`.toLowerCase().includes(query))return false;
    if(v412TaskView.assignee&&t.assigned_to!==v412TaskView.assignee)return false;
    if(v412TaskView.priority&&String(t.priority||"").toLowerCase()!==v412TaskView.priority)return false;
    if(v412TaskView.scope==="mine"&&t.assigned_to!==member.id)return false;
    if(v412TaskView.scope==="late"&&!v412TaskOverdue(t))return false;
    if(v412TaskView.scope==="today"&&!v412TaskDueToday(t))return false;
    if(v412TaskView.scope==="review"&&!v412TaskAwaitingReview(t))return false;
    return true;
  });
  const open=all.filter(t=>!v412TaskDone(t));
  const actionable=open.filter(v412TaskNeedsAction);
  const late=actionable.filter(t=>v412TaskOverdue(t));
  const mine=actionable.filter(t=>t.assigned_to===member.id);
  const mineCurrent=mine.filter(t=>!v412TaskOverdue(t));
  const review=all.filter(v412TaskAwaitingReview);
  const evidence=all.filter(t=>!!t.evidence_url);
  const metrics=[["Abiertas",open.length],["Mis tareas",mine.length],["Vencidas",late.length],["En revisión",review.length],["Con evidencia",evidence.length]];
  if($("v412TaskMetrics"))$("v412TaskMetrics").innerHTML=metrics.map(m=>`<div class="v412-task-metric"><span>${m[0]}</span><strong>${m[1]}</strong></div>`).join("");
  const queueData=[
    ["Mi trabajo",mineCurrent.sort((a,b)=>(a.due_date||"9999").localeCompare(b.due_date||"9999")).slice(0,4),"mine"],
    ["En riesgo",late.sort((a,b)=>(a.due_date||"").localeCompare(b.due_date||"")).slice(0,4),"late"],
    ["Para revisar",review.slice(0,4),"review"]
  ];
  if($("v413TaskQueues"))$("v413TaskQueues").innerHTML=queueData.map(([title,items,scope])=>`<div class="v413-queue-card"><div class="v413-queue-head"><div><span class="v413-eyebrow">COLA OPERATIVA</span><h3>${title}</h3></div><span class="v413-count">${items.length}</span></div><div class="v413-mini-list">${items.length?items.map(t=>`<div class="v413-mini-item" data-task-id="${esc(t.id)}"><div><strong>${esc(t.title)}</strong><span>${esc(memberName(t.assigned_to))} · ${esc(nameOf(state.campaigns,t.campaign_id)||nameOf(state.clients,t.client_id)||"Sin proyecto")}</span></div><span>${esc(v412DateLabel(t.due_date))}</span></div>`).join(""):`<div class="v413-empty">Sin elementos críticos</div>`}</div><button type="button" class="ghost" style="margin-top:10px" onclick="v413SetTaskScope('${scope}')">Ver cola</button></div>`).join("");
  const columns=[{title:"Pendiente",keys:["pendiente"]},{title:"En ejecución",keys:["en_proceso","observado"]},{title:"Revisión",keys:["en_revision","corregido"]},{title:"Completado",keys:["aprobado","publicado","completado","finalizado","done","hecho"]}];
  const card=t=>{const lateTask=v412TaskOverdue(t),reviewTask=v412TaskAwaitingReview(t),priority=String(t.priority||"media").toLowerCase(),datePrefix=lateTask?"Vencida · ":reviewTask?"En revisión · ":"";return `<article class="v412-task-card ${lateTask?"overdue":reviewTask?"review":""}" data-task-id="${esc(t.id)}"><div class="v412-task-top"><span class="v412-priority ${esc(priority)}">${esc(priority)}</span><span class="v412-task-date">${datePrefix}${esc(v412DateLabel(t.due_date))}</span></div><h5>${esc(t.title||"Tarea")}</h5><p>${esc(memberName(t.assigned_to))}</p><p>${esc(nameOf(state.campaigns,t.campaign_id)||nameOf(state.clients,t.client_id)||"Sin proyecto")}</p><div class="v412-task-progress"><i style="width:${v412TaskProgress(t)}%"></i></div><div class="v412-task-foot"><span class="small">${esc(v66StatusLabel(t.status||"pendiente"))}</span><strong class="small">${t.evidence_url?"Evidencia ✓":`${Number(t.impact)||3}/5`}</strong></div></article>`};
  board.innerHTML=columns.map(col=>{const items=visible.filter(t=>col.keys.includes(v412StatusKey(t.status)));return `<div class="col"><div class="v412-column-title"><h4>${col.title}</h4><span>${items.length}</span></div>${items.map(card).join("")||'<div class="v412-empty">Sin tareas</div>'}</div>`}).join("");
  v412BindTaskBoard();v413BindDynamicTaskCards();v413RenderTaskCommand();
}

async function saveCampaign(e){e.preventDefault();try{const {error}=await sb.rpc("ibm_v30_create_campaign",{p_name:safeVal("campaignName"),p_client_id:safeVal("campaignClient")||null,p_area_id:safeVal("campaignArea")||null,p_status:safeVal("campaignStatus"),p_start_date:safeVal("campaignStart")||null,p_end_date:safeVal("campaignEnd")||null,p_objective:safeVal("campaignObjective"),p_audience:safeVal("campaignAudience"),p_main_message:safeVal("campaignMessage")});if(error)throw error;e.target.reset();toast("Campaña creada");await loadAll();await renderAll()}catch(err){toast("No se pudo crear campaña",err.message)}}
async function saveBrief(e){e.preventDefault();try{const {error}=await sb.rpc("ibm_v30_create_brief",{p_campaign_id:safeVal("briefCampaign")||null,p_title:safeVal("briefTitle"),p_objective:safeVal("briefObjective"),p_audience:safeVal("briefAudience"),p_formats:safeVal("briefFormats"),p_references_text:safeVal("briefRefs"),p_brand_rules:safeVal("briefRules"),p_deliverables:safeVal("briefDeliverables")});if(error)throw error;e.target.reset();toast("Brief creado");await loadAll();await renderAll()}catch(err){toast("No se pudo crear brief",err.message)}}
function renderCampaigns(){
  const campaigns=state.campaigns||[],tasks=state.tasks||[],briefs=state.briefs||[],editorial=state.editorial||[],assets=state.assets||[];
  const summaries=campaigns.map(c=>{
    const ct=tasks.filter(t=>t.campaign_id===c.id),done=ct.filter(v412TaskDone),late=ct.filter(t=>v412TaskOverdue(t));
    const progress=ct.length?Math.round(done.length*100/ct.length):0;
    const hasBrief=briefs.some(b=>b.campaign_id===c.id),pubs=editorial.filter(e=>e.campaign_id===c.id),files=assets.filter(a=>a.campaign_id===c.id);
    const risk=late.length>0||(!v412TaskDone({status:c.status})&&c.end_date&&c.end_date<today());
    return {c,ct,done,late,progress,hasBrief,pubs,files,risk};
  }).sort((a,b)=>Number(b.risk)-Number(a.risk)||String(b.c.updated_at||b.c.created_at||"").localeCompare(String(a.c.updated_at||a.c.created_at||"")));
  const active=summaries.filter(x=>!["finalizada","archivada","completada"].includes(v412StatusKey(x.c.status))),risk=summaries.filter(x=>x.risk),withoutBrief=summaries.filter(x=>!x.hasBrief),overallTasks=summaries.reduce((a,x)=>a+x.ct.length,0);
  if($("v413Portfolio"))$("v413Portfolio").innerHTML=`<div class="v413-portfolio-head"><div><span class="v413-eyebrow">PORTAFOLIO OPERATIVO</span><h2>Proyectos y campañas</h2><p class="small">Cada campaña reúne tareas, brief, publicaciones y entregables reales.</p></div><button type="button" class="primary" onclick="v413ShowCampaignForms()">Crear proyecto</button></div><div class="v413-portfolio-metrics"><div class="v413-portfolio-metric"><span>Activos</span><strong>${active.length}</strong></div><div class="v413-portfolio-metric"><span>En riesgo</span><strong>${risk.length}</strong></div><div class="v413-portfolio-metric"><span>Sin brief</span><strong>${withoutBrief.length}</strong></div><div class="v413-portfolio-metric"><span>Tareas vinculadas</span><strong>${overallTasks}</strong></div></div><div class="v413-portfolio-grid">${summaries.length?summaries.map(x=>`<article class="v413-portfolio-card ${x.risk?'risk':''}" data-campaign-id="${esc(x.c.id)}"><div class="v413-card-top"><div><span class="v413-eyebrow">${esc(nameOf(state.clients,x.c.client_id)||"SIN CLIENTE")}</span><h3>${esc(x.c.name||"Campaña")}</h3><span class="v413-project-meta">${esc(x.c.status||"planificación")} · ${esc(x.c.start_date||"Sin inicio")} — ${esc(x.c.end_date||"Sin cierre")}</span></div><span class="status ${x.risk?'red':'green'}">${x.risk?'En riesgo':'En curso'}</span></div><div class="v413-project-stats"><div class="v413-project-stat"><span>Tareas</span><strong>${x.ct.length}</strong></div><div class="v413-project-stat"><span>Entregadas</span><strong>${x.done.length}</strong></div><div class="v413-project-stat"><span>Editorial</span><strong>${x.pubs.length}</strong></div></div><div class="v413-progress"><i style="width:${x.progress}%"></i></div><div class="v413-project-foot"><span>${x.progress}% de avance</span><span>${x.hasBrief?'Brief ✓':'Brief pendiente'} · ${x.files.length} archivos</span></div></article>`).join(""):`<div class="v413-empty">Todavía no existen campañas.</div>`}</div>`;
  if($("campaignList"))$("campaignList").innerHTML=`<div class="table-wrap"><table class="table"><thead><tr><th>Campaña</th><th>Cliente</th><th>Estado</th><th>Avance</th><th>Riesgo</th></tr></thead><tbody>${summaries.map(x=>`<tr><td><strong>${esc(x.c.name)}</strong><br><span class="small">${esc(x.c.objective||"")}</span></td><td>${esc(nameOf(state.clients,x.c.client_id))}</td><td>${esc(x.c.status)}</td><td>${x.progress}% (${x.done.length}/${x.ct.length})</td><td><span class="status ${x.risk?'red':'green'}">${x.risk?`${x.late.length} vencidas`:'Controlado'}</span></td></tr>`).join("")}</tbody></table></div>`;
  document.querySelectorAll("[data-campaign-id]").forEach(el=>el.onclick=()=>v413OpenCampaign(el.dataset.campaignId));
}
async function saveEditorial(e){e.preventDefault();try{const {error}=await sb.rpc("ibm_v30_create_editorial",{p_title:safeVal("edTitle"),p_client_id:safeVal("edClient")||null,p_campaign_id:safeVal("edCampaign")||null,p_platform:safeVal("edPlatform"),p_format:safeVal("edFormat"),p_copy_text:safeVal("edCopy"),p_asset_url:safeVal("edAsset"),p_publish_date:safeVal("edDate")||null,p_publish_time:safeVal("edTime")||null,p_status:safeVal("edStatus"),p_owner_id:safeVal("edOwner")||null});if(error)throw error;e.target.reset();toast("Editorial guardado");await loadAll();await renderAll()}catch(err){toast("No se pudo guardar editorial",err.message)}}
function renderEditorial(){
  $("editorialList").innerHTML=`<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Contenido</th><th>Plataforma</th><th>Responsable</th><th>Estado</th></tr></thead><tbody>${(state.editorial||[]).map(e=>`<tr><td>${esc(e.publish_date||"")} ${esc(e.publish_time||"")}</td><td><strong>${esc(e.title)}</strong><br><span class="small">${esc(e.copy_text||"")}</span></td><td>${esc(e.platform)} · ${esc(e.format)}</td><td>${esc(memberName(e.owner_id))}</td><td>${esc(e.status)}</td></tr>`).join("")}</tbody></table></div>`;
}
async function imageToDataUrl(file,maxSide=1300,quality=.78){
  if(!file)return ""; if(!file.type.startsWith("image/"))throw new Error("El archivo debe ser una imagen.");
  return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{try{let w=img.width,h=img.height,scale=Math.min(1,maxSide/Math.max(w,h));w=Math.round(w*scale);h=Math.round(h*scale);const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);const data=c.toDataURL("image/jpeg",quality);URL.revokeObjectURL(url);if(data.length>1200000)return reject(new Error("La imagen es muy pesada. Usa una más ligera."));resolve(data)}catch(e){URL.revokeObjectURL(url);reject(e)}};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("No se pudo leer la imagen."))};img.src=url})}
function imgSrc(v){return v&&String(v).startsWith("data:image/")?v:""}
function profileImg(user,kind){if(!user)return "";return kind==="avatar"?(user.avatar_data_url||imgSrc(user.avatar_url)):(user.cover_data_url||imgSrc(user.cover_url))}
async function avatarHtml(userId,cls="avatar"){const u=by(state.members,userId);const src=profileImg(u,"avatar");return `<div class="${cls}" style="background:${esc(u.profile_color||'#6e26f6')}">${src?`<img src="${src}">`:esc(initials(u.full_name))}</div>`}
function v411Clamp(value,min=0,max=100){return Math.max(min,Math.min(max,Number(value)||0))}
function v411Status(value){return String(value||"").trim().toLowerCase().replaceAll(" ","_")}
function v411Done(task){return ["aprobado","publicado","completado","completada","finalizado","finalizada","done","hecho"].includes(v411Status(task?.status))}
function v411Late(task){return typeof v412TaskOverdue==="function"?v412TaskOverdue(task):!!(task?.due_date&&task.due_date<today()&&!v411Done(task))}
function v411Member(id){return by(state.members,id)||((member&&member.id===id)?member:{})}
function v411MemberPosts(id){return (typeof activePosts==="function"?activePosts():(state.posts||[])).filter(p=>p.author_id===id||p.member_id===id||p.created_by===id||p.user_id===id)}
function v411MemberComments(id){return (state.comments||[]).filter(c=>(c.author_id||c.member_id||c.created_by||c.user_id)===id)}
function v411MemberMessages(id){return (state.messages||[]).filter(m=>m.sender_id===id)}
function getMemberPerformance(memberId){
  const tasks=(state.tasks||[]).filter(t=>t.assigned_to===memberId);
  const done=tasks.filter(v411Done);
  const late=tasks.filter(v411Late);
  const open=tasks.filter(t=>!v411Done(t));
  const posts=v411MemberPosts(memberId);
  const comments=v411MemberComments(memberId);
  const messages=v411MemberMessages(memberId);
  const total=tasks.length;
  const progress=total?Math.round(done.length*100/total):0;
  const punctuality=total?Math.round(Math.max(0,total-late.length)*100/total):0;
  const qualityRaw=tasks.map(t=>Number(t.quality_score??t.quality??t.score_quality)).filter(n=>Number.isFinite(n)&&n>0);
  let quality=0;
  if(qualityRaw.length){
    const avg=qualityRaw.reduce((a,b)=>a+b,0)/qualityRaw.length;
    quality=Math.round(avg<=5?avg*20:avg<=10?avg*10:avg);
  }
  quality=v411Clamp(quality);
  const creativity=v411Clamp(posts.length*15+comments.length*4+done.length*3);
  const communication=v411Clamp(comments.length*8+messages.length*4+posts.length*4);
  const totalImpact=tasks.reduce((sum,t)=>sum+Math.max(1,Number(t.impact)||1),0);
  const doneImpact=done.reduce((sum,t)=>sum+Math.max(1,Number(t.impact)||1),0);
  const firmness=totalImpact?Math.round(doneImpact*100/totalImpact):0;
  const score360=Math.round(progress*.30+punctuality*.20+quality*.20+creativity*.10+communication*.10+firmness*.10);
  const onTime=Math.max(0,done.length-late.length);
  const xp=Math.max(0,done.length*40+onTime*20+posts.length*25+comments.length*8+messages.length*2+Math.round(quality*.5)-late.length*15);
  const level=Math.max(1,Math.floor(xp/200)+1);
  const levelProgress=Math.round((xp%200)/2);
  return {total,done:done.length,open:open.length,late:late.length,posts:posts.length,comments:comments.length,messages:messages.length,progress,punctuality,quality,creativity,communication,firmness,score360,xp,level,levelProgress};
}
function v411Rank(level){
  const tiers=[
    [1,4,"Heraldo del Núcleo"],[5,9,"Guardián de Campaña"],[10,14,"Cruzado Creativo"],[15,19,"Arconte Operativo"],
    [20,29,"Leyenda de Impacto"],[30,44,"Ancestro del Sistema"],[45,59,"Divino Estratega"],[60,79,"Inmortal de Marketing"],[80,9999,"Soberano Infinito"]
  ];
  const tier=tiers.find(t=>level>=t[0]&&level<=t[1])||tiers[0];
  const division=["I","II","III","IV","V"][Math.min(4,Math.floor(((level-tier[0])/Math.max(1,tier[1]-tier[0]+1))*5))];
  return `${tier[2]} ${division}`;
}
function v411Polar(cx,cy,r,deg){const a=(deg-90)*Math.PI/180;return{x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)}}
function v411RadarSvg(metrics,accent,secondary,uid){
  const axes=[["progress","Avance"],["quality","Calidad"],["punctuality","Puntualidad"],["creativity","Creatividad"],["communication","Comunicación"],["firmness","Firmeza"]];
  const cx=180,cy=180,r=112,id=`v411Radar_${String(uid).replace(/[^a-z0-9]/gi,"")}`;
  const points=(radius,useValues)=>axes.map((axis,index)=>{const value=useValues?v411Clamp(metrics[axis[0]])/100:1;const p=v411Polar(cx,cy,radius*value,index*60);return `${p.x.toFixed(1)},${p.y.toFixed(1)}`}).join(" ");
  const grids=[28,56,84,112].map(radius=>`<polygon points="${points(radius,false)}" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="1"/>`).join("");
  const lines=axes.map((axis,index)=>{const p=v411Polar(cx,cy,r,index*60);return `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="rgba(255,255,255,.13)"/>`}).join("");
  const labels=axes.map((axis,index)=>{const p=v411Polar(cx,cy,r+34,index*60);let anchor="middle";if(p.x<cx-8)anchor="end";if(p.x>cx+8)anchor="start";return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="${anchor}" fill="rgba(255,255,255,.80)" font-size="10.5" font-weight="800">${esc(axis[1])}</text>`}).join("");
  const dots=axes.map((axis,index)=>{const p=v411Polar(cx,cy,r*(v411Clamp(metrics[axis[0]])/100),index*60);return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#ffffff" stroke="${esc(accent)}" stroke-width="2"/>`}).join("");
  return `<svg viewBox="0 0 360 360" role="img" aria-label="Radar integrado del Perfil 360"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${esc(accent)}" stop-opacity=".72"/><stop offset="1" stop-color="${esc(secondary)}" stop-opacity=".42"/></linearGradient></defs>${grids}${lines}<polygon points="${points(r,true)}" fill="url(#${id})" stroke="rgba(255,255,255,.92)" stroke-width="3" stroke-linejoin="round"/>${dots}${labels}</svg>`;
}
function v411Metric(label,value,sub=""){return `<div class="v411-kpi"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub?`<small>${esc(sub)}</small>`:""}</div>`}
function v411Bar(label,value){value=v411Clamp(value);return `<div class="v411-bar"><div><span>${esc(label)}</span><strong>${value}%</strong></div><i><b style="width:${value}%"></b></i></div>`}
function renderProfileCard360(memberId,options={}){
  const user=v411Member(memberId);
  if(!user?.id)return `<div class="v411-empty">Perfil no disponible.</div>`;
  const metrics=getMemberPerformance(user.id),prefs=v418Normalize(options.preferences||v418Current(user.id),user),theme=v418ThemeFor(prefs);
  const accent=prefs.accent_color||theme.accent,secondary=prefs.secondary_color||theme.secondary;
  const avatar=profileImg(user,"avatar")||profileSrc?.(user,"avatar")||"",cover=profileImg(user,"cover")||profileSrc?.(user,"cover")||"",rank=v411Rank(metrics.level),context=options.context||"wall";
  let actions="";
  if(context==="wall")actions=`<button class="primary" onclick="navTo('workIntel')">Trabajo 360</button><button class="ghost" onclick="v418OpenCustomizer()">Personalizar</button>`;
  if(context==="work")actions=`<button class="primary" onclick="openMemberProfile('${user.id}')">Ver muro</button><button class="ghost" onclick="messageMember('${user.id}')">Mensaje</button>`;
  if(context==="member")actions=`<button class="primary" onclick="messageMember('${user.id}')">Enviar mensaje</button><button class="ghost" onclick="navTo('workIntel')">Trabajo 360</button>`;
  if(context==="editor")actions=`<button class="primary" onclick="v418OpenCustomizer()">Estudio visual</button><button class="ghost" onclick="navTo('wall')">Ver Muro</button>`;
  const portrait=avatar?`<img src="${esc(avatar)}" alt="Foto de ${esc(user.full_name||"miembro")}">`:`<div class="v411-initials">${esc(initials(user.full_name))}</div>`;
  const coverStyle=cover?`background-image:linear-gradient(180deg,rgba(5,8,14,.02),rgba(5,8,14,.84)),url('${esc(cover)}')`:`background-image:radial-gradient(circle at 18% 0%,${esc(accent)}aa,transparent 38%),radial-gradient(circle at 85% 15%,${esc(secondary)}88,transparent 34%),linear-gradient(135deg,${theme.bg},${theme.solid})`;
  const axes=[['progress','Avance','↗'],['quality','Calidad','◆'],['punctuality','Puntualidad','◷'],['creativity','Creatividad','✦'],['communication','Comunicación','◎'],['firmness','Firmeza','⬢']].sort((a,b)=>Number(metrics[b[0]]||0)-Number(metrics[a[0]]||0)).slice(0,3);
  const badges=[metrics.punctuality>=85?['◷','Puntual']:null,metrics.quality>=85?['◆','Calidad']:null,metrics.posts>=3?['✦','Creador']:null,metrics.comments>=5?['◎','Colaborador']:null,metrics.late===0?['✓','Sin retrasos']:null].filter(Boolean).slice(0,4);
  const radar=prefs.show_radar?`<div class="v418-profile-panel"><h4>Radar Hex 360</h4><div class="v418-radar-wrap">${v411RadarSvg(metrics,accent,secondary,`${user.id}_${context}`)}</div></div>`:"";
  const stats=prefs.show_stats?`<div class="v418-profile-panel"><h4>Estadísticas</h4><div class="v418-kpi-grid">${v411Metric("Tareas",`${metrics.done}/${metrics.total}`,`${metrics.open} activas`).replace('v411-kpi','v418-kpi')}${v411Metric("Vencidas",metrics.late,"atención").replace('v411-kpi','v418-kpi')}${v411Metric("Publicaciones",metrics.posts,"muro").replace('v411-kpi','v418-kpi')}${v411Metric("Comentarios",metrics.comments,"interacción").replace('v411-kpi','v418-kpi')}</div></div>`:"";
  const strengths=prefs.show_strengths?`<div class="v418-profile-panel"><h4>Fortalezas principales</h4><div class="v418-strengths">${axes.map(a=>`<div class="v418-strength"><i>${a[2]}</i><b>${a[1]}</b><span>${Math.round(metrics[a[0]]||0)}%</span></div>`).join("")}</div></div>`:"";
  const activity=prefs.show_activity?`<div class="v418-profile-panel"><h4>Actividad visible</h4><div class="v418-activity-strip"><div><strong>${metrics.open}</strong><span>activas</span></div><div><strong>${metrics.posts}</strong><span>posts</span></div><div><strong>${metrics.comments}</strong><span>comentarios</span></div></div></div>`:"";
  const badgeMarkup=prefs.show_badges&&badges.length?`<div class="v418-profile-panel"><h4>Insignias</h4><div class="v418-badges">${badges.map(b=>`<span class="v418-badge"><i>${b[0]}</i>${b[1]}</span>`).join("")}</div></div>`:"";
  const quote=user.favorite_quote?`<div class="v418-quote">“${esc(user.favorite_quote)}”</div>`:"";
  return `<article class="v418-profile-card" data-card="${esc(prefs.card_style)}" data-density="${esc(prefs.density)}" style="--card-accent:${esc(accent)};--card-secondary:${esc(secondary)};--card-text:${esc(prefs.text_color||theme.text)};--card-muted:${esc(theme.muted)};--v418-accent:${esc(accent)};--v418-secondary:${esc(secondary)};--v418-text:${esc(prefs.text_color||theme.text)};--v418-muted:${esc(theme.muted)};--v418-bg:${esc(theme.bg)};--v418-panel:${theme.panel};--v418-panel-solid:${esc(theme.solid)};--v418-border:${theme.border}">
    <div class="v418-profile-cover" style="${coverStyle}"><div class="v418-profile-topline"><span>INBESTIGA ID · ${esc(theme.name)}</span><span>${metrics.xp} XP</span></div></div>
    <div class="v418-profile-body">
      <section class="v418-profile-identity"><div class="v418-avatar-ring">${portrait}<div class="v418-level-orb">${metrics.level}</div></div><div class="v418-identity-copy"><span class="v418-kicker">Perfil 360 personalizado</span><h2>${esc(user.full_name||"Miembro")}</h2><p>${esc(user.position||user.role_code||"Marketing")}</p><div class="v418-rank-line"><span class="v418-rank-chip">${esc(rank)}</span><span class="v418-status-chip">${esc(user.mood_status||"En progreso")}</span></div><div class="v418-xp-track"><i style="width:${metrics.levelProgress}%"></i></div>${quote}<div class="v418-profile-actions">${actions}</div></div></section>
      <section class="v418-profile-center"><div class="v418-profile-panel"><h4>Prestigio operativo</h4><div class="v418-score-ring" style="--score:${metrics.score360}"><div><strong>${metrics.score360}</strong><span>SCORE 360</span></div></div>${badgeMarkup?badgeMarkup.replace('v418-profile-panel','').replace('<h4>Insignias</h4>',''):''}</div>${activity}</section>
      <section class="v418-profile-side">${radar}${stats}${strengths}</section>
    </div>
  </article>`;
}
async function renderWall(){
  const prefs=await v418EnsurePreferences(member.id);
  v418ApplyScope("wall",prefs);v418RenderQuickThemes(prefs);
  const mount=$("wallProfile360");
  if(mount)mount.innerHTML=renderProfileCard360(member.id,{context:"wall",preferences:prefs});
  const av=profileImg(member,"avatar")||profileSrc?.(member,"avatar")||"";
  if($("composerAvatar")){$("composerAvatar").innerHTML=av?`<img src="${esc(av)}">`:esc(initials(member.full_name));$("composerAvatar").style.background=prefs.accent_color||member.profile_color||"#6e26f6"}
  const posts=(typeof activePosts==="function"?activePosts():(state.posts||[])).slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  if($("wallFeed"))$("wallFeed").innerHTML=posts.map(p=>renderSocialPost(p)).join("")||`<div class="panel v411-empty"><strong>Aún no hay publicaciones.</strong><p>Comparte la primera actualización del equipo.</p></div>`;
}

async function savePost(e){e.preventDefault();const btn=$("postBtn");try{btn.disabled=true;hideBox("postStatus");let img="";if($("postImage").files[0]){setBox("postStatus","Comprimiendo imagen...");img=await imageToDataUrl($("postImage").files[0],1200,.76)}const text=safeVal("postText").trim();if(!text&&!img)throw new Error("Escribe algo o selecciona una imagen.");setBox("postStatus","Publicando...");const {error}=await sb.rpc("ibm_v30_create_wall_post_inline",{p_text_content:text,p_image_data_url:img});if(error)throw error;$("postText").value="";$("postImage").value="";setBox("postStatus","Publicado correctamente.");toast("Publicado");await loadAll();await renderWall();renderHome()}catch(err){setBox("postStatus",err.message,"err");toast("No se pudo publicar",err.message)}finally{btn.disabled=false}}
async function comment(type,id,inputId){const val=safeVal(inputId).trim();if(!val)return;try{const {error}=await sb.rpc("ibm_v30_create_comment",{p_entity_type:type,p_entity_id:id,p_text_content:val});if(error)throw error;await loadAll();await renderWall()}catch(err){toast("No se pudo comentar",err.message)}}
async function react(type,id,reaction){try{const {error}=await sb.rpc("ibm_v30_toggle_reaction",{p_entity_type:type,p_entity_id:id,p_reaction:reaction});if(error)throw error;await loadAll();await renderWall()}catch(err){toast("No se pudo reaccionar",err.message)}}
const EMOJIS={"Frecuentes":["😀","😂","🤣","😍","🥳","😎","🤔","👏","","🔥","💯","","🚀","🎯","💡"],"Caras":["😁","😊","😇","🙂","😉","😌","🤗","🤩","😘","😭","😡","😱","😴","🤯","🥶","🥵"],"Trabajo":["📌","📣","📈","📉","⌛","🧠","📝","📅","📎","📁","🔎","","🚨","⭐","🏆","💪"],"Manos":["🙌","🙏","👌","🤝","👎","👀","","✍️","🤲","🫶","🤞","👋"],"Corazones":["❤️","🧡","💛","💚","💙","💜","🤍","🖤","🤎","💖","💘","💔"],"Celebración":["🎉","","🎊","🎁","🥇","🥈","🥉","🏅","🎬","📸","🎨","🎵"]};let emojiCat="Frecuentes";
function renderEmoji(){const tabs=$("emojiTabs"),grid=$("emojiGrid"),q=safeVal("emojiSearch").toLowerCase();tabs.innerHTML=Object.keys(EMOJIS).map(c=>`<button type="button" class="${c===emojiCat?"active":""}" onclick="emojiCat='${c}';renderEmoji()">${c}</button>`).join("");let list=Object.entries(EMOJIS).flatMap(([c,a])=>a.map(e=>({e,c})));if(!q)list=EMOJIS[emojiCat].map(e=>({e,c:emojiCat}));else list=list.filter(x=>(x.e+x.c).toLowerCase().includes(q));grid.innerHTML=list.map(x=>`<button type="button" class="emoji-chip" onclick="insertEmoji('${x.e}')">${x.e}</button>`).join("")}
function openEmoji(){renderEmoji();$("emojiPop").classList.add("open")}function closeEmoji(){$("emojiPop").classList.remove("open")}function insertEmoji(e){const t=$("msgText"),s=t.selectionStart??t.value.length,n=t.selectionEnd??t.value.length;t.value=t.value.slice(0,s)+e+t.value.slice(n);t.focus();t.selectionStart=t.selectionEnd=s+e.length;closeEmoji()}
function renderMessages(partnerId=null){
  const list=(state.messages||[]).slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  const filtered=partnerId?list.filter(m=>(m.sender_id===partnerId&&m.recipient_id===member.id)||(m.sender_id===member.id&&m.recipient_id===partnerId)):list;
  $("msgCount").textContent=`${filtered.length} mensajes`;
  $("messageList").innerHTML=filtered.map(m=>{const mine=m.sender_id===member.id;return `<div class="msg-bubble ${mine?"msg-out":"msg-in"}">${m.is_urgent?`<div class="msg-urgent"> Zumbido</div>`:""}<div>${esc(m.text_content)}</div><div class="msg-meta">${mine?"Tú":esc(memberName(m.sender_id))} · ${new Date(m.created_at).toLocaleString("es-PE")} ${m.read_at?"· leído":""}</div></div>`}).join("")||"<p>Sin mensajes.</p>";
  $("messageList").scrollTop=$("messageList").scrollHeight;
  renderConversationList();
}
async function saveMessage(e){e.preventDefault();const btn=$("sendMsgBtn");try{btn.disabled=true;hideBox("msgStatus");const recipient=safeVal("msgTo"),text=safeVal("msgText").trim(),urgent=$("msgUrgent").checked;if(!recipient)throw new Error("Selecciona a quién enviar el mensaje.");if(!text)throw new Error("Escribe un mensaje.");setBox("msgStatus","Enviando...");const {error}=await sb.rpc("ibm_v33_send_message",{p_recipient_id:recipient,p_text_content:text,p_is_urgent:urgent});if(error)throw error;$("msgText").value="";$("msgUrgent").checked=false;if(urgent){document.body.classList.add("shake");setTimeout(()=>document.body.classList.remove("shake"),500)}setBox("msgStatus","Mensaje enviado correctamente.");toast("Mensaje enviado");await loadAll();fillSelects();renderMessages();renderConversationList();updateBadges();renderHome()}catch(err){setBox("msgStatus",err.message,"err");toast("No se pudo enviar",err.message)}finally{btn.disabled=false}}
async function renderProfile(){
  if(!member?.id)return;
  const prefs=await v418EnsurePreferences(member.id);
  v418ApplyScope("profile",prefs);
  if($("profileEditorPreview"))$("profileEditorPreview").innerHTML=renderProfileCard360(member.id,{context:"editor",preferences:prefs});
  if($("profileName"))$("profileName").value=member.full_name||"";
  if($("profilePosition"))$("profilePosition").value=member.position||"";
  if($("profileColor"))$("profileColor").value=member.profile_color||"#6e26f6";
  if($("profileBg"))$("profileBg").value=member.profile_bg||"#f4f6fb";
  if($("profileFont"))$("profileFont").value=member.profile_font||"system";
  if($("profileMood"))$("profileMood").value=member.mood_status||"";
  if($("profileBio"))$("profileBio").value=member.bio||"";
  if($("profileQuote"))$("profileQuote").value=member.favorite_quote||"";
  v415RenderProfileMedia();v418HydrateCustomizer(prefs);
}

async function saveProfile(e){
  e.preventDefault();
  const btn=$("profileBtn");
  try{
    if(btn)btn.disabled=true;
    hideBox("profileStatus");
    setBox("profileStatus","Preparando imágenes y datos del perfil...");
    const v415Media=await v415PrepareProfileMedia();
    setBox("profileStatus","Guardando datos del perfil...");
    const {error}=await sb.rpc("ibm_v30_update_profile_inline",{
      p_full_name:safeVal("profileName"),p_position:safeVal("profilePosition"),p_profile_color:safeVal("profileColor"),
      p_bio:safeVal("profileBio"),p_profile_bg:safeVal("profileBg"),p_profile_font:safeVal("profileFont"),
      p_mood_status:safeVal("profileMood"),p_favorite_quote:safeVal("profileQuote"),
      p_avatar_data_url:v415Media.avatar||member.avatar_data_url||"",p_cover_data_url:v415Media.cover||member.cover_data_url||""
    });
    if(error)throw error;
    setBox("profileStatus","Perfil actualizado correctamente.");
    toast("Perfil actualizado");
    v415ResetProfileMediaDrafts(false);
    await loadAll();
    await renderProfile();
    await renderWall();
    renderTeam();
    renderHome();
  }catch(err){setBox("profileStatus",err.message||String(err),"err");toast("No se pudo actualizar",err.message)}finally{if(btn)btn.disabled=false}
}

function renderTeam(){$("teamList").innerHTML=`<div class="table-wrap"><table class="table"><thead><tr><th>Persona</th><th>Email</th><th>Rol</th><th>Cargo</th><th>Estado</th></tr></thead><tbody>${(state.members||[]).map(m=>`<tr><td><strong>${esc(m.full_name)}</strong></td><td>${esc(m.email)}</td><td>${esc(m.role_code)}</td><td>${esc(m.position||"")}</td><td>${esc(m.mood_status||m.status||"")}</td></tr>`).join("")}</tbody></table></div>`}
function score(t){let s=(Number(t.impact)||3)*10;if(["aprobado","publicado"].includes(t.status))s+=20;if(v412TaskOverdue(t))s-=15;return s}
function renderReports(){v416RenderReports()}

// ==== v3.5.9.4 Schedule Context Clean extensions ====
async function fileToInlineData(file,maxSide=1300,quality=.76){
  if(!file)return "";
  if(file.type&&file.type.startsWith("image/")) return await imageToDataUrl(file,maxSide,quality);
  const text=await file.text().catch(()=> "");
  if(text && text.length < 700000) return "data:text/plain;charset=utf-8,"+encodeURIComponent(text);
  throw new Error("Archivo muy pesado para guardado SQL inline. Usa imágenes o texto ligero.");
}
function renderMyDay(){
  const mine=(state.tasks||[]).filter(t=>t.assigned_to===member.id),allOpen=mine.filter(t=>!v412TaskDone(t)),open=allOpen.filter(v412TaskNeedsAction);
  const late=open.filter(t=>v412TaskOverdue(t)),todayTasks=open.filter(t=>v412TaskDueToday(t)),review=mine.filter(v412TaskAwaitingReview),done=mine.filter(v412TaskDone);
  const upcoming=(state.editorial||[]).filter(e=>e.publish_date>=today()&&(e.owner_id===member.id||!e.owner_id)).sort((a,b)=>String(a.publish_date||"").localeCompare(String(b.publish_date||""))).slice(0,8);
  if($("mydayMetrics"))$("mydayMetrics").innerHTML=[["Abiertas",open.length],["Para hoy",todayTasks.length],["Vencidas",late.length],["En revisión",review.length]].map(x=>`<div class="v413-day-stat"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
  const focus=[...late,...todayTasks,...open.filter(t=>![...late,...todayTasks].some(x=>x.id===t.id))].slice(0,12);
  if($("mydayTasks"))$("mydayTasks").innerHTML=focus.length?focus.map(t=>`<div class="v413-focus-task ${v412TaskOverdue(t)?'late':''} ${v412TaskAwaitingReview(t)?'review':''}" data-task-id="${esc(t.id)}"><strong>${esc(t.title)}</strong><p>${esc(nameOf(state.campaigns,t.campaign_id)||nameOf(state.clients,t.client_id)||"Sin proyecto")} · ${esc(t.status||"pendiente")} · ${esc(v412DateLabel(t.due_date))}</p></div>`).join(""):`<div class="v413-empty">No tienes pendientes críticos.</div>`;
  const observed=open.filter(t=>v412StatusKey(t.status)==="observado"||t.approval_status==="observado");
  if($("mydayEditorial"))$("mydayEditorial").innerHTML=`<div class="v413-pulse-list"><div class="v413-pulse ${observed.length?'danger':'success'}"><span>Entregas observadas</span><strong>${observed.length}</strong></div><div class="v413-pulse warning"><span>Esperando revisión</span><strong>${review.length-observed.length}</strong></div><div class="v413-pulse success"><span>Completadas</span><strong>${done.length}</strong></div></div><h3 style="margin-top:20px">Próximas publicaciones</h3>${upcoming.length?upcoming.map(e=>`<div class="v413-mini-item" onclick="navTo('editorial')"><div><strong>${esc(e.title)}</strong><span>${esc(e.platform||"")} · ${esc(e.status||"")}</span></div><span>${esc(v412DateLabel(e.publish_date))}</span></div>`).join(""):`<div class="v413-empty">Sin publicaciones próximas.</div>`}`;
  v413BindDynamicTaskCards();
}
function v414SearchRows(){
  const rows=[];
  (state.tasks||[]).forEach(x=>rows.push({type:"Tarea",title:x.title||"Tarea",body:[x.description,x.status,memberName(x.assigned_to),nameOf(state.clients,x.client_id),nameOf(state.campaigns,x.campaign_id),x.evidence_url].filter(Boolean).join(" · "),section:"tasks",id:x.id,date:x.updated_at||x.created_at||x.due_date||""}));
  (state.campaigns||[]).forEach(x=>rows.push({type:"Proyecto",title:x.name||"Proyecto",body:[x.objective,x.status,nameOf(state.clients,x.client_id),x.main_message].filter(Boolean).join(" · "),section:"campaigns",id:x.id,date:x.updated_at||x.created_at||x.end_date||""}));
  (state.briefs||[]).forEach(x=>rows.push({type:"Brief",title:x.title||"Brief",body:[x.objective,x.audience,x.deliverables].filter(Boolean).join(" · "),section:"campaigns",id:x.campaign_id||x.id,date:x.updated_at||x.created_at||""}));
  (state.editorial||[]).forEach(x=>rows.push({type:"Editorial",title:x.title||"Editorial",body:[x.copy_text,x.platform,x.format,x.status].filter(Boolean).join(" · "),section:"editorial",id:x.id,date:x.publish_date||x.created_at||""}));
  (state.members||[]).forEach(x=>rows.push({type:"Persona",title:x.full_name||"Miembro",body:[x.email,x.position,x.role_code,x.mood_status].filter(Boolean).join(" · "),section:"team",id:x.id,date:x.updated_at||x.created_at||""}));
  (state.assets||[]).forEach(x=>rows.push({type:"Archivo",title:x.name||"Archivo",body:[x.notes,x.file_type,x.approval_status,nameOf(state.campaigns,x.campaign_id)].filter(Boolean).join(" · "),section:"assets",id:x.id,date:x.updated_at||x.created_at||""}));
  (state.posts||[]).forEach(x=>rows.push({type:"Publicación",title:memberName(x.author_id),body:x.text_content||"Publicación con imagen",section:"wall",id:x.id,date:x.created_at||""}));
  (state.messages||[]).forEach(x=>rows.push({type:"Mensaje",title:`${memberName(x.sender_id)} → ${memberName(x.recipient_id)}`,body:x.text_content||"Mensaje",section:"messages",id:x.id,date:x.created_at||""}));
  return rows;
}
function v414OpenSearchResult(type,id,section){
  if(type==="Tarea"&&id){v412OpenTask(id);return}
  if(type==="Proyecto"&&id){v413OpenCampaign(id);return}
  if(type==="Persona"&&id){try{openMemberProfile(id);return}catch(e){}}
  navTo(section||"home");
}
function renderSearch(){
  const q=(safeVal("globalSearch")||"").toLowerCase().trim(),type=safeVal("v414SearchType");
  let list=v414SearchRows();
  if(type)list=list.filter(r=>r.type===type);
  if(q)list=list.filter(r=>`${r.type} ${r.title} ${r.body}`.toLowerCase().includes(q));else list=[];
  list=list.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,100);
  if($("v414SearchCount"))$("v414SearchCount").textContent=q?`${list.length} resultado${list.length===1?"":"s"}${type?` en ${type}`:""}.`:"Escribe para comenzar.";
  if(!$("searchResults"))return;
  $("searchResults").innerHTML=q?(list.map(r=>`<article class="v414-result" onclick="v414OpenSearchResult('${esc(r.type)}','${esc(r.id||"")}','${esc(r.section)}')"><span class="status blue">${esc(r.type)}</span><h3>${esc(r.title)}</h3><p>${esc(String(r.body||"").slice(0,240))}</p><div class="v414-result-foot"><span>${esc(r.section)}</span><span>${r.date?esc(new Date(r.date).toLocaleDateString("es-PE")):""}</span></div></article>`).join("")||`<div class="panel"><strong>Sin coincidencias</strong><p>Prueba con otro nombre, cliente, estado o palabra del contenido.</p></div>`):`<div class="panel"><strong>Búsqueda global lista</strong><p>Escribe al menos una palabra para consultar los datos que tu rol tiene disponibles.</p></div>`;
}

function renderNotifications(){
  const rows=(state.notifications||[]).slice().sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||"")));
  const groups={"Nuevas":rows.filter(n=>!n.read_at),"Anteriores":rows.filter(n=>n.read_at)};
  if(!$("notificationList"))return;
  $("notificationList").innerHTML=Object.entries(groups).filter(([,items])=>items.length).map(([label,items])=>`<div class="v413-notification-group"><h3>${label} · ${items.length}</h3>${items.map(n=>`<div class="v413-notification ${n.read_at?'':'unread'}"><i class="v413-notification-dot"></i><div><strong>${esc(n.title||"Notificación")}</strong><p>${esc(n.body||"")}</p><span class="small">${esc(n.entity_type||"")}</span></div><time>${n.created_at?new Date(n.created_at).toLocaleString("es-PE"):""}</time></div>`).join("")}</div>`).join("")||"<div class='panel'>Sin notificaciones.</div>";
}
function renderWorkload(){
  $("workloadGrid").innerHTML=(state.members||[]).map(m=>{
    const ts=(state.tasks||[]).filter(t=>t.assigned_to===m.id);
    const open=ts.filter(t=>!v412TaskDone(t));
    const late=open.filter(t=>v412TaskOverdue(t));
    const pts=ts.reduce((a,t)=>a+score(t),0);
    return `<div class="metric"><div class="mini-profile"><div class="mini-avatar" style="background:${esc(m.profile_color||'#6e26f6')}">${m.avatar_data_url?`<img src="${m.avatar_data_url}">`:esc(initials(m.full_name))}</div><div><strong>${esc(m.full_name)}</strong><br><span class="small">${esc(m.position||m.role_code)}</span></div></div><p><span class="status blue">${open.length} abiertas</span> <span class="status red">${late.length} vencidas</span></p><strong>${pts}</strong><span class="small"> Fair Score</span></div>`;
  }).join("");
}
async function saveBoard(e){e.preventDefault();try{const {error}=await sb.rpc("ibm_v31_create_board",{p_name:safeVal("boardName"),p_client_id:safeVal("boardClient")||null,p_campaign_id:safeVal("boardCampaign")||null,p_description:safeVal("boardDesc")});if(error)throw error;e.target.reset();toast("Pizarra creada");await loadAll();await renderAll()}catch(err){toast("No se pudo crear pizarra",err.message)}}
async function saveCard(e){e.preventDefault();try{hideBox("cardStatusBox");let img="";if($("cardImage").files[0]){setBox("cardStatusBox","Comprimiendo imagen...");img=await imageToDataUrl($("cardImage").files[0],1000,.75)}const {error}=await sb.rpc("ibm_v31_create_board_card_inline",{p_board_id:safeVal("cardBoard")||null,p_title:safeVal("cardTitle"),p_body:safeVal("cardBody"),p_status:safeVal("cardStatus"),p_link_url:safeVal("cardLink"),p_image_data_url:img});if(error)throw error;e.target.reset();toast("Tarjeta guardada");await loadAll();renderHub()}catch(err){setBox("cardStatusBox",err.message,"err");toast("No se pudo guardar tarjeta",err.message)}}
function renderHub(){
  safeOptions("cardBoard",(state.boards||[]).map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join(""));
  $("hubGrid").innerHTML=(state.boards||[]).map(b=>{
    const cards=(state.board_cards||[]).filter(c=>c.board_id===b.id);
    return `<div class="hub-card"><h3>${esc(b.name)}</h3><p>${esc(b.description||"")}</p><span class="small">${esc(nameOf(state.clients,b.client_id))}</span>${cards.map(c=>`<div class="mini"><strong>${esc(c.title)}</strong><br><span class="status">${esc(c.status)}</span><p>${esc(c.body||"")}</p>${imgSrc(c.image_url)?`<img src="${c.image_url}">`:""}${c.link_url?`<a target="_blank" href="${esc(c.link_url)}">Abrir link</a>`:""}</div>`).join("")}</div>`;
  }).join("")||"<div class='panel'>Aún no hay pizarras creativas.</div>";
}
async function saveAsset(e){e.preventDefault();try{hideBox("assetStatusBox");const file=$("assetFile").files[0];let data="",size=0,type=safeVal("assetType");if(file){setBox("assetStatusBox","Optimizando archivo...");data=await v415UploadOrInline(file,{folder:"assets",maxSide:1800,quality:.82,allowDocuments:true,statusId:"assetStatusBox"});size=file.size;type=type||file.type}const {error}=await sb.rpc("ibm_v31_create_asset_inline",{p_name:safeVal("assetName"),p_client_id:safeVal("assetClient")||null,p_campaign_id:safeVal("assetCampaign")||null,p_related_task_id:safeVal("assetTask")||null,p_file_type:type,p_file_size:size,p_notes:safeVal("assetNotes"),p_asset_data_url:data});if(error)throw error;e.target.reset();toast("Archivo guardado");await loadAll();renderAssets()}catch(err){setBox("assetStatusBox",err.message,"err");toast("No se pudo guardar archivo",err.message)}}
function renderAssets(){
  const grid=$("assetGrid");if(!grid)return;
  grid.innerHTML=(state.assets||[]).map(a=>`<div class="asset-card v415-asset-card"><div class="module-title"><div><h3>${esc(a.name)}</h3><span class="small">${esc(nameOf(state.clients,a.client_id)||"Sin cliente")}</span></div><span class="status ${a.approval_status==='aprobado'?'green':'orange'}">${esc(a.approval_status||a.status||"pendiente")}</span></div>${v415AssetPreviewMarkup(a)}<p>${esc(a.notes||"")}</p><div class="v415-file-meta"><span>${esc(a.file_type||"archivo")}</span><span>${v415FormatBytes(Number(a.file_size)||0)}</span>${a.related_task_id?`<button class="ghost" type="button" onclick="v412OpenTask('${a.related_task_id}')">Ver tarea</button>`:""}</div><div class="btn-row"><button class="ghost" onclick="assetApprove('${a.id}','approve')">Aprobar</button><button class="ghost" onclick="assetApprove('${a.id}','observe')">Observar</button></div></div>`).join("")||"<div class='panel'>Sin archivos.</div>";
  v415OptimizeImages(grid);
}
async function saveTemplate(e){e.preventDefault();try{const items=safeVal("templateItems").split("\n").map(x=>x.trim()).filter(Boolean);const {error}=await sb.rpc("ibm_v31_create_template",{p_name:safeVal("templateName"),p_type:safeVal("templateType"),p_description:safeVal("templateDesc"),p_items:items});if(error)throw error;e.target.reset();toast("Plantilla guardada");await loadAll();renderTemplates()}catch(err){toast("No se pudo guardar plantilla",err.message)}}
function renderTemplates(){
  $("templateGrid").innerHTML=(state.templates||[]).map(t=>`<div class="template-card"><span class="status blue">${esc(t.type)}</span><h3>${esc(t.name)}</h3><p>${esc(t.description||"")}</p><ul>${((t.content&&t.content.items)||[]).map(i=>`<li>${esc(i)}</li>`).join("")}</ul></div>`).join("")||"<p>Sin plantillas.</p>";
}
async function saveIncident(e){e.preventDefault();try{const {error}=await sb.rpc("ibm_v31_create_incident",{p_title:safeVal("incidentTitle"),p_description:safeVal("incidentDesc"),p_severity:safeVal("incidentSeverity"),p_client_id:safeVal("incidentClient")||null,p_campaign_id:safeVal("incidentCampaign")||null,p_assigned_to:safeVal("incidentAssignee")||null});if(error)throw error;e.target.reset();toast("Incidencia creada");await loadAll();renderIncidents()}catch(err){toast("No se pudo crear incidencia",err.message)}}
function renderIncidents(){
  $("incidentGrid").innerHTML=(state.incidents||[]).map(i=>`<div class="incident-card"><span class="status ${i.severity==='alta'||i.severity==='crítica'?'red':'orange'}">${esc(i.severity)}</span><h3>${esc(i.title)}</h3><p>${esc(i.description||"")}</p><span class="small">${esc(nameOf(state.clients,i.client_id))} · asignado a ${esc(memberName(i.assigned_to))}</span></div>`).join("")||"<p>Sin incidencias.</p>";
}
function loadAdminUser(id){const u=by(state.members,id);$("adminUserId").value=u.id||"";$("adminUserEmail").value=u.email||"";$("adminUserName").value=u.full_name||"";$("adminUserRole").value=u.role_code||"member";$("adminUserPosition").value=u.position||"";$("adminUserStatus").value=u.status||"active";$("adminUserColor").value=u.profile_color||"#6e26f6"}
async function saveAdminUser(e){e.preventDefault();try{const {error}=await sb.rpc("ibm_v31_upsert_member_basic",{p_member_id:safeVal("adminUserId")||null,p_email:safeVal("adminUserEmail"),p_full_name:safeVal("adminUserName"),p_role_code:safeVal("adminUserRole"),p_position:safeVal("adminUserPosition"),p_status:safeVal("adminUserStatus"),p_profile_color:safeVal("adminUserColor")});if(error)throw error;toast("Usuario guardado");await loadAll();renderAdmin();renderTeam()}catch(err){toast("No se pudo guardar usuario",err.message)}}
function renderV31(){
  renderMyDay();renderSearch();renderNotifications();renderApprovals();renderWorkload();renderHub();renderAssets();renderTemplates();renderIncidents();renderAdmin();
}


// ==== v3.5.9.4 Schedule Context Clean ====
function v121RoleCode(){return String(member?.role_code||"").trim()}
function v121RoleRecord(){
  const code=v121RoleCode().toLowerCase();
  return (state.roles||[]).find(role=>[role?.code,role?.role_code,role?.slug,role?.id,role?.name].some(value=>String(value||"").trim().toLowerCase()===code))||null;
}
function v121RoleText(){
  const role=v121RoleRecord()||{};
  return [role.name,role.label,role.title,role.description,role.slug,member?.position,member?.role_code].filter(Boolean).join(" ").toLowerCase();
}
function v121PermissionRule(module,action){
  const code=[module,action].filter(Boolean).join(".");
  const personal=(state.effective_permissions||[]).find(rule=>String(rule?.permission_code||"")===code);
  if(personal)return {...personal,module,action};
  return (state.role_permissions||[]).find(rule=>String(rule?.role_code||"")===v121RoleCode()&&String(rule?.module||"")===String(module||"")&&String(rule?.action||"")===String(action||""))||null;
}
function v121AllowedRules(){return (state.role_permissions||[]).filter(rule=>String(rule?.role_code||"")===v121RoleCode()&&rule?.allowed===true)}
function v121RoleLevel(){
  const role=v121RoleRecord()||{};
  const raw=role.level??role.rank??role.priority??role.weight;
  const parsed=Number(raw);
  return Number.isFinite(parsed)?parsed:null;
}
function isDirector(){
  const text=v121RoleText(),level=v121RoleLevel(),rules=v121AllowedRules();
  if(rules.some(rule=>["admin","manage","configure"].includes(String(rule.action||"").toLowerCase())&&["admin","permissions","governance","settings"].includes(String(rule.module||"").toLowerCase())))return true;
  if(level!==null&&level>=90)return true;
  if(/\b(director|direcci[oó]n|gerente general|administrator|administrador|owner|propietario)\b/.test(text))return true;
  return ["italo","jhulio"].includes(v121RoleCode().toLowerCase());
}
function isSupervisor(){
  if(isDirector())return true;
  const text=v121RoleText(),level=v121RoleLevel(),rules=v121AllowedRules();
  if(rules.some(rule=>["approve","review","assign","admin","manage","export"].includes(String(rule.action||"").toLowerCase())))return true;
  if(level!==null&&level>=50)return true;
  if(/\b(supervisor|jefe|jefatura|coordinador|coordinadora|team lead|líder de equipo|lider de equipo|responsable de [aá]rea|gerente)\b/.test(text))return true;
  return ["alejandro"].includes(v121RoleCode().toLowerCase());
}
function hasVisualPermission(module,action){
  const rule=v121PermissionRule(module,action);
  if(rule)return !!rule.allowed;
  if(isDirector())return true;
  if(action==="view")return true;
  if(["approve","review","assign","admin","manage","export"].includes(String(action||"").toLowerCase()))return isSupervisor();
  return true;
}
function applyVisualPermissions(){
  const adminBtn=document.querySelector('[data-section="admin"]');
  const permBtn=document.querySelector('[data-section="permissions"]');
  const auditBtn=document.querySelector('[data-section="auditpro"]');
  const controlBtn=document.querySelector('[data-section="control"]');
  if(adminBtn) adminBtn.classList.toggle("permission-lock",!isSupervisor());
  if(permBtn) permBtn.classList.toggle("permission-lock",!isDirector());
  if(auditBtn) auditBtn.classList.toggle("permission-lock",!isSupervisor());
  if(controlBtn) controlBtn.classList.toggle("permission-lock",!isSupervisor());
}
const v414ControlFilter={period:"30",area:"",member:"",campaign:""};
function v414TaskDate(t){return String(t.updated_at||t.created_at||t.due_date||"").slice(0,10)}
function v414FilteredTasks(){
  const now=new Date(),days=v414ControlFilter.period==="all"?0:Number(v414ControlFilter.period||30),min=days?new Date(now.getTime()-days*86400000):null;
  return (state.tasks||[]).filter(t=>{
    if(v414ControlFilter.area&&t.area_id!==v414ControlFilter.area)return false;
    if(v414ControlFilter.member&&t.assigned_to!==v414ControlFilter.member)return false;
    if(v414ControlFilter.campaign&&t.campaign_id!==v414ControlFilter.campaign)return false;
    if(min){const raw=v414TaskDate(t);if(raw&&new Date(raw+"T12:00:00")<min)return false}
    return true;
  });
}
function v414FillControlFilters(){
  const configs=[["v414ControlArea",state.areas||[],"name","area"],["v414ControlMember",(state.members||[]).filter(m=>m.status!=="inactive"),"full_name","member"],["v414ControlCampaign",state.campaigns||[],"name","campaign"]];
  configs.forEach(([id,rows,key,filterKey])=>{const el=$(id);if(!el)return;const prev=v414ControlFilter[filterKey]||el.value;el.innerHTML=`<option value="">Todos</option>`+rows.map(x=>`<option value="${esc(x.id)}">${esc(x[key]||"")}</option>`).join("");el.value=prev});
  if($("v414ControlPeriod"))$("v414ControlPeriod").value=v414ControlFilter.period;
}
function v414Bars(rows,{bad=false}={}){const max=Math.max(1,...rows.map(x=>x.value));return rows.map(x=>`<div class="v414-bar ${x.bad?'bad':x.warn?'warn':''}"><label title="${esc(x.label)}">${esc(x.label)}</label><div class="v414-track"><i style="width:${Math.max(2,Math.round(x.value*100/max))}%"></i></div><strong>${esc(x.value)}</strong></div>`).join("")||`<div class="v413-empty">Sin datos para este filtro.</div>`}
function renderControl(){
  v414FillControlFilters();
  const tasks=v414FilteredTasks(),open=tasks.filter(t=>!v412TaskDone(t)),done=tasks.filter(v412TaskDone),late=open.filter(t=>v412TaskOverdue(t)),review=tasks.filter(v412TaskAwaitingReview),observed=tasks.filter(t=>v412StatusKey(t.status)==="observado"||t.approval_status==="observado");
  const completion=tasks.length?Math.round(done.length*100/tasks.length):0;
  const dueDone=done.filter(t=>t.due_date),onTime=dueDone.filter(t=>{const finished=String(t.completed_at||t.updated_at||t.created_at||"").slice(0,10);return !finished||finished<=t.due_date}),punctuality=dueDone.length?Math.round(onTime.length*100/dueDone.length):100;
  const evidence=tasks.filter(t=>String(t.evidence_url||"").trim()).length;
  if($("v414ControlScopeLabel"))$("v414ControlScopeLabel").textContent=`${tasks.length} tareas · ${v414ControlFilter.period==="all"?"todo el historial":`ultimos ${v414ControlFilter.period} dias`}`;
  $("controlMetrics").innerHTML=[
    ["Tareas",tasks.length,"",`${open.length} abiertas`],["Cumplimiento",completion+"%",completion>=75?"good":completion<45?"danger":"warning",`${done.length} completadas`],["Puntualidad",punctuality+"%",punctuality>=80?"good":"warning",`${dueDone.length} cierres con fecha`],["Vencidas",late.length,late.length?"danger":"good","requieren accion"],["En revision",review.length,review.length?"warning":"good",`${observed.length} observadas`],["Con evidencia",evidence,"",`${tasks.length?Math.round(evidence*100/tasks.length):0}% del alcance`]
  ].map(x=>`<div class="v414-kpi ${x[2]}"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[3]}</small></div>`).join("");
  const statusKeys=[["Pendiente","pendiente"],["En proceso","en_proceso"],["Revision","en_revision"],["Observada","observado"],["Completada","done"]];
  $("v414StatusChart").innerHTML=v414Bars(statusKeys.map(([label,key])=>({label,value:key==="done"?done.length:tasks.filter(t=>v412StatusKey(t.status)===key).length,bad:key==="observado",warn:key==="en_revision"})));
  const team=(state.members||[]).map(m=>{const mt=open.filter(t=>t.assigned_to===m.id),ml=mt.filter(t=>v412TaskOverdue(t));return {label:m.full_name||"Miembro",value:mt.length,bad:ml.length>0,late:ml.length}}).filter(x=>x.value).sort((a,b)=>b.value-a.value).slice(0,9);
  $("v414TeamChart").innerHTML=v414Bars(team);
  const campaigns=(state.campaigns||[]).map(c=>{const ct=tasks.filter(t=>t.campaign_id===c.id);if(!ct.length)return null;const cd=ct.filter(v412TaskDone),cl=ct.filter(t=>v412TaskOverdue(t)),progress=Math.round(cd.length*100/ct.length);return {c,ct,cl,progress}}).filter(Boolean).sort((a,b)=>b.cl.length-a.cl.length||a.progress-b.progress).slice(0,8);
  $("v414CampaignHealth").innerHTML=campaigns.map(x=>`<div class="v414-risk ${x.cl.length?'red':'green'}" onclick="v413OpenCampaign('${esc(x.c.id)}')"><i></i><div><strong>${esc(x.c.name)}</strong><p>${x.progress}% de avance · ${x.ct.length} tareas</p></div><time>${x.cl.length?`${x.cl.length} vencidas`:"estable"}</time></div>`).join("")||`<div class="v413-empty">No hay proyectos con tareas en este alcance.</div>`;
  const risks=[...late.map(t=>({kind:"task",id:t.id,title:t.title,body:`${memberName(t.assigned_to)} · vencio ${t.due_date}`,red:true,date:t.due_date})),...review.map(t=>({kind:"task",id:t.id,title:t.title,body:"Entrega esperando revision",date:t.updated_at||t.created_at})),...observed.map(t=>({kind:"task",id:t.id,title:t.title,body:"Trabajo observado; requiere correccion",red:true,date:t.updated_at||t.created_at}))].sort((a,b)=>String(a.date||"").localeCompare(String(b.date||""))).slice(0,12);
  $("controlRisks").innerHTML=risks.map(r=>`<div class="v414-risk ${r.red?'red':''}" onclick="v412OpenTask('${esc(r.id)}')"><i></i><div><strong>${esc(r.title)}</strong><p>${esc(r.body)}</p></div><time>abrir</time></div>`).join("")||`<div class="v413-empty">Sin riesgos criticos en el filtro actual.</div>`;
  $("recommendedActions").innerHTML=[late.length&&`Priorizar ${late.length} tarea${late.length===1?"":"s"} vencida${late.length===1?"":"s"}.`,review.length&&`Resolver ${review.length} entrega${review.length===1?"":"s"} en revision.`,observed.length&&`Acompanar ${observed.length} correccion${observed.length===1?"":"es"} observada${observed.length===1?"":"s"}.`,completion<60&&tasks.length&&`Revisar bloqueos: el cumplimiento del alcance esta en ${completion}%.`,!late.length&&!review.length&&!observed.length&&"Operacion estable: mantener seguimiento preventivo."].filter(Boolean).map(x=>`<p>• ${esc(x)}</p>`).join("");
  renderApprovalTimeline();
}

function renderApprovalTimeline(){
  const hist=(state.approval_history||[]).slice(0,25);
  $("approvalTimeline").innerHTML=hist.map(h=>`<div class="timeline-row"><span class="timeline-dot"></span><div><strong>${esc(h.decision)} · ${esc(h.actor_role||"")}</strong><br><span class="small">${new Date(h.created_at).toLocaleString("es-PE")} · ${esc(h.previous_status||"")} → ${esc(h.new_status||"")}</span><p>${esc(h.comment||"")}</p></div></div>`).join("")||"<p>Aún no hay historial de aprobaciones.</p>";
}
function renderAuditPro(){
  const logs=(state.audit_logs||[]),errors=(state.client_errors||[]),session=v414Perf.audit||[];
  if($("v414AuditSummary"))$("v414AuditSummary").innerHTML=[["Eventos backend",logs.length],["Errores backend",errors.length],["Eventos sesion",session.length],["Renders fallidos",session.filter(x=>x.type==="error").length]].map(x=>`<div><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
  $("auditProList").innerHTML=`<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Modulo</th><th>Accion</th><th>Actor</th><th>Severidad</th></tr></thead><tbody>${logs.slice(0,180).map(a=>`<tr><td>${new Date(a.created_at).toLocaleString("es-PE")}</td><td>${esc(a.module||a.entity_type||"")}</td><td>${esc(a.action)}</td><td>${esc(memberName(a.actor_id))}</td><td>${esc(a.severity||"info")}</td></tr>`).join("")}${session.slice().reverse().slice(0,60).map(a=>`<tr><td>${new Date(a.at).toLocaleString("es-PE")}</td><td>sesion local</td><td>${esc(a.type)} · ${esc(a.label||"")}</td><td>${esc(member?.full_name||"Usuario")}</td><td>${a.type==="error"?"error":"info"}</td></tr>`).join("")}</tbody></table></div>`;
  $("clientErrorList").innerHTML=errors.map(e=>`<div class="error-row"><strong>${esc(e.module||"app")} · ${esc(e.action||"")}</strong><p>${esc(e.message||"")}</p><span class="small">${new Date(e.created_at).toLocaleString("es-PE")} · ${esc(memberName(e.actor_id))}</span></div>`).join("")||"<p>Sin errores registrados por el backend.</p>";
}

function renderPermissions(){
  const modules=["tasks","approvals","campaigns","editorial","hub","assets","reports","admin","messages","wall"],actions=["view","create","edit","approve","export","admin"];
  if($("v414PermissionSummary"))$("v414PermissionSummary").innerHTML=modules.map(mod=>{const allowed=hasVisualPermission(mod,"view");return `<div class="v414-permission-card ${allowed?'yes':'no'}"><span>${esc(mod)}</span><strong>${allowed?'Visible para mi rol':'Restringido'}</strong></div>`}).join("");
  $("permissionMatrix").innerHTML=(state.role_permissions||[]).map(p=>`<div class="perm-card"><strong>${esc(p.role_code)}</strong><br><span class="small">${esc(p.module)} · ${esc(p.action)}</span><p><span class="status ${p.allowed?'green':'red'}">${p.allowed?'Permitido':'Bloqueado'}</span></p></div>`).join("")||"<p>Sin permisos personalizados. Se aplican los valores visuales predeterminados del rol.</p>";
}

async function savePermission(){
  if(!isDirector()){toast("Sin permiso","Solo ITALO o JHULIO pueden cambiar permisos.");return}
  try{
    const {error}=await sb.rpc("ibm_v32_set_permission",{p_role_code:safeVal("permRole"),p_module:safeVal("permModule"),p_action:safeVal("permAction"),p_allowed:safeVal("permAllowed")==="true"});
    if(error) throw error;
    toast("Permiso actualizado");
    await loadAll();renderPermissions();applyVisualPermissions();
  }catch(err){toast("No se pudo guardar permiso",err.message)}
}
function csvEscape(v){return `"${String(v??"").replaceAll('"','""')}"`}
function downloadCSV(name,rows){
  const blob=new Blob([rows.map(r=>r.map(csvEscape).join(",")).join("\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
}
function exportAuditCSV(){
  downloadCSV("auditoria_inbestiga.csv",[["Fecha","Actor","Acción","Módulo","Entidad","Detalle"],...(state.audit_logs||[]).map(a=>[a.created_at,memberName(a.actor_id),a.action,a.module||"",a.entity_type||"",JSON.stringify(a.details||{})])]);
}
function exportTasksCSV(){
  downloadCSV("tareas_inbestiga.csv",[["Tarea","Responsable","Cliente","Estado","Aprobación","Entrega","Score"],...(state.tasks||[]).map(t=>[t.title,memberName(t.assigned_to),nameOf(state.clients,t.client_id),t.status,t.approval_status,t.due_date,score(t)])]);
}
async function saveExecutiveSnapshot(){
  if(!isSupervisor()){toast("Sin permiso","Solo supervisores pueden guardar reportes.");return}
  const payload={created_at:new Date().toISOString(),tasks:state.tasks?.length||0,campaigns:state.campaigns?.length||0,incidents:state.incidents?.length||0,late:(state.tasks||[]).filter(t=>v412TaskOverdue(t)).length};
  try{
    const {error}=await sb.rpc("ibm_v32_create_report_snapshot",{p_title:"Reporte gerencial "+new Date().toLocaleString("es-PE"),p_report_type:"executive",p_payload:payload});
    if(error) throw error;
    toast("Reporte guardado");
    await loadAll();
  }catch(err){toast("No se pudo guardar reporte",err.message)}
}
async function logClientError(module,action,err){
  try{
    if(sb) await sb.rpc("ibm_v32_log_client_error",{p_module:module,p_action:action,p_message:err?.message||String(err),p_details:{url:location.href}});
  }catch(e){}
}
function renderV32(){renderControl();renderAuditPro();renderPermissions();applyVisualPermissions()}


// ==== v3.5.9.4 Schedule Context Clean ====
let realtimeChannel=null;
let currentSection="home";
let realtimeStarted=false;
let realtimeAvailable=false;
let syncInProgress=false;
function unreadMessages(){return (state.messages||[]).filter(m=>m.recipient_id===member.id && !m.read_at)}
function unreadNotifications(){return (state.notifications||[]).filter(n=>n.recipient_id===member.id && !n.read_at)}
function updateBadges(){
  const m=unreadMessages().length,n=unreadNotifications().length;
  if($("msgBadge")){$("msgBadge").textContent=m;$("msgBadge").style.display=m?"inline-grid":"none"}
  if($("notifBadge")){$("notifBadge").textContent=n;$("notifBadge").style.display=n?"inline-grid":"none"}
}
function setRealtimeStatus(ok,text,detail=""){
  realtimeAvailable=ok;
  if($("rtDot"))$("rtDot").classList.toggle("off",!ok);
  if($("rtStatus"))$("rtStatus").textContent=text;
  if($("rtDetail"))$("rtDetail").textContent=detail;
  if($("msgRealtimeStatus"))$("msgRealtimeStatus").textContent=ok?"Realtime activo":"Modo sincronización";
}
async function safeSync(reason="sync"){
  if(syncInProgress) return;
  syncInProgress=true;
  try{
    await loadAll();
    fillSelects();
    updateBadges();
    renderMessages();
    try{window.INBESTIGA_SAKURA_NATIVE?.refreshMessages?.()}catch(_){}
    renderNotifications();
    renderPresence();
    renderLiveFeed();
    renderHome();
    if(currentSection==="wall")await renderWall();
    if(currentSection==="tasks")renderTasks();
    if(currentSection==="approvals")renderApprovals();
    if(currentSection==="control")renderControl();
  }catch(err){
    toast("No se pudo sincronizar",err.message||String(err));
    logClientError("realtime",reason,err);
  }finally{syncInProgress=false}
}
function startRealtime(){
  if(realtimeStarted||!sb||!member?.id)return;
  realtimeStarted=true;
  try{
    realtimeChannel=sb.channel("ibm_v33_live_"+member.id)
      .on("postgres_changes",{event:"INSERT",schema:"marketing_app",table:"messages"},payload=>handleRealtimePayload("message",payload))
      .on("postgres_changes",{event:"INSERT",schema:"marketing_app",table:"notifications"},payload=>handleRealtimePayload("notification",payload))
      .on("postgres_changes",{event:"INSERT",schema:"marketing_app",table:"wall_posts"},payload=>handleRealtimePayload("wall",payload))
      .on("postgres_changes",{event:"INSERT",schema:"marketing_app",table:"comments"},payload=>handleRealtimePayload("comment",payload))
      .on("postgres_changes",{event:"UPDATE",schema:"marketing_app",table:"tasks"},payload=>handleRealtimePayload("task",payload))
      .on("postgres_changes",{event:"*",schema:"marketing_app",table:"live_presence"},payload=>handleRealtimePayload("presence",payload))
      .on("postgres_changes",{event:"INSERT",schema:"marketing_app",table:"live_events"},payload=>handleRealtimePayload("event",payload))
      .subscribe(status=>{
        if(status==="SUBSCRIBED")setRealtimeStatus(true,"Realtime activo","Mensajes y actividad llegan sin recargar.");
        if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")setRealtimeStatus(false,"Realtime no disponible","Usa sincronización manual o revisa Realtime en Supabase.");
        if(status==="CLOSED")setRealtimeStatus(false,"Realtime cerrado","Puedes volver a abrir la página.");
      });
    touchPresence("online",currentSection);
  }catch(err){setRealtimeStatus(false,"Realtime no disponible",err.message||String(err));logClientError("realtime","start",err)}
}

async function handleRealtimePayload(type,payload){
  const row=payload.new||{};
  if(type==="message" && row.recipient_id===member.id){
    if(row.is_urgent){document.body.classList.add("shake");setTimeout(()=>document.body.classList.remove("shake"),520)}
    toast(row.is_urgent?"Zumbido urgente":"Nuevo mensaje",memberName(row.sender_id));
  }
  if(type==="notification" && row.recipient_id===member.id) toast(row.title||"Nueva notificación",row.body||"");
  await safeSync("realtime_"+type);
}
async function touchPresence(status="online",section=currentSection){
  try{await sb.rpc("ibm_v33_touch_presence",{p_status:status,p_current_section:section})}catch(e){}
}
function conversationPartners(){
  const ids=new Set();
  (state.messages||[]).forEach(m=>{if(m.sender_id===member.id)ids.add(m.recipient_id);if(m.recipient_id===member.id)ids.add(m.sender_id)});
  (state.members||[]).filter(m=>m.id!==member.id).forEach(m=>ids.add(m.id));
  return [...ids].map(id=>by(state.members,id)).filter(x=>x.id);
}
function renderConversationList(){
  if(!$("conversationList"))return;
  $("conversationList").innerHTML=conversationPartners().map(u=>{
    const msgs=(state.messages||[]).filter(m=>(m.sender_id===u.id&&m.recipient_id===member.id)||(m.sender_id===member.id&&m.recipient_id===u.id)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    const last=msgs[0];
    const unread=msgs.filter(m=>m.recipient_id===member.id&&!m.read_at).length;
    return `<div class="conversation-item ${unread?'unread':''}" onclick="selectConversation('${u.id}')"><div class="mini-avatar" style="background:${esc(u.profile_color||'#6e26f6')}">${u.avatar_data_url?`<img src="${u.avatar_data_url}">`:esc(initials(u.full_name))}</div><div style="min-width:0"><strong>${esc(u.full_name)}</strong><br><span class="small">${esc(last?last.text_content:'Sin mensajes aún').slice(0,55)}</span></div>${unread?`<span class="badge right">${unread}</span>`:""}</div>`;
  }).join("")||"<p class='small'>No hay conversaciones.</p>";
}
function selectConversation(userId){
  if($("msgTo"))$("msgTo").value=userId;
  renderMessages(userId);
}
async function markAllMessagesRead(){
  try{const {error}=await sb.rpc("ibm_v33_mark_all_messages_read");if(error)throw error;toast("Mensajes marcados como leídos");await safeSync("mark_messages_read")}catch(err){toast("No se pudo marcar leído",err.message)}
}
async function markAllNotificationsRead(){
  try{const {error}=await sb.rpc("ibm_v33_mark_all_notifications_read");if(error)throw error;toast("Notificaciones leídas");await safeSync("mark_notifications_read")}catch(err){toast("No se pudo marcar notificaciones",err.message)}
}
function renderPresence(){
  if(!$("presenceGrid"))return;
  const now=Date.now();
  $("presenceGrid").innerHTML=(state.members||[]).map(m=>{
    const p=(state.live_presence||[]).find(x=>x.member_id===m.id);
    const seen=p?new Date(p.updated_at||p.last_seen_at).getTime():0;
    const online=seen && (now-seen)<90000;
    return `<div class="presence-card ${online?'online':'away'} clickable-person" onclick="openMemberProfile('${m.id}')"><div class="mini-profile"><div class="mini-avatar" style="background:${esc(m.profile_color||'#6e26f6')}">${m.avatar_data_url?`<img src="${m.avatar_data_url}">`:esc(initials(m.full_name))}</div><div><strong>${esc(m.full_name)}</strong><br><span class="small">${online?'En línea':'Ausente'} · ${esc(p?.current_section||'')}</span></div></div></div>`;
  }).join("");
}
function renderLiveFeed(){
  if(!$("liveFeed"))return;
  $("liveFeed").innerHTML=(state.live_events||[]).slice(0,40).map(e=>`<div class="live-event"><strong>${esc(e.title||e.event_type)}</strong><p>${esc(e.body||"")}</p><span class="small">${esc(memberName(e.actor_id))} · ${new Date(e.created_at).toLocaleString("es-PE")}</span></div>`).join("")||"<p>Sin actividad reciente.</p>";
}
function renderV33(){updateBadges();renderConversationList();renderPresence();renderLiveFeed()}


// ==== v3.5.9.4 Schedule Context Clean / Menú Inteligente ====
function isJuniorRole(){return !isSupervisor()}
function roleLabel(){const role=v121RoleRecord()||{};return role.label||role.name||role.title||member?.position||(isDirector()?"Dirección":isSupervisor()?"Supervisión":"Miembro del equipo")}
function applyRoleNavigation(){
  const supervisor=isSupervisor(),director=isDirector();
  document.querySelectorAll(".supervisor-only").forEach(el=>{
    const section=el.dataset?.section;
    const permitted=section?hasVisualPermission(section,"view"):supervisor;
    el.style.display=permitted?"":"none";
  });
  document.querySelectorAll(".director-only").forEach(el=>{
    const section=el.dataset?.section;
    const permitted=section?hasVisualPermission(section,"view"):director;
    el.style.display=permitted?"":"none";
  });
  const treasurySection=document.getElementById("treasury");
  if(treasurySection)treasurySection.style.display=hasVisualPermission("treasury","view")?"":"none";
  [["group_finance","treasury"],["group_control","control"],["group_admin","admin"]].forEach(([groupId,module])=>{
    const group=document.getElementById(groupId),button=group?.previousElementSibling,permitted=hasVisualPermission(module,"view")||(module==="control"&&hasVisualPermission("reports","view"))||(module==="admin"&&hasVisualPermission("permissions","view"));
    if(group)group.style.display=permitted?"":"none";
    if(button)button.style.display=permitted?"":"none";
  });
  if(isJuniorRole()){
    ["group_work","group_social"].forEach(id=>$(id)?.classList.add("open"));
  }else{
    ["group_control","group_work"].forEach(id=>$(id)?.classList.add("open"));
  }
}
function toggleGroup(group){
  const el=$("group_"+group);
  if(!el)return;
  el.classList.toggle("open");
}
function renderRoleHome(){
  if(!$("roleHome")) return;
  const name=member.full_name||"Equipo";
  const supervisor=!isJuniorRole();
  const late=(state.tasks||[]).filter(t=>v412TaskOverdue(t));
  const myTasks=(state.tasks||[]).filter(t=>t.assigned_to===member.id&&!["aprobado","publicado"].includes(t.status));
  const approvals=(state.tasks||[]).filter(t=>["en_revision","observado","corregido"].includes(t.status)||["validado_alejandro","validado_jhulio","observado"].includes(t.approval_status));
  $("roleHome").innerHTML=supervisor?
    `<h1>Hola, ${esc(name.split(" ")[0])}. Tienes el control.</h1><p>Vista limpia para dirección: riesgos, aprobaciones, carga del equipo y actividad viva.</p><div class="role-home-actions"><button class="primary" onclick="navTo('control')">Ver control gerencial</button><button class="ghost" onclick="navTo('approvals')">Revisar aprobaciones</button><button class="ghost" onclick="navTo('workload')">Ver carga del equipo</button></div>`:
    `<h1>Hola, ${esc(name.split(" ")[0])}. Este es tu día.</h1><p>Vista simple para enfocarte en tus tareas, mensajes, muro y entregables.</p><div class="role-home-actions"><button class="primary" onclick="navTo('myday')">Ver mi día</button><button class="ghost" onclick="navTo('tasks')">Mis tareas</button><button class="ghost" onclick="navTo('messages')">Mensajes</button></div>`;
  $("quickActions").innerHTML=(supervisor?[
    ["Control","Riesgos y decisiones","control"],["🛡️ Aprobar","Cola de revisión","approvals"],["📊 Carga","Equipo y Fair Score","workload"],["🌐 Muro","Actividad social","wall"]
  ]:[
    ["Mi día","Qué hago ahora","myday"],[" Tareas","Mis pendientes","tasks"],[" Mensajes","Comunicación","messages"],["🌐 Muro","Publicaciones internas","wall"]
  ]).map(x=>`<div class="quick-card" onclick="navTo('${x[2]}')"><strong>${x[0]}</strong><span class="small">${x[1]}</span></div>`).join("");
}
function renderNavPreferences(){
  const p=state.user_preferences||{};
  if($("navMode"))$("navMode").value=p.nav_mode||"simple";
  if($("defaultSection"))$("defaultSection").value=p.default_section||"home";
  if($("compactSidebar"))$("compactSidebar").value=String(p.compact_sidebar??true);
}
async function saveNavPreferences(){
  try{
    const {error}=await sb.rpc("ibm_v34_update_nav_preferences",{p_nav_mode:safeVal("navMode"),p_default_section:safeVal("defaultSection"),p_compact_sidebar:safeVal("compactSidebar")==="true"});
    if(error)throw error;
    toast("Preferencias guardadas");
    await loadAll();renderNavPreferences();applyRoleNavigation();
  }catch(err){toast("No se pudo guardar preferencias",err.message)}
}
function renderV34(){applyRoleNavigation();if($('roleHome'))renderRoleHome();renderNavPreferences();renderHomeFeedPreferences()}


// ==== v3.5.9.4 Schedule Context Clean ====
function syncHomeClock(){
  const d=new Date();
  if($("homeClock"))$("homeClock").textContent=d.toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"});
  if($("homeTodayText"))$("homeTodayText").textContent=d.toLocaleDateString("es-PE",{weekday:"long",day:"2-digit",month:"long"});
}
function miniAvatarSync(user,cls="mini-avatar"){
  user=user||{};
  return `<div class="${cls}" style="background:${esc(user.profile_color||'#6e26f6')}">${user.avatar_data_url?`<img src="${user.avatar_data_url}">`:esc(initials(user.full_name||"iB"))}</div>`;
}
function taskProgressWidth(t){
  const s=t.status||"pendiente";
  if(["publicado"].includes(s))return 100;
  if(["aprobado"].includes(s))return 88;
  if(["en_revision","corregido"].includes(s))return 68;
  if(["en_proceso"].includes(s))return 42;
  if(["observado"].includes(s))return 55;
  return 18;
}

// ==== v6.6 HOME FUNCTIONAL LIQUID GLASS ====
let ibHomePreferences=null;
function homePreferenceKey(){return `inbestiga:home:v64:${member?.id||'guest'}`}
function homeDefaultPreferences(){return{theme:"porcelain",density:"comfortable",widgets:{campaigns:true,activity:true,team:true,social:true}}}
function homeLoadPreferences(){if(ibHomePreferences)return ibHomePreferences;try{const raw=localStorage.getItem(homePreferenceKey());ibHomePreferences={...homeDefaultPreferences(),...(raw?JSON.parse(raw):{})};ibHomePreferences.widgets={...homeDefaultPreferences().widgets,...(ibHomePreferences.widgets||{})}}catch(e){ibHomePreferences=homeDefaultPreferences()}return ibHomePreferences}
function homeSavePreferences(){try{localStorage.setItem(homePreferenceKey(),JSON.stringify(homeLoadPreferences()))}catch(e){}}
function homeApplyPreferences(){const root=$("home");if(!root)return;const p=homeLoadPreferences();root.dataset.homeTheme=p.theme||"porcelain";root.dataset.homeDensity=p.density||"comfortable";document.querySelectorAll("[data-home-theme-choice]").forEach(b=>b.classList.toggle("active",b.dataset.homeThemeChoice===p.theme));document.querySelectorAll("[data-home-density-choice]").forEach(b=>b.classList.toggle("active",b.dataset.homeDensityChoice===p.density));Object.entries(p.widgets||{}).forEach(([key,val])=>{const box=$("homeWidget"+key.charAt(0).toUpperCase()+key.slice(1));if(box)box.checked=val!==false;document.querySelectorAll(`[data-home-widget="${key}"]`).forEach(el=>el.classList.toggle("home-widget-hidden",val===false))})}
function homeSetTheme(theme){homeLoadPreferences().theme=theme;homeSavePreferences();homeApplyPreferences()}
function homeSetDensity(density){homeLoadPreferences().density=density;homeSavePreferences();homeApplyPreferences()}
function homeSetWidget(key,value){homeLoadPreferences().widgets[key]=!!value;homeSavePreferences();homeApplyPreferences()}
function homeResetPreferences(){ibHomePreferences=homeDefaultPreferences();homeSavePreferences();homeApplyPreferences();toast("Inicio restablecido")}
function homeToggleCreate(force){const menu=$("homeCreateMenu");if(!menu)return;const open=typeof force==="boolean"?force:!menu.classList.contains("open");menu.classList.toggle("open",open);menu.setAttribute("aria-hidden",String(!open))}
function homeToggleCustomize(force){const panel=$("homeCustomizePanel"),scrim=$("homeCustomizeScrim");if(!panel||!scrim)return;const open=typeof force==="boolean"?force:!panel.classList.contains("open");panel.classList.toggle("open",open);scrim.classList.toggle("open",open);panel.setAttribute("aria-hidden",String(!open));if(open)homeApplyPreferences()}
function homeCreateAction(type){homeToggleCreate(false);if(type==="task"){navTo("tasks");setTimeout(()=>{if(typeof v413TogglePanel==="function")v413TogglePanel("v413CreateTaskPanel",true)},80)}else if(type==="campaign"){navTo("campaigns");setTimeout(()=>{if(typeof v413ShowCampaignForms==="function")v413ShowCampaignForms()},80)}else if(type==="board")navTo("creativeRoomsClean");else if(type==="post"){navTo("wall");setTimeout(()=>$("postText")?.focus(),80)}else if(type==="message")navTo("messages");else if(type==="asset"){navTo("assets");setTimeout(()=>$("assetName")?.focus(),80)}}
function homeLastSectionKey(){return `inbestiga:home:last-section:${member?.id||'guest'}`}
function homeLastSection(){try{return localStorage.getItem(homeLastSectionKey())||"myday"}catch(e){return"myday"}}
function homeOpenLastSection(){const section=homeLastSection();navTo($(section)?section:"myday")}
function homeRememberSection(section){if(!section||section==="home")return;try{localStorage.setItem(homeLastSectionKey(),section)}catch(e){}}
function homeOpenTask(id){if(typeof v412OpenTask==="function")v412OpenTask(id);else navTo("tasks")}
function homeOpenCampaign(id){if(typeof v413OpenCampaign==="function")v413OpenCampaign(id);else navTo("campaigns")}
function homeShortDate(value){if(!value)return"Sin fecha";try{return new Date(`${value}T12:00:00`).toLocaleDateString("es-PE",{day:"2-digit",month:"short"})}catch(e){return value}}
function homeRelativeTime(value){if(!value)return"Ahora";const ms=Date.now()-new Date(value).getTime(),min=Math.max(0,Math.round(ms/60000));if(min<1)return"Ahora";if(min<60)return`Hace ${min} min`;const h=Math.round(min/60);if(h<24)return`Hace ${h} h`;return`Hace ${Math.round(h/24)} d`}
function homeSectionTitle(id){return({myday:"Mi día",tasks:"Tareas",campaigns:"Campañas",editorial:"Editorial",calendarOps:"Calendario",creativeRoomsClean:"Creative Arena",hub:"Creative Hub",assets:"Archivos",wall:"Muro",messages:"Mensajes",profile:"Mi espacio",approvals:"Aprobaciones",workload:"Carga del equipo",workIntel:"Trabajo 360",reports:"Reportes",control:"Control gerencial"})[id]||"Mi día"}
function homeAvatarMarkup(user,cls="ib-home-person-avatar"){user=user||{};const src=user.avatar_data_url||user.avatar_url||user.photo_url||"",name=user.full_name||user.name||"Miembro",color=user.profile_color||"#0071e3";return`<span class="${cls}" style="--member-color:${esc(color)}">${src?`<img src="${esc(src)}" alt="">`:esc(initials(name))}</span>`}
function homeTaskListItem(t,index){const late=v412TaskOverdue(t),client=nameOf(state.clients,t.client_id)||"Sin cliente",meta=`${client} · ${memberName(t.assigned_to)} · ${homeShortDate(t.due_date)}`;return`<button type="button" class="ib-home-list-item" onclick="homeOpenTask('${esc(t.id)}')"><span class="ib-home-list-index">${String(index+1).padStart(2,"0")}</span><span class="ib-home-list-copy"><strong>${esc(t.title||"Tarea")}</strong><span>${esc(meta)}</span></span><span class="ib-home-list-status ${late?"late":""}">${late?"Vencida":esc((t.status||"Pendiente").replaceAll("_"," "))}</span></button>`}
function homeRiskItem(kind,title,meta,action,tone="warning"){return`<div class="ib-home-risk-item ${tone}"><span class="ib-home-risk-dot"></span><div class="ib-home-risk-copy"><strong>${esc(title)}</strong><span>${esc(meta)}</span></div><button type="button" onclick="${action}">Abrir</button></div>`}
function renderHome(){
  document.body.classList.add("ib-home-mode");
  syncHomeClock();
  const supervisor=isSupervisor(),tasks=(state.tasks||[]).slice(),open=tasks.filter(t=>!v412TaskDone(t)),mine=open.filter(t=>t.assigned_to===member.id),late=open.filter(t=>v412TaskOverdue(t)),myLate=mine.filter(t=>v412TaskOverdue(t)),approvals=tasks.filter(t=>["en_revision","observado","corregido"].includes(v412StatusKey(t.status))||["validado_alejandro","validado_jhulio","observado"].includes(v412StatusKey(t.approval_status))),campaigns=(state.campaigns||[]).filter(c=>!["finalizada","archivada"].includes(v412StatusKey(c.status))),posts=activePosts().slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)),perf=typeof getMemberPerformance==="function"?getMemberPerformance(member.id):{level:1,levelProgress:0,score360:0,xp:0},rank=typeof v411Rank==="function"?v411Rank(perf.level||1):"Iniciado",now=Date.now();
  const todayTasks=(supervisor?open:mine).slice().sort((a,b)=>{const al=v412TaskOverdue(a),bl=v412TaskOverdue(b);if(al!==bl)return al?-1:1;return String(a.due_date||"9999").localeCompare(String(b.due_date||"9999"))}).slice(0,5);
  const riskyCampaigns=campaigns.filter(c=>(state.tasks||[]).some(t=>t.campaign_id===c.id&&v412TaskOverdue(t)));
  const onlineMembers=(state.members||[]).filter(m=>{const p=(state.live_presence||[]).find(x=>x.member_id===m.id);const seen=p?new Date(p.updated_at||p.last_seen_at).getTime():0;return seen&&(now-seen)<90000});
  const unread=(typeof unreadMessages==="function"?unreadMessages():[])||[];
  const first=(member.full_name||"Equipo").split(/\s+/)[0];
  const date=new Date();
  if($("homeDateLabel"))$("homeDateLabel").textContent=date.toLocaleDateString("es-PE",{weekday:"long",day:"2-digit",month:"long"});
  if($("homeHeroTitle"))$("homeHeroTitle").innerHTML=supervisor?`Buenos días, ${esc(first)}.<br><span>Todo bajo control.</span>`:`Buenos días, ${esc(first)}.<br><span>Este es tu momento.</span>`;
  if($("homeHeroSubtitle"))$("homeHeroSubtitle").textContent=supervisor?"Una lectura ejecutiva de prioridades, riesgos, campañas y decisiones que requieren atención.":"Tus tareas, proyectos, mensajes y accesos recientes organizados para que avances sin distracciones.";
  const area=(state.areas||[]).find(a=>String(a.id)===String(member.area_id));
  if($("homeMemberAvatar"))$("homeMemberAvatar").innerHTML=(member.avatar_data_url||member.avatar_url)?`<img src="${esc(member.avatar_data_url||member.avatar_url)}" alt="Foto de ${esc(member.full_name||"miembro")}">`:esc(initials(member.full_name||"iB"));
  if($("homeMemberArea"))$("homeMemberArea").textContent=(area?.name||member.area_name||"EQUIPO").toUpperCase();
  if($("homeMemberName"))$("homeMemberName").textContent=member.full_name||"Miembro";
  if($("homeMemberRole"))$("homeMemberRole").textContent=roleLabel();
  if($("homeMemberLevel"))$("homeMemberLevel").textContent=perf.level||1;
  if($("homeMemberRank"))$("homeMemberRank").textContent=rank;
  if($("homeMemberScore"))$("homeMemberScore").textContent=perf.score360||0;
  const xpPct=Math.max(0,Math.min(100,Number(perf.levelProgress)||0));if($("homeMemberXpFill"))$("homeMemberXpFill").style.width=`${xpPct}%`;if($("homeMemberXpText"))$("homeMemberXpText").textContent=`${Math.round(xpPct)}%`;
  const summaryParts=[];const personalOpen=supervisor?open.length:mine.length;if(personalOpen)summaryParts.push(`${personalOpen} tarea${personalOpen===1?"":"s"} abierta${personalOpen===1?"":"s"}`);if(approvals.length)summaryParts.push(`${approvals.length} aprobación${approvals.length===1?"":"es"}`);if(unread.length)summaryParts.push(`${unread.length} mensaje${unread.length===1?"":"s"} nuevo${unread.length===1?"":"s"}`);if($("homeMemberSummary"))$("homeMemberSummary").textContent=summaryParts.length?`Tienes ${summaryParts.join(", ")}.`:"No tienes pendientes críticos en este momento.";
  if($("homeLiveStatus"))$("homeLiveStatus").innerHTML=`<i></i> ${realtimeAvailable?"Realtime activo":"Sincronización disponible"}`;
  if($("homeMetricToday"))$("homeMetricToday").textContent=todayTasks.length;if($("homeMetricApprovals"))$("homeMetricApprovals").textContent=approvals.length;if($("homeMetricRisks"))$("homeMetricRisks").textContent=supervisor?late.length+riskyCampaigns.length:myLate.length;if($("homeMetricOnline"))$("homeMetricOnline").textContent=onlineMembers.length;
  if($("homeNotificationBadge")){const count=unread.length+(state.notifications||[]).filter(n=>!n.read_at).length;$("homeNotificationBadge").textContent=count;$("homeNotificationBadge").style.display=count?"block":"none"}
  if($("homeTodayList"))$("homeTodayList").innerHTML=todayTasks.map(homeTaskListItem).join("")||`<div class="ib-home-empty"><div><strong>Tu agenda está despejada.</strong><br><span>No hay tareas abiertas que requieran atención inmediata.</span></div></div>`;
  const riskItems=[];late.slice(0,3).forEach(t=>riskItems.push(homeRiskItem("task",t.title,`Venció ${homeShortDate(t.due_date)} · ${memberName(t.assigned_to)}`,`homeOpenTask('${esc(t.id)}')`,"danger")));approvals.slice(0,2).forEach(t=>riskItems.push(homeRiskItem("approval",t.title,`Esperando revisión · ${memberName(t.assigned_to)}`,`homeOpenTask('${esc(t.id)}')`)));riskyCampaigns.slice(0,2).forEach(c=>riskItems.push(homeRiskItem("campaign",c.name,`${nameOf(state.clients,c.client_id)||"Sin cliente"} · campaña en riesgo`,`homeOpenCampaign('${esc(c.id)}')`,"danger")));
  if($("homeRiskCount"))$("homeRiskCount").textContent=riskItems.length;if($("homeRiskList"))$("homeRiskList").innerHTML=riskItems.slice(0,5).join("")||`<div class="ib-home-empty"><div><strong>Todo avanza con normalidad.</strong><br><span>No se detectaron vencimientos ni decisiones urgentes.</span></div></div>`;
  const last=homeLastSection(),lastTitle=homeSectionTitle(last),recentTask=(supervisor?open:mine).slice().sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at))[0],recentCampaign=campaigns.slice().sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at))[0];
  const continueCards=[{icon:"↗",label:"Último módulo",title:lastTitle,meta:"Retoma exactamente el espacio que abriste por última vez.",accent:"#0071e3",action:`navTo('${esc(last)}')`},{icon:"✓",label:"Tarea activa",title:recentTask?.title||"Revisa tu agenda",meta:recentTask?`${memberName(recentTask.assigned_to)} · ${homeShortDate(recentTask.due_date)}`:"Abre Mi día para organizar tus prioridades.",accent:"#30a46c",action:recentTask?`homeOpenTask('${esc(recentTask.id)}')`:`navTo('myday')`},{icon:"◉",label:"Campaña",title:recentCampaign?.name||"Campañas activas",meta:recentCampaign?`${nameOf(state.clients,recentCampaign.client_id)||"Sin cliente"} · ${recentCampaign.status||"planificación"}`:"Consulta proyectos, briefs y entregables.",accent:"#bf5af2",action:recentCampaign?`homeOpenCampaign('${esc(recentCampaign.id)}')`:`navTo('campaigns')`},{icon:"✦",label:"Espacio creativo",title:"Creative Arena",meta:"Pizarra, storyboard, comentarios y colaboración visual.",accent:"#ff9f0a",action:"navTo('creativeRoomsClean')"}];
  if($("homeContinueGrid"))$("homeContinueGrid").innerHTML=continueCards.map(c=>`<button type="button" class="ib-home-continue-card" style="--card-accent:${c.accent}" onclick="${c.action}"><span class="ib-home-continue-icon">${c.icon}</span><div><small>${esc(c.label)}</small><strong>${esc(c.title)}</strong><span>${esc(c.meta)}</span></div></button>`).join("");
  if($("homeContinuePrimary"))$("homeContinuePrimary").textContent=`Continuar en ${lastTitle}`;
  if($("homeCampaignGrid"))$("homeCampaignGrid").innerHTML=campaigns.slice(0,6).map(c=>{const ct=tasks.filter(t=>t.campaign_id===c.id),done=ct.filter(v412TaskDone),clate=ct.filter(t=>v412TaskOverdue(t)),progress=ct.length?Math.round(done.length*100/ct.length):0;return`<button type="button" class="ib-home-campaign-card" onclick="homeOpenCampaign('${esc(c.id)}')"><div class="ib-home-campaign-top"><span class="ib-home-campaign-orb"></span><span class="ib-home-campaign-state ${clate.length?"risk":""}">${clate.length?`${clate.length} en riesgo`:esc(c.status||"Activa")}</span></div><div><h3>${esc(c.name||"Campaña")}</h3><p>${esc(c.objective||nameOf(state.clients,c.client_id)||"Proyecto activo del equipo")}</p></div><div class="ib-home-campaign-progress"><div><span>Progreso</span><b>${progress}%</b></div><div class="ib-home-campaign-track"><i style="width:${progress}%"></i></div></div><div class="ib-home-campaign-meta"><span>${ct.length} tareas</span><span>${nameOf(state.clients,c.client_id)||"Sin cliente"}</span></div></button>`}).join("")||`<div class="ib-home-empty" style="grid-column:1/-1"><div><strong>No hay campañas activas.</strong><br><span>Crea una campaña para verla en este centro de mando.</span></div></div>`;
  const activity=[...(state.live_events||[]).map(e=>({icon:"◎",title:e.title||e.event_type||"Actividad",meta:`${memberName(e.actor_id)} · ${e.body||"Actualización del equipo"}`,date:e.created_at})),...tasks.slice().sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at)).slice(0,5).map(t=>({icon:"✓",title:t.title,meta:`${memberName(t.assigned_to)} · ${(t.status||"pendiente").replaceAll("_"," ")}`,date:t.updated_at||t.created_at}))].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,7);
  if($("homeActivityList"))$("homeActivityList").innerHTML=activity.map(a=>`<div class="ib-home-activity-item"><span class="ib-home-activity-icon">${a.icon}</span><div class="ib-home-activity-copy"><strong>${esc(a.title||"Actividad")}</strong><span>${esc(a.meta||"")}</span></div><time>${homeRelativeTime(a.date)}</time></div>`).join("")||`<div class="ib-home-empty">Todavía no hay actividad reciente.</div>`;
  if($("homeTeamGrid"))$("homeTeamGrid").innerHTML=(state.members||[]).slice(0,10).map(m=>{const p=(state.live_presence||[]).find(x=>x.member_id===m.id),seen=p?new Date(p.updated_at||p.last_seen_at).getTime():0,online=seen&&(now-seen)<90000;return`<button type="button" class="ib-home-person" onclick="openMemberProfile('${esc(m.id)}')">${homeAvatarMarkup(m)}<span class="ib-home-person-copy"><strong>${esc(m.full_name||"Miembro")}</strong><span>${esc(online?(p?.current_section||"En línea"):(m.position||m.role_code||"Ausente"))}</span></span><i class="ib-home-person-status ${online?"online":""}"></i></button>`}).join("")||`<div class="ib-home-empty" style="grid-column:1/-1">No hay miembros registrados.</div>`;
  if($("homeSocialPreview"))$("homeSocialPreview").innerHTML=posts.slice(0,3).map(p=>{const u=by(state.members,p.author_id)||{},dateLabel=p.created_at?new Date(p.created_at).toLocaleDateString("es-PE",{day:"2-digit",month:"short"}):"";return`<article class="ib-home-social-card"><div class="ib-home-social-author">${homeAvatarMarkup(u,"mini-avatar")}<div><strong>${esc(u.full_name||"Miembro")}</strong><span>${esc(dateLabel)}</span></div></div><p>${esc((p.text_content||"Publicación del equipo").slice(0,260))}</p>${imgSrc(p.image_url)?`<img src="${esc(p.image_url)}" alt="Publicación del equipo">`:""}<div class="ib-home-social-foot"><span>${(state.post_reactions||[]).filter(r=>r.post_id===p.id).length} reacciones</span><button type="button" onclick="navTo('wall')">Ver publicación</button></div></article>`}).join("")||`<div class="ib-home-empty" style="grid-column:1/-1">Todavía no hay publicaciones recientes.</div>`;
  homeApplyPreferences();
}


function renderHomeFeedPreferences(){
  const p=state.home_feed_preferences||{};
  if($("homeShowSocial"))$("homeShowSocial").value=String(p.show_social_feed??true);
  if($("homeShowProgress"))$("homeShowProgress").value=String(p.show_progress_feed??true);
  if($("homeShowTeam"))$("homeShowTeam").value=String(p.show_live_team??true);
}
async function saveHomeFeedPreferences(){
  try{
    const {error}=await sb.rpc("ibm_v35_update_home_feed_preferences",{
      p_show_social_feed:safeVal("homeShowSocial")==="true",
      p_show_progress_feed:safeVal("homeShowProgress")==="true",
      p_show_live_team:safeVal("homeShowTeam")==="true",
      p_home_density:"comfortable"
    });
    if(error)throw error;
    toast("Inicio actualizado");
    await loadAll();renderHomeFeedPreferences();renderHome();
  }catch(err){toast("No se pudo guardar inicio",err.message)}
}


// ==== v3.5.9.4 Schedule Context Clean ====
let currentProfileMemberId=null;

function profileSrc(user,kind){
  if(!user)return "";
  return kind==="avatar" ? (user.avatar_data_url||imgSrc(user.avatar_url)) : (user.cover_data_url||imgSrc(user.cover_url));
}
function originalPost(post){
  return post?.original_post_id ? by(state.posts, post.original_post_id) : null;
}
function renderInlinePost(post){
  if(!post) return "";
  const u=by(state.members,post.author_id);
  return `<div class="repost-box"><div class="repost-label">Publicación original de ${esc(u.full_name||"Usuario")}</div>${post.text_content?`<div>${esc(post.text_content)}</div>`:""}${imgSrc(post.image_url)?`<img class="home-post-img" src="${post.image_url}">`:""}<span class="small">${post.created_at?new Date(post.created_at).toLocaleString("es-PE"):""}</span></div>`;
}
async function openMemberProfile(memberId){
  currentProfileMemberId=memberId;
  try{await sb.rpc("ibm_v352_visit_member_profile",{p_visited_member_id:memberId})}catch(e){}
  try{await v418EnsurePreferences(memberId)}catch(e){}
  navTo("memberProfile");
  renderMemberProfile();
}
function messageMember(memberId){
  if(!memberId || memberId===member.id){navTo("messages");return}
  navTo("messages");
  setTimeout(()=>{if($("msgTo"))$("msgTo").value=memberId;if($("msgText")){ $("msgText").focus(); $("msgText").placeholder="Escribe a "+memberName(memberId)+"..." }},50);
}
function renderMemberProfile(){
  const user=by(state.members,currentProfileMemberId||member.id);
  if(!user?.id)return;
  const prefs=v418Current(user.id);v418ApplyScope("memberProfile",prefs);
  if($("memberProfileCard360"))$("memberProfileCard360").innerHTML=renderProfileCard360(user.id,{context:"member",preferences:prefs});
  if($("memberWallTitle"))$("memberWallTitle").textContent="Muro de "+(user.full_name||"miembro");
  if($("messageMemberBtn2"))$("messageMemberBtn2").onclick=()=>messageMember(user.id);
  const posts=(typeof activePosts==="function"?activePosts():(state.posts||[])).filter(p=>p.author_id===user.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const performance=getMemberPerformance(user.id);
  if($("memberProfileStats"))$("memberProfileStats").innerHTML=[["Publicaciones",performance.posts],["Tareas activas",performance.open],["Completadas",performance.done],["Score 360",performance.score360]].map(x=>`<div class="profile-stat"><span class="small">${esc(x[0])}</span><br><strong>${esc(x[1])}</strong></div>`).join("");
  if($("memberProfileFeed"))$("memberProfileFeed").innerHTML=posts.map(p=>renderSocialPost(p)).join("")||`<div class="home-empty"><strong>Aún no hay publicaciones.</strong><p>Cuando ${esc(user.full_name||"este miembro")} publique, aparecerá aquí.</p></div>`;
}


let v413ApprovalFilter="all";
function renderApprovals(){
  const all=(state.tasks||[]).filter(t=>["en_revision","observado","corregido"].includes(v412StatusKey(t.status))||["pendiente_alejandro","validado_alejandro","validado_jhulio","observado"].includes(t.approval_status));
  const observed=all.filter(t=>v412StatusKey(t.status)==="observado"||t.approval_status==="observado"),mine=all.filter(t=>t.assigned_to===member.id),review=all.filter(t=>["en_revision","corregido"].includes(v412StatusKey(t.status)));
  if($("v413ApprovalSummary"))$("v413ApprovalSummary").innerHTML=[["En cola",all.length],["Por revisar",review.length],["Observadas",observed.length],["Mis entregas",mine.length]].map(x=>`<div><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
  const visible=v413ApprovalFilter==="review"?review:v413ApprovalFilter==="observed"?observed:v413ApprovalFilter==="mine"?mine:all;
  if(!$("approvalList"))return;
  $("approvalList").innerHTML=visible.map(t=>{
    const a1=!!t.reviewed_by_alejandro,a2=!!t.approved_by_jhulio,a3=!!t.approved_by_italo;
    const hist=(state.approval_history||[]).filter(h=>h.task_id===t.id).sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||""))).slice(0,5);
    const isObserved=v412StatusKey(t.status)==="observado"||t.approval_status==="observado";
    return `<div class="v413-approval-card ${isObserved?'observed':''}"><div class="module-title"><div><span class="v413-eyebrow">${esc(nameOf(state.campaigns,t.campaign_id)||nameOf(state.clients,t.client_id)||"SIN PROYECTO")}</span><h3>${esc(t.title)}</h3><span class="small">${esc(memberName(t.assigned_to))} · entrega ${esc(v412DateLabel(t.due_date))}</span></div><span class="status ${isObserved?'red':'orange'}">${esc(t.approval_status||t.status)}</span></div><div class="approval-flow"><div class="approval-step done">Equipo<br><span class="small">Entregado</span></div><div class="approval-step ${a1?'done':'current'}">Alejandro<br><span class="small">${a1?'Validado':'Pendiente'}</span></div><div class="approval-step ${a2?'done':(a1?'current':'')}">JHULIO<br><span class="small">${a2?'Validado':'Pendiente'}</span></div><div class="approval-step ${a3?'done':(a2?'current':'')}">ITALO<br><span class="small">${a3?'Aprobado':'Pendiente'}</span></div></div>${t.evidence_url?`<div class="v413-evidence-link"><div><span class="small">EVIDENCIA</span><br><strong>Entrega disponible</strong></div><a class="ghost" target="_blank" rel="noopener" href="${esc(t.evidence_url)}">Abrir</a></div>`:""}${hist.length?`<div class="v413-history" style="margin-top:12px">${hist.map(h=>`<div class="v413-history-row"><i class="v413-history-dot"></i><div><strong>${esc(h.actor_role||memberName(h.actor_id)||"Revisión")} · ${esc(h.decision||h.new_status||"")}</strong><p>${esc(h.comment||"")}</p><time>${h.created_at?new Date(h.created_at).toLocaleString("es-PE"):""}</time></div></div>`).join("")}</div>`:""}<div class="btn-row" style="margin-top:14px"><button class="ghost" type="button" onclick="v412OpenTask('${t.id}')">Ver detalle</button><button class="primary" type="button" onclick="reviewTask('${t.id}','validate')">Validar</button><button class="ghost" type="button" onclick="reviewTask('${t.id}','observe')">Observar</button></div></div>`;
  }).join("")||"<div class='panel'>No hay tareas en esta cola.</div>";
  document.querySelectorAll("[data-approval-filter]").forEach(btn=>btn.classList.toggle("active",btn.dataset.approvalFilter===v413ApprovalFilter));
}
function renderAdmin(){
  safeOptions("adminUserSelect",'<option value="">Nuevo usuario</option>'+(state.members||[]).map(m=>`<option value="${m.id}">${esc(m.full_name)} ${m.auth_user_id?'':''}</option>`).join(""));
  $("auditList").innerHTML=`<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Entidad</th></tr></thead><tbody>${(state.audit_logs||[]).slice(0,150).map(a=>`<tr><td>${new Date(a.created_at).toLocaleString("es-PE")}</td><td>${esc(memberName(a.actor_id))}</td><td>${esc(a.action)}</td><td>${esc(a.entity_type||"")}</td></tr>`).join("")}</tbody></table></div>`;
  $("systemHealth").innerHTML=`<div class="grid4"><div class="metric"><span class="small">Usuarios</span><br><strong>${state.members.length}</strong></div><div class="metric"><span class="small">Con login</span><br><strong>${state.members.filter(m=>m.auth_user_id).length}</strong></div><div class="metric"><span class="small">Falta vincular</span><br><strong>${state.members.filter(m=>!m.auth_user_id).length}</strong></div><div class="metric"><span class="small">Sesión</span><br><strong>Activa</strong></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Login</th></tr></thead><tbody>${state.members.map(m=>`<tr><td>${esc(m.full_name)}</td><td>${esc(m.email)}</td><td>${esc(m.role_code)}</td><td><span class="login-status ${m.auth_user_id?'ok':'warn'}">${m.auth_user_id?'Puede ingresar':'Falta vincular Auth'}</span></td></tr>`).join("")}</tbody></table></div>`;
}


// ==== v3.5.9.4 Schedule Context Clean overrides ====
async function reviewTask(id,decision){
  const task=by(state.tasks,id);
  const isObserve=decision==="observe";
  const comment=await premiumInputModal({
    title:isObserve?"Observar tarea":"Validar tarea",
    subtitle:isObserve?"Indica con claridad qué debe corregirse.":"Agrega un comentario breve para el historial.",
    icon:isObserve?"":"🛡️",
    label:isObserve?"Observación obligatoria":"Comentario",
    placeholder:isObserve?"Ej: Corregir copy, formato o evidencia…" : "Ej: Validado por mi revisión…",
    preview:`<strong>${esc(task.title||"Tarea")}</strong><p>${esc((task.description||"").slice(0,220))}</p>`,
    confirmLabel:isObserve?"Enviar observación":"Validar según mi rol",
    required:isObserve
  });
  if(comment===null)return;
  try{
    const {error}=await sb.rpc("ibm_v32_review_task",{p_task_id:id,p_decision:decision,p_comment:comment});
    if(error)throw error;
    premiumToast("Revisión registrada",isObserve?"La observación fue enviada.":"La tarea fue validada según tu rol.","success");
    await loadAll();await renderAll();
  }catch(err){premiumToast("No se pudo revisar",err.message,"error")}
}
async function assetApprove(id,decision){
  const asset=by(state.assets,id);
  const isApprove=decision==="approve";
  const comment=await premiumInputModal({
    title:isApprove?"Aprobar archivo":"Observar archivo",
    subtitle:isApprove?"Confirma la aprobación del entregable.":"Explica qué debe corregirse.",
    icon:isApprove?"":"",
    label:isApprove?"Comentario opcional":"Observación",
    placeholder:isApprove?"Aprobado para uso interno…" : "Indica la corrección necesaria…",
    preview:`<strong>${esc(asset.name||"Archivo")}</strong><p>${esc((asset.notes||"").slice(0,180))}</p>`,
    confirmLabel:isApprove?"Aprobar archivo":"Enviar observación",
    required:!isApprove
  });
  if(comment===null)return;
  try{
    const {error}=await sb.rpc("ibm_v31_asset_approval",{p_asset_id:id,p_decision:decision,p_comment:comment});
    if(error)throw error;
    premiumToast("Archivo actualizado",isApprove?"Archivo aprobado.":"Observación enviada.","success");
    await loadAll();renderAssets();
  }catch(err){premiumToast("No se pudo actualizar archivo",err.message,"error")}
}


// ==== v3.5.9.4 Schedule Context Clean ====
function activePosts(){
  return (state.posts||[]).filter(p=>!p.post_status || p.post_status==="active");
}
function myTrashedPosts(){
  return (state.posts||[]).filter(p=>p.author_id===member.id && p.post_status==="trashed");
}
function updateTrashBadge(){
  const n=myTrashedPosts().length;
  if($("trashCountMini")){$("trashCountMini").textContent=n;$("trashCountMini").style.display=n?"inline-block":"none"}
}
async function restoreOwnPost(postId){
  const ok=await premiumConfirmModal({
    title:"Restaurar publicación",
    subtitle:"La publicación volverá a aparecer en el muro.",
    icon:"",
    confirmLabel:"Restaurar",
    cancelLabel:"Cancelar"
  });
  if(!ok)return;
  try{
    const {error}=await sb.rpc("ibm_v354_restore_own_wall_post",{p_post_id:postId});
    if(error)throw error;
    premiumToast("Publicación restaurada","Ya vuelve a aparecer en el muro.","success");
    await safeSync("restore_post");
    renderSocialTrash();
  }catch(err){premiumToast("No se pudo restaurar",err.message,"error")}
}
function daysLeftTrash(post){
  if(!post.deleted_at)return 15;
  const deleted=new Date(post.deleted_at).getTime();
  const elapsed=Math.floor((Date.now()-deleted)/(1000*60*60*24));
  return Math.max(0,15-elapsed);
}
function renderSocialTrash(){
  updateTrashBadge();
  if(!$("socialTrashList"))return;
  const list=myTrashedPosts().sort((a,b)=>new Date(b.deleted_at||b.created_at)-new Date(a.deleted_at||a.created_at));
  $("socialTrashList").innerHTML=list.map(p=>{
    const left=daysLeftTrash(p);
    return `<article class="trash-card">
      <div class="trash-card-head"><span class="status red">Eliminada</span><div><strong>${esc((p.text_content||"Publicación sin texto").slice(0,90))}</strong><br><span class="small">Quedan ${left} días en tu basurero</span></div></div>
      ${p.text_content?`<div class="trash-card-body">${esc(p.text_content)}</div>`:""}
      ${imgSrc(p.image_url)?`<img class="trash-card-img" src="${p.image_url}">`:""}
      <div class="trash-card-actions"><button class="primary" onclick="restoreOwnPost('${p.id}')"> Restaurar</button><button class="ghost" onclick="navTo('wall')">Ver muro</button></div>
    </article>`;
  }).join("")||`<div class="home-empty"><strong>Tu basurero está limpio.</strong><p>Cuando elimines una publicación propia, aparecerá aquí por 15 días.</p></div>`;
}
// ==== v3.5.9.4 Schedule Context Clean overrides ====
function premiumIcon(type){return "•"}
function minimalLabel(text){
  return String(text||"").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,"").replace(/\s+/g," ").trim();
}
function cleanMinimalUI(){
  document.querySelectorAll(".nav button,.social-action-row button,.post-actions button,.premium-modal-actions button,.home-floating-action button,.btn-row button").forEach(btn=>{
    if(btn.dataset.cleanedMinimal==="1")return;
    btn.innerHTML=minimalLabel(btn.textContent);
    btn.dataset.cleanedMinimal="1";
  });
}
function renderSocialPost(post, opts={}){
  if(post.post_status && post.post_status!=="active") return "";
  const u=by(state.members,post.author_id);
  const comms=commentsFor("wall_post",post.id).length;
  const reacts=Object.values(reactionsFor("wall_post",post.id)).reduce((a,b)=>a+b,0);
  const original=originalPost(post);
  const mine=post.author_id===member.id;
  return `<article class="home-post">
    <div class="home-post-head clickable-person" onclick="openMemberProfile('${post.author_id}')">
      ${miniAvatarSync(u,"avatar")}
      <div style="flex:1"><strong>${esc(u.full_name||"Usuario")}</strong><br><span class="small">${new Date(post.created_at).toLocaleString("es-PE")} · ${esc(u.position||u.role_code||"")}</span></div>
      ${mine?`<span class="post-owned-badge">Mi publicación</span>`:""}
    </div>
    ${post.text_content?`<div class="home-post-body">${esc(post.text_content)}</div>`:""}
    ${original?renderInlinePost(original):""}
    ${imgSrc(post.image_url)?`<img class="home-post-img" src="${post.image_url}">`:""}
    <div class="home-post-foot"><span>${reacts} reacciones</span><span>${comms} comentarios</span></div>
    <div class="social-action-row">
      <button onclick="react('wall_post','${post.id}','like')">Reaccionar</button>
      <button onclick="quickComment('${post.id}')">Comentar</button>
      <button onclick="repostWallPost('${post.id}')">Repostear</button>
      <button onclick="messageMember('${post.author_id}')">Mensaje</button>
      <button onclick="openMemberProfile('${post.author_id}')">Ver muro</button>
      ${mine?`<button class="danger" onclick="deleteOwnPost('${post.id}')">Eliminar</button>`:""}
    </div>
  </article>`;
}
async function quickComment(postId){
  const post=by(state.posts,postId);
  const u=by(state.members,post?.author_id);
  const preview=`<strong>${esc(u.full_name||"Usuario")}</strong><p>${esc((post?.text_content||"").slice(0,180))}</p>`;
  const text=await premiumInputModal({
    title:"Comentar publicación",
    subtitle:"Tu comentario aparecerá debajo del post.",
    icon:"•",
    label:"Comentario",
    placeholder:"Escribe un comentario claro y útil…",
    preview,
    confirmLabel:"Publicar comentario",
    required:true
  });
  if(text===null)return;
  try{
    const {error}=await sb.rpc("ibm_v30_create_comment",{p_entity_type:"wall_post",p_entity_id:postId,p_text_content:text.trim()});
    if(error)throw error;
    premiumToast("Comentario publicado","Tu comentario ya aparece en el muro.","success");
    await safeSync("quick_comment");
  }catch(err){premiumToast("No se pudo comentar",err.message,"error")}
}
async function repostWallPost(postId){
  const post=by(state.posts,postId);
  const u=by(state.members,post?.author_id);
  const preview=`<strong>Publicación original de ${esc(u.full_name||"Usuario")}</strong><p>${esc((post?.text_content||"").slice(0,220))}</p>`;
  const comment=await premiumInputModal({
    title:"Repostear publicación",
    subtitle:"Comparte esta publicación en el muro interno con un comentario.",
    icon:"•",
    label:"Comentario del repost",
    placeholder:"Agrega tu comentario al repost…",
    preview,
    confirmLabel:"Publicar repost",
    cancelLabel:"Cancelar"
  });
  if(comment===null)return;
  try{
    const {error}=await sb.rpc("ibm_v352_repost_wall_post",{p_original_post_id:postId,p_comment:comment});
    if(error)throw error;
    premiumToast("Repost publicado","La publicación fue compartida en el muro interno.","success");
    await safeSync("repost");
    if(currentSection==="memberProfile")renderMemberProfile();
  }catch(err){premiumToast("No se pudo repostear",err.message,"error")}
}
async function deleteOwnPost(postId){
  const post=by(state.posts,postId);
  if(!post || post.author_id!==member.id){
    premiumToast("No permitido","Solo puedes eliminar tus propias publicaciones.","warning");
    return;
  }
  const preview=`<strong>${esc((post.text_content||"Publicación sin texto").slice(0,160))}</strong><p>La publicación irá a tu basurero privado durante 15 días.</p>`;
  const ok=await premiumConfirmModal({
    title:"Eliminar publicación",
    subtitle:"Solo tú tienes potestad sobre tu muro. Nadie más podrá eliminar esta publicación por ti.",
    icon:"•",
    preview,
    confirmLabel:"Enviar a mi basurero",
    cancelLabel:"Cancelar"
  });
  if(!ok)return;
  try{
    const {error}=await sb.rpc("ibm_v354_trash_own_wall_post",{p_post_id:postId,p_reason:"Eliminado por el autor"});
    if(error)throw error;
    premiumToast("Publicación enviada al basurero","Puedes restaurarla durante 15 días.","success");
    await safeSync("trash_post");
    renderSocialTrash();
  }catch(err){premiumToast("No se pudo eliminar",err.message,"error")}
}
function renderV355(){setTimeout(cleanMinimalUI,60)}


// ==== v3.5.9.4 Schedule Context Clean ====
let selectedWorkMemberId=null;
function workProfile(memberId){return (state.member_work_profiles||[]).find(x=>x.member_id===memberId)||{}}
function timeEvents(memberId){return (state.member_time_events||[]).filter(x=>x.member_id===memberId)}
function workLinks(memberId){return (state.member_work_links||[]).filter(x=>x.member_id===memberId)}
function memberTasks(memberId){return (state.tasks||[]).filter(t=>t.assigned_to===memberId)}
function completedTasks(memberId){return memberTasks(memberId).filter(v412TaskDone)}
function openTasks(memberId){return memberTasks(memberId).filter(t=>!v412TaskDone(t))}
function lateTasks(memberId){return openTasks(memberId).filter(t=>v412TaskOverdue(t))}
function qualityAvg(memberId){
  const qs=memberTasks(memberId).map(t=>Number(t.quality||0)).filter(Boolean);
  return qs.length?(qs.reduce((a,b)=>a+b,0)/qs.length).toFixed(1):"0.0";
}
function punctuality(memberId){
  const ts=memberTasks(memberId);
  if(!ts.length)return 100;
  const late=ts.filter(t=>v412TaskOverdue(t)).length;
  return Math.max(0,Math.round(100-(late/ts.length)*100));
}
function fairScoreMember(memberId){
  return memberTasks(memberId).reduce((a,t)=>a+score(t),0);
}
function taskWidthStatus(t){
  const s=t.status||"pendiente";
  if(s==="publicado")return 100;
  if(s==="aprobado")return 90;
  if(s==="en_revision")return 70;
  if(s==="corregido")return 65;
  if(s==="observado")return 50;
  if(s==="en_proceso")return 42;
  return 18;
}
function selectWorkMember(id){
  selectedWorkMemberId=id;
  renderWorkIntel();
}
function renderWorkIntel(){
  if(!$("workMemberList"))return;
  const supervisor=isSupervisor();
  if(!selectedWorkMemberId)selectedWorkMemberId=supervisor?((state.members||[])[0]?.id||member.id):member.id;
  const selected=by(state.members,selectedWorkMemberId)||member;
  const norm=value=>v411Status(value);
  const doneStates=["aprobado","publicado","completado","completada","finalizado","finalizada","done","hecho"];
  const progressStates=["en_proceso","proceso","grabando","editando","diseño","diseno","programado"];
  const reviewStates=["revision","revisión","qa","aprobacion","aprobación","validacion","validación","en_revision"];
  $("workMemberList").innerHTML=(state.members||[]).filter(m=>m.status!=="inactive").map(m=>{
    const metrics=getMemberPerformance(m.id),active=m.id===selectedWorkMemberId,avatar=profileImg(m,"avatar")||profileSrc?.(m,"avatar")||"";
    return `<button type="button" class="member-float-card v411-member-row ${active?"active":""}" onclick="selectWorkMember('${m.id}')"><div class="mini-avatar" style="background:${esc(m.profile_color||'#6e26f6')}">${avatar?`<img src="${esc(avatar)}">`:esc(initials(m.full_name))}</div><div><strong>${esc(m.full_name)}</strong><span>${esc(m.position||m.role_code||"")}</span><div class="work360-mini-progress"><i style="width:${metrics.progress}%"></i></div></div><b>${metrics.progress}%</b></button>`;
  }).join("");
  const performance=getMemberPerformance(selected.id);
  $("workSelectedHeader").innerHTML=renderProfileCard360(selected.id,{context:"work"});
  const tasks=memberTasks(selected.id).slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const open=tasks.filter(t=>!v411Done(t)),done=tasks.filter(v411Done),late=tasks.filter(v411Late);
  const inProgress=tasks.filter(t=>progressStates.includes(norm(t.status)));
  const inReview=tasks.filter(t=>reviewStates.includes(norm(t.status)));
  const todo=tasks.filter(t=>!doneStates.includes(norm(t.status))&&!progressStates.includes(norm(t.status))&&!reviewStates.includes(norm(t.status))&&!v411Late(t));
  $("workKpis").innerHTML=[["Avance general",performance.progress+"%"],["Puntualidad",performance.punctuality+"%"],["Calidad",performance.quality+"%"],["Carga activa",performance.open],["Vencidas",performance.late]].map(x=>`<div class="work-kpi"><span class="small">${esc(x[0])}</span><strong>${esc(x[1])}</strong></div>`).join("");
  $("workSummary").innerHTML=`<div class="work360-focus-grid"><div class="work360-focus-card"><span class="small">Resumen ejecutivo</span><strong>${performance.progress}% de avance</strong><p>${performance.total?`${performance.done} tareas completadas de ${performance.total}.`:"Aún no tiene tareas registradas."}</p></div><div class="work360-focus-card"><span class="small">Foco actual</span><strong>${performance.open} tareas activas</strong><p>${inProgress.length} en proceso y ${inReview.length} en revisión.</p></div><div class="work360-focus-card"><span class="small">Riesgo / atención</span><strong>${performance.late} tareas vencidas</strong><p>${performance.late?"Prioriza el cierre de los pendientes vencidos.":"No hay retrasos críticos al momento."}</p></div></div><div class="chart-bars">${[["Tareas totales",performance.total,Math.min(100,performance.total*10)],["Completadas",performance.done,performance.progress],["En proceso",inProgress.length,performance.total?Math.round(inProgress.length*100/performance.total):0],["En revisión",inReview.length,performance.total?Math.round(inReview.length*100/performance.total):0],["Puntualidad",performance.punctuality,performance.punctuality]].map(r=>`<div class="chart-row"><span class="small">${esc(r[0])}</span><div class="chart-track"><span style="width:${r[2]}%"></span></div><strong>${esc(r[1])}</strong></div>`).join("")}</div>`;
  const boardCols=[["Por hacer",todo],["En proceso",inProgress],["En revisión",inReview],["Completadas",done],["Vencidas",late]];
  $("workKanbanBoard").innerHTML=`<div class="work360-kanban">${boardCols.map(([title,list])=>`<div class="work360-col"><div class="work360-col-head"><strong>${esc(title)}</strong><span>${list.length}</span></div>${list.length?list.slice(0,10).map(t=>`<div class="work360-task-chip ${v411Late(t)?"late":""}"><strong>${esc(t.title)}</strong><span>${esc(nameOf(state.clients,t.client_id)||"Sin cliente")} · ${esc(t.status||"pendiente")}</span>${t.due_date?`<small>Entrega: ${esc(t.due_date)}</small>`:""}</div>`).join(""):`<div class="home-empty">Sin elementos.</div>`}</div>`).join("")}</div>`;
  $("workTasksList").innerHTML=tasks.map(t=>`<div class="work-task-card ${v411Late(t)?"lime-detail":""}"><strong>${esc(t.title)}</strong><br><span class="small">${esc(nameOf(state.clients,t.client_id)||"Sin cliente")} · ${esc(t.status||"pendiente")} · ${esc(t.due_date||"sin fecha")}</span><div class="work-progress-line"><span style="width:${taskWidthStatus(t)}%"></span></div>${t.evidence_url?`<p><a href="${esc(t.evidence_url)}" target="_blank" rel="noopener">Abrir evidencia</a></p>`:""}</div>`).join("")||"<div class='home-empty'>Sin tareas registradas.</div>";
  $("workHistoryList").innerHTML=done.map(t=>`<div class="work-task-card"><strong>${esc(t.title)}</strong><br><span class="small">${esc(nameOf(state.clients,t.client_id)||"Sin cliente")} · calidad ${esc(t.quality||"sin calificar")}</span>${t.evidence_url?`<p><a href="${esc(t.evidence_url)}" target="_blank" rel="noopener">Ver trabajo realizado</a></p>`:""}</div>`).join("")||"<div class='home-empty'>Sin trabajos aprobados todavía.</div>";
  const wp=workProfile(selected.id);
  $("workProfileView").innerHTML=`<div class="schedule-mini"><div class="schedule-pill"><span class="small">Rol</span><br><strong>${esc(selected.position||selected.role_code||"No definido")}</strong></div><div class="schedule-pill"><span class="small">Modalidad</span><br><strong>${esc(wp.work_mode||"No configurado")}</strong></div><div class="schedule-pill"><span class="small">Horario</span><br><strong>${esc((wp.work_start||"--")+" - "+(wp.work_end||"--"))}</strong></div><div class="schedule-pill"><span class="small">Descanso</span><br><strong>${esc((wp.break_start||"--")+" - "+(wp.break_end||"--"))}</strong></div><div class="schedule-pill"><span class="small">Días</span><br><strong>${esc((wp.weekly_days||[]).join(", ")||"No definido")}</strong></div><div class="schedule-pill"><span class="small">Supervisor</span><br><strong>${esc(wp.supervisor_email||"No definido")}</strong></div></div>`;
  const posts=v411MemberPosts(selected.id).slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);
  $("workMemberPosts").innerHTML=posts.map(p=>`<div class="work-post-card"><strong>${esc((p.text_content||"Publicación").slice(0,70))}</strong><br><span class="small">${new Date(p.created_at).toLocaleString("es-PE")}</span>${imgSrc(p.image_url)?`<img class="home-post-img" src="${p.image_url}">`:""}</div>`).join("")||"<p class='small'>Sin publicaciones recientes.</p>";
  renderWorkLinksFor(selected.id);
  loadMyWorkProfileForm();
}

function renderWorkLinksFor(memberId){
  if(!$("workLinksList"))return;
  const links=workLinks(memberId);
  $("workLinksList").innerHTML=links.slice(0,10).map(l=>`<div class="work-link-card"><strong>${esc(l.title)}</strong><br><span class="small">${esc(l.link_type||"trabajo")}</span><p><a href="${esc(l.url)}" target="_blank">Abrir link</a></p></div>`).join("")||"<p class='small'>Sin links guardados.</p>";
}
function setWorkTab(tab){
  document.querySelectorAll(".work-tabbar button").forEach(b=>b.classList.toggle("active",b.dataset.worktab===tab));
  document.querySelectorAll(".work-subview").forEach(v=>v.classList.toggle("active",v.id==="worktab_"+tab));
}
function loadMyWorkProfileForm(){
  const wp=workProfile(member.id);
  if($("workMode"))$("workMode").value=wp.work_mode||"presencial";
  if($("workStart"))$("workStart").value=(wp.work_start||"09:00").slice(0,5);
  if($("workEnd"))$("workEnd").value=(wp.work_end||"18:00").slice(0,5);
  if($("breakStart"))$("breakStart").value=(wp.break_start||"13:00").slice(0,5);
  if($("breakEnd"))$("breakEnd").value=(wp.break_end||"14:00").slice(0,5);
  if($("weeklyDays"))$("weeklyDays").value=(wp.weekly_days||["lunes","martes","miércoles","jueves","viernes"]).join(",");
  if($("supervisorEmail"))$("supervisorEmail").value=wp.supervisor_email||"";
  if($("emergencyContact"))$("emergencyContact").value=wp.emergency_contact||"";
  if($("workNotes"))$("workNotes").value=wp.notes||"";
}
async function saveMyWorkProfile(e){
  e.preventDefault();
  try{
    const days=safeVal("weeklyDays").split(",").map(x=>x.trim()).filter(Boolean);
    const {error}=await sb.rpc("ibm_v356_upsert_my_work_profile",{
      p_work_mode:safeVal("workMode"),
      p_work_start:safeVal("workStart"),
      p_work_end:safeVal("workEnd"),
      p_break_start:safeVal("breakStart"),
      p_break_end:safeVal("breakEnd"),
      p_weekly_days:days,
      p_supervisor_email:safeVal("supervisorEmail"),
      p_emergency_contact:safeVal("emergencyContact"),
      p_notes:safeVal("workNotes")
    });
    if(error)throw error;
    premiumToast("Horario guardado","Tu perfil laboral fue actualizado.","success");
    await loadAll();renderWorkIntel();
  }catch(err){premiumToast("No se pudo guardar horario",err.message,"error")}
}
function buildPermissionEmail(){
  const type=safeVal("eventType"), title=safeVal("requestTitle")||("Solicitud de "+type);
  const start=safeVal("requestStart"), end=safeVal("requestEnd"), hours=safeVal("requestHours"), desc=safeVal("requestDescription");
  const body=`Hola,

Solicito registrar lo siguiente:

Tipo: ${type}
Solicitante: ${member.full_name}
Cargo/Rol: ${member.position||member.role_code}
Fecha/hora de inicio: ${start||"Por definir"}
Fecha/hora de fin: ${end||"Por definir"}
Horas: ${hours||"Por definir"}

Motivo:
${desc||"Sin detalle adicional"}

Quedo atento(a) a la confirmación.

Saludos,
${member.full_name}`;
  if($("emailPreview"))$("emailPreview").textContent=body;
  return {subject:title,body};
}
async function saveTimeRequest(e){
  e.preventDefault();
  try{
    const built=buildPermissionEmail();
    const {error}=await sb.rpc("ibm_v356_create_time_event",{
      p_event_type:safeVal("eventType"),
      p_title:safeVal("requestTitle")||built.subject,
      p_description:safeVal("requestDescription"),
      p_start_at:safeVal("requestStart")?new Date(safeVal("requestStart")).toISOString():null,
      p_end_at:safeVal("requestEnd")?new Date(safeVal("requestEnd")).toISOString():null,
      p_hours:safeVal("requestHours")?Number(safeVal("requestHours")):null,
      p_notify_to:safeVal("supervisorEmail"),
      p_external_email:safeVal("requestEmail")
    });
    if(error)throw error;
    premiumToast("Solicitud registrada","Se abrirá tu correo con el mensaje armado.","success");
    const to=encodeURIComponent(safeVal("requestEmail")||safeVal("supervisorEmail")||"");
    const url=`mailto:${to}?subject=${encodeURIComponent(built.subject)}&body=${encodeURIComponent(built.body)}`;
    window.location.href=url;
    await loadAll();renderWorkIntel();
  }catch(err){premiumToast("No se pudo registrar solicitud",err.message,"error")}
}
async function saveWorkLink(e){
  e.preventDefault();
  try{
    const {error}=await sb.rpc("ibm_v356_create_work_link",{
      p_title:safeVal("workLinkTitle"),
      p_url:safeVal("workLinkUrl"),
      p_link_type:safeVal("workLinkType"),
      p_client_id:safeVal("workLinkClient")||null,
      p_campaign_id:null,
      p_notes:safeVal("workLinkNotes")
    });
    if(error)throw error;
    premiumToast("Link guardado","El trabajo quedó asociado a tu historial.","success");
    e.target.reset();
    await loadAll();renderWorkIntel();
  }catch(err){premiumToast("No se pudo guardar link",err.message,"error")}
}
function renderV356(){
  if($("workLinkClient")){
    safeOptions("workLinkClient",'<option value="">Sin cliente</option>'+(state.clients||[]).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join(""));
  }
  renderWorkIntel();
}


// ==== v3.5.9.4 Schedule Context Clean ====
let selectedScheduleMemberId=null;
const dayNames=["","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
function scheduleBlocks(memberId){return (state.member_schedule_blocks||[]).filter(b=>b.member_id===memberId&&b.is_active!==false)}
function scheduleExceptions(memberId){return (state.member_schedule_exceptions||[]).filter(e=>e.member_id===memberId)}
function blockClass(type){return type==="descanso"?"break":type==="hora_extra"?"extra":type==="libre"?"free":""}
function blockLabel(type){return type==="hora_extra"?"Horas extra":type==="descanso"?"Descanso":type==="libre"?"Libre":"Trabajo"}
function editScheduleBlock(id){
  const b=(state.member_schedule_blocks||[]).find(x=>x.id===id);
  if(!b || b.member_id!==member.id){premiumToast("No permitido","Solo puedes editar tu propio horario.","warning");return}
  $("scheduleBlockId").value=b.id;
  $("scheduleWeekday").value=b.weekday;
  $("scheduleBlockType").value=b.block_type||"trabajo";
  $("scheduleStart").value=(b.start_time||"09:00").slice(0,5);
  $("scheduleEnd").value=(b.end_time||"18:00").slice(0,5);
  $("scheduleMode").value=b.work_mode||"presencial";
  $("scheduleLabel").value=b.label||"";
  $("scheduleLocation").value=b.location||"";
  $("scheduleNotes").value=b.notes||"";
  navTo("schedulePro");
}
function clearScheduleBlockForm(){
  ["scheduleBlockId","scheduleLabel","scheduleLocation","scheduleNotes"].forEach(id=>$(id).value="");
  $("scheduleWeekday").value="1";$("scheduleBlockType").value="trabajo";$("scheduleStart").value="09:00";$("scheduleEnd").value="18:00";$("scheduleMode").value="presencial";
}
async function saveScheduleBlock(e){
  e.preventDefault();
  try{
    const {error}=await sb.rpc("ibm_v357_upsert_my_schedule_block",{
      p_block_id:safeVal("scheduleBlockId")||null,
      p_weekday:Number(safeVal("scheduleWeekday")),
      p_block_type:safeVal("scheduleBlockType"),
      p_label:safeVal("scheduleLabel"),
      p_start_time:safeVal("scheduleStart"),
      p_end_time:safeVal("scheduleEnd"),
      p_work_mode:safeVal("scheduleMode"),
      p_location:safeVal("scheduleLocation"),
      p_notes:safeVal("scheduleNotes"),
      p_sort_order:1
    });
    if(error)throw error;
    premiumToast("Horario guardado","El bloque fue actualizado.","success");
    clearScheduleBlockForm();
    await loadAll();selectedScheduleMemberId=member.id;renderSchedulePro();
  }catch(err){premiumToast("No se pudo guardar horario",err.message,"error")}
}
async function deleteScheduleBlock(id){
  const ok=await premiumConfirmModal({title:"Eliminar bloque",subtitle:"Se quitará este bloque de tu horario.",confirmLabel:"Eliminar",cancelLabel:"Cancelar"});
  if(!ok)return;
  try{
    const {error}=await sb.rpc("ibm_v357_delete_my_schedule_block",{p_block_id:id});
    if(error)throw error;
    premiumToast("Bloque eliminado","Tu horario fue actualizado.","success");
    await loadAll();renderSchedulePro();
  }catch(err){premiumToast("No se pudo eliminar",err.message,"error")}
}
async function updateScheduleException(id,status){
  try{
    const {error}=await sb.rpc("ibm_v357_update_schedule_exception_status",{p_exception_id:id,p_status:status});
    if(error)throw error;
    premiumToast("Solicitud actualizada","Estado: "+status,"success");
    await loadAll();renderSchedulePro();
  }catch(err){premiumToast("No se pudo actualizar",err.message,"error")}
}
function renderV357(){renderSchedulePro()}


// ==== v3.5.9.4 Schedule Context Clean ====
let selectedGridType="trabajo";
const gridHours=Array.from({length:17},(_,i)=>6+i); // 06:00 - 22:00
function gridSlots(memberId){return (state.member_schedule_grid_slots||[]).filter(s=>s.member_id===memberId)}
function gridTypeClass(slot){
  if(!slot || !slot.is_active)return "";
  if(slot.slot_type==="descanso")return "break";
  if(slot.slot_type==="hora_extra")return "extra";
  if(slot.slot_type==="libre")return "free";
  if(slot.work_mode==="remoto" || slot.slot_type==="remoto")return "remote";
  return "";
}
function gridTypeLabel(type){
  return type==="hora_extra"?"Hora extra":type==="descanso"?"Descanso":type==="remoto"?"Remoto":type==="libre"?"Libre":"Trabajo";
}
async function toggleGridSlot(weekday,hour){
  const existing=gridSlot(member.id,weekday,hour);
  const active=!(existing && existing.is_active);
  const start=String(hour).padStart(2,"0")+":00";
  const end=String(hour+1).padStart(2,"0")+":00";
  const type=selectedGridType==="remoto"?"trabajo":selectedGridType;
  const mode=selectedGridType==="remoto"?"remoto":(selectedGridType==="trabajo"?"presencial":"presencial");
  try{
    const {error}=await sb.rpc("ibm_v358_set_my_grid_slot",{
      p_weekday:weekday,
      p_slot_start:start,
      p_slot_end:end,
      p_is_active:active,
      p_slot_type:type,
      p_work_mode:mode,
      p_label:gridTypeLabel(selectedGridType),
      p_notes:""
    });
    if(error)throw error;
    await loadAll();
    selectedScheduleMemberId=member.id;
    renderSchedulePro();
    premiumToast(active?"Hora activada":"Hora desactivada",`${dayNames[weekday]} ${start} - ${end}`,"success");
  }catch(err){premiumToast("No se pudo actualizar la hora",err.message,"error")}
}
function renderGridSummaryIntoSchedule(){
  const memberId=selectedScheduleMemberId||member.id;
  const active=gridSlots(memberId).filter(s=>s.is_active);
  const work=active.filter(s=>s.slot_type==="trabajo").length;
  const remote=active.filter(s=>s.work_mode==="remoto").length;
  const extra=active.filter(s=>s.slot_type==="hora_extra").length;
  const rest=active.filter(s=>s.slot_type==="descanso").length;
  return {active,work,remote,extra,rest};
}
function renderV358(){
  renderScheduleGrid();
}


// ==== v3.5.9.4 Schedule Context Clean ====
let gridDraft={};
let isPaintingGrid=false;
function myScheduleSubmission(memberId=member.id){return (state.member_schedule_submissions||[]).find(x=>x.member_id===memberId)||{}}
function scheduleIsLocked(){return !!myScheduleSubmission(member.id).is_locked}
function draftKey(d,h){return d+"-"+h}
function draftCount(){return Object.keys(gridDraft).length}
function parseEmails(value){return String(value||"").split(/[,\n;]/).map(x=>x.trim()).filter(Boolean)}
function updateDraftUI(){
  const n=draftCount();
  if($("draftCounter"))$("draftCounter").textContent=n?`${n} cambio(s) pendientes`:"Sin cambios pendientes";
  if($("draftHelp"))$("draftHelp").textContent=scheduleIsLocked()?"Horario enviado y bloqueado hasta que un jefe habilite cambios.":"Puedes guardar cambios o enviar el horario completo a tus jefes.";
}
function renderScheduleLockBanner(){
  if(!$("scheduleLockBanner"))return;
  const sub=myScheduleSubmission(selectedScheduleMemberId||member.id);
  const viewingSelf=(selectedScheduleMemberId||member.id)===member.id;
  const locked=!!sub.is_locked;
  const status=sub.status||"draft";
  const supervisor=isSupervisor();
  $("scheduleLockBanner").className="grid-lock-banner "+(locked?"locked":"open");
  $("scheduleLockBanner").innerHTML=`<div><strong>${locked?"Horario enviado y bloqueado":"Horario editable"}</strong><br><span class="small">Estado: ${esc(status)} ${sub.submitted_at?`· enviado ${new Date(sub.submitted_at).toLocaleString("es-PE")}`:""}</span></div><div class="btn-row">${supervisor&&!viewingSelf?`<button class="ghost" onclick="unlockMemberSchedule('${selectedScheduleMemberId}')">Habilitar cambios</button><button class="ghost" onclick="reviewMemberSchedule('${selectedScheduleMemberId}','approved')">Aprobar</button><button class="danger" onclick="reviewMemberSchedule('${selectedScheduleMemberId}','rejected')">Rechazar</button>`:""}${viewingSelf&&locked?`<span class="status yellow">Solicita a tu jefe habilitar cambios</span>`:""}</div>`;
  updateDraftUI();
}
document.addEventListener("mouseup",()=>{isPaintingGrid=false;Object.keys(gridDraft).forEach(k=>{if(gridDraft[k])delete gridDraft[k].painted})});
function clearMyGridDraft(){gridDraft={};renderScheduleGrid();premiumToast("Borrador limpio","Los cambios visuales pendientes fueron limpiados.","success")}
async function submitGridToBosses(){
  if(scheduleIsLocked()){premiumToast("Ya fue enviado","Tu horario está bloqueado hasta que un jefe habilite cambios.","warning");return}
  await saveGridDraft();
  const memberSlots=gridSlots(member.id).filter(s=>s.is_active);
  const summary={slots:memberSlots.length, submitted_from:"grid", submitted_at:new Date().toISOString()};
  try{
    const ok=await premiumConfirmModal({title:"Enviar horario a jefes",subtitle:"Luego de enviar, tu horario quedará bloqueado. Solo un jefe podrá habilitar cambios.",confirmLabel:"Enviar y bloquear",cancelLabel:"Cancelar"});
    if(!ok)return;
    const {error}=await sb.rpc("ibm_v359_submit_my_schedule",{p_summary:summary});
    if(error)throw error;
    premiumToast("Horario enviado","Tus jefes recibirán la actualización en la plataforma.","success");
    await loadAll();
    renderSchedulePro();
  }catch(err){premiumToast("No se pudo enviar",err.message,"error")}
}
async function unlockMemberSchedule(memberId){
  const comment=await premiumInputModal({title:"Habilitar cambios",subtitle:"El miembro podrá volver a modificar su horario.",label:"Comentario",placeholder:"Ej: Puedes ajustar tu horario de esta semana...",confirmLabel:"Habilitar"});
  if(comment===null)return;
  try{
    const {error}=await sb.rpc("ibm_v359_unlock_member_schedule",{p_member_id:memberId,p_comment:comment});
    if(error)throw error;
    premiumToast("Cambios habilitados","El miembro ya puede editar su horario.","success");
    await loadAll();renderSchedulePro();
  }catch(err){premiumToast("No se pudo habilitar",err.message,"error")}
}
async function reviewMemberSchedule(memberId,status){
  const comment=await premiumInputModal({title:status==="approved"?"Aprobar horario":"Rechazar horario",subtitle:"Deja un comentario para el miembro.",label:"Comentario",placeholder:"Comentario de revisión...",confirmLabel:status==="approved"?"Aprobar":"Rechazar"});
  if(comment===null)return;
  try{
    const {error}=await sb.rpc("ibm_v359_review_member_schedule",{p_member_id:memberId,p_status:status,p_comment:comment});
    if(error)throw error;
    premiumToast("Horario revisado","Estado: "+status,"success");
    await loadAll();renderSchedulePro();
  }catch(err){premiumToast("No se pudo revisar",err.message,"error")}
}
async function createQuickOverlayException(c){
  const date=safeVal("gridRequestDate");
  if(!date){throw new Error("Para marcar permiso desde la cuadrícula, selecciona una fecha en 'Fecha para solicitudes superpuestas'.")}
  const type=c.slot_type==="permiso"?"permiso":c.slot_type;
  const title=gridTypeLabel(type)+" "+date;
  const {error}=await sb.rpc("ibm_v357_create_schedule_exception",{
    p_exception_date:date,
    p_event_type:type,
    p_title:title,
    p_reason:"Marcado desde cuadrícula",
    p_start_time:c.slot_start,
    p_end_time:c.slot_end,
    p_is_full_day:false,
    p_hours:1,
    p_notify_email:safeVal("exceptionEmail")
  });
  if(error)throw error;
}
async function clearMyGridWeek(){
  if(scheduleIsLocked()){premiumToast("Horario bloqueado","Solicita a un jefe habilitar cambios.","warning");return}
  const ok=await premiumConfirmModal({title:"Limpiar semana guardada",subtitle:"Se desactivarán todas tus horas guardadas en Supabase.",confirmLabel:"Limpiar",cancelLabel:"Cancelar"});
  if(!ok)return;
  try{
    const {error}=await sb.rpc("ibm_v358_clear_my_grid_week");
    if(error)throw error;
    gridDraft={};
    await loadAll();selectedScheduleMemberId=member.id;renderSchedulePro();
    premiumToast("Semana limpia","Tus horas guardadas fueron desactivadas.","success");
  }catch(err){premiumToast("No se pudo limpiar",err.message,"error")}
}
function buildScheduleEmail(){
  if(!$("scheduleEmailPreview"))return {subject:"",body:"",recipients:[]};
  const emails=parseEmails(safeVal("exceptionEmail"));
  const type=safeVal("exceptionType"), title=safeVal("exceptionTitle")||("Solicitud de "+type);
  const date=safeVal("exceptionDate"), start=safeVal("exceptionStart"), end=safeVal("exceptionEnd"), hours=safeVal("exceptionHours"), reason=safeVal("exceptionReason");
  const full=safeVal("exceptionFullDay")==="true"?"Sí":"No";
  const body=`Hola,

Solicito registrar lo siguiente en mi calendario laboral:

Tipo: ${type}
Solicitante: ${member.full_name}
Cargo/Rol: ${member.position||member.role_code}
Fecha: ${date||"Por definir"}
Día completo: ${full}
Inicio: ${start||"Por definir"}
Fin: ${end||"Por definir"}
Horas: ${hours||"Por definir"}

Motivo:
${reason||"Sin detalle adicional"}

Esta solicitud también quedará registrada en Marketing Cloud.

Saludos,
${member.full_name}`;
  $("scheduleEmailPreview").textContent=body;
  return {subject:title,body,recipients:emails};
}
async function saveScheduleException(e){
  e.preventDefault();
  const built=buildScheduleEmail();
  if(!built.recipients.length){premiumToast("Falta correo","Agrega uno o varios correos separados por coma.","warning");return}
  const mailto=`mailto:${encodeURIComponent(built.recipients.join(","))}?subject=${encodeURIComponent(built.subject)}&body=${encodeURIComponent(built.body)}`;
  try{
    const {data,error}=await sb.rpc("ibm_v359_create_schedule_exception_multi",{
      p_exception_date:safeVal("exceptionDate"),
      p_event_type:safeVal("exceptionType"),
      p_title:safeVal("exceptionTitle")||built.subject,
      p_reason:safeVal("exceptionReason"),
      p_start_time:safeVal("exceptionStart")||null,
      p_end_time:safeVal("exceptionEnd")||null,
      p_is_full_day:safeVal("exceptionFullDay")==="true",
      p_hours:safeVal("exceptionHours")?Number(safeVal("exceptionHours")):null,
      p_notify_emails:built.recipients,
      p_subject:built.subject,
      p_body:built.body,
      p_mailto_url:mailto
    });
    if(error)throw error;
    premiumToast("Solicitud registrada","Se abrirá el correo con varios destinatarios.","success");
    window.location.href=mailto;
    setTimeout(()=>premiumToast("Verifica el envío","El sistema abrió tu correo. Confirma manualmente que presionaste enviar.","warning"),1600);
    await loadAll();renderSchedulePro();
  }catch(err){premiumToast("No se pudo registrar solicitud",err.message,"error")}
}
function renderScheduleEmailLogs(){
  if(!$("scheduleEmailLogs"))return;
  const logs=(state.schedule_email_logs||[]).filter(l=>l.member_id===(selectedScheduleMemberId||member.id)).slice(0,8);
  $("scheduleEmailLogs").innerHTML=logs.map(l=>`<div class="email-log-card"><strong>${esc(l.subject||"Correo generado")}</strong><br><span class="small">${(l.recipients||[]).join(", ")} · ${esc(l.send_status)}</span><p class="small">${new Date(l.created_at).toLocaleString("es-PE")}</p></div>`).join("")||"<p class='small'>Aún no hay correos registrados.</p>";
}
function renderV359(){renderScheduleEmailLogs();renderScheduleLockBanner();updateDraftUI()}


// ==== v3.5.9.4 Schedule Context Clean ====
function forceMySchedule(){
  selectedScheduleMemberId=member.id;
  gridDraft={};
  renderSchedulePro();
  premiumToast("Editando mi horario","Ahora puedes pintar tu propia cuadrícula.","success");
}
function scheduleViewerIsSelf(){
  return (selectedScheduleMemberId||member.id)===member.id;
}
function renderScheduleEditorStatus(){
  if(!$("scheduleEditorStatus"))return;
  const selected=by(state.members,selectedScheduleMemberId||member.id)||member;
  const self=scheduleViewerIsSelf();
  const locked=scheduleIsLocked();
  $("scheduleEditorStatus").className="grid-status-editor "+(locked&&self?"locked":self?"editing":"readonly");
  $("scheduleEditorStatus").innerHTML=self?
    `<div><strong>${locked?"Mi horario está bloqueado":"Estoy editando mi horario"}</strong><br><span class="small">${locked?"Ya fue enviado. Un jefe debe habilitar cambios.":"Elige un modo y pinta las horas. Se verá al instante."}</span></div><div class="btn-row"><span class="status ${locked?'red':'green'}">${locked?'Bloqueado':'Editable'}</span></div>`:
    `<div><strong>Viendo horario de ${esc(selected.full_name||"miembro")}</strong><br><span class="small">Esta vista es solo lectura. Para pintar, vuelve a tu propio horario.</span></div><div class="btn-row"><button class="primary" onclick="forceMySchedule()">Editar mi horario</button></div>`;
}
document.addEventListener("mouseup",()=>{isPaintingGrid=false;Object.keys(gridDraft||{}).forEach(k=>{if(gridDraft[k])delete gridDraft[k].painted})});
function selectScheduleMember(id){
  selectedScheduleMemberId=id;
  gridDraft={};
  renderSchedulePro();
}
function renderSchedulePro(){
  if(!$("scheduleMemberList"))return;
  if(!selectedScheduleMemberId)selectedScheduleMemberId=member.id;
  const supervisor=isSupervisor();
  const selected=by(state.members,selectedScheduleMemberId)||member;
  $("scheduleMemberList").innerHTML=(state.members||[]).map(m=>{
    const blocks=scheduleBlocks(m.id).length;
    const ex=scheduleExceptions(m.id).filter(e=>e.status==="solicitado").length;
    const sub=myScheduleSubmission(m.id);
    return `<div class="schedule-member-card ${m.id===selectedScheduleMemberId?'active':''}" onclick="selectScheduleMember('${m.id}')">
      ${miniAvatarSync(m,"mini-avatar")}
      <div style="flex:1"><strong>${esc(m.full_name)}</strong><br><span class="small">${m.id===member.id?'Mi horario · ':''}${blocks} bloques · ${ex} solicitudes · ${esc(sub.status||'draft')}</span></div>
    </div>`;
  }).join("");
  $("scheduleSelectedHeader").innerHTML=`${miniAvatarSync(selected,"work-avatar")}<div style="flex:1"><h2>${esc(selected.full_name||"Miembro")}</h2><p class="small">${selected.id===member.id?'Estás en tu horario editable':'Vista de supervisor / solo lectura'} · ${esc(selected.position||selected.role_code||"")}</p><div class="btn-row"><button class="ghost" onclick="openMemberProfile('${selected.id}')">Ver muro</button><button class="ghost" onclick="messageMember('${selected.id}')">Mensaje</button>${selected.id!==member.id?`<button class="primary" onclick="forceMySchedule()">Editar mi horario</button>`:""}</div></div>`;
  const blocks=scheduleBlocks(selected.id);
  const exceptions=scheduleExceptions(selected.id);
  const workBlocks=blocks.filter(b=>b.block_type==="trabajo");
  const extraBlocks=blocks.filter(b=>b.block_type==="hora_extra");
  const pending=exceptions.filter(e=>e.status==="solicitado");
  $("scheduleSummary").innerHTML=[
    ["Bloques",blocks.length],
    ["Días activos",new Set(workBlocks.map(b=>b.weekday)).size],
    ["Horas extra",extraBlocks.length],
    ["Solicitudes",pending.length]
  ].map(x=>`<div class="work-kpi"><span class="small">${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
  $("weeklyCalendar").innerHTML=[1,2,3,4,5,6,7].map(d=>{
    const dayBlocks=blocks.filter(b=>Number(b.weekday)===d).sort((a,b)=>(a.start_time||"").localeCompare(b.start_time||""));
    return `<div class="day-column"><h4>${dayNames[d]}</h4>${dayBlocks.map(b=>`<div class="schedule-block ${blockClass(b.block_type)}"><strong>${esc(b.label||blockLabel(b.block_type))}</strong><br><span class="small">${esc((b.start_time||"").slice(0,5))} - ${esc((b.end_time||"").slice(0,5))}</span><br><span class="small">${esc(b.work_mode||"")} ${b.location?`· ${esc(b.location)}`:""}</span>${b.member_id===member.id?`<div class="schedule-actions"><button class="ghost" onclick="editScheduleBlock('${b.id}')">Editar</button><button class="danger" onclick="deleteScheduleBlock('${b.id}')">Eliminar</button></div>`:""}</div>`).join("")||"<p class='small'>Sin bloques</p>"}</div>`;
  }).join("");
  $("scheduleExceptionsList").innerHTML=exceptions.slice(0,12).map(e=>`<div class="exception-card ${e.status==='aprobado'?'ok':e.status==='rechazado'?'red':'pending'}"><strong>${esc(e.title)}</strong><br><span class="small">${esc(e.exception_date)} · ${esc(e.event_type)} · ${esc(e.status)}</span><p>${esc(e.reason||"")}</p>${supervisor&&e.status==="solicitado"?`<div class="btn-row"><button class="ghost" onclick="updateScheduleException('${e.id}','aprobado')">Aprobar</button><button class="danger" onclick="updateScheduleException('${e.id}','rechazado')">Rechazar</button></div>`:""}</div>`).join("")||"<p class='small'>Sin excepciones registradas.</p>";
  buildScheduleEmail();
  renderScheduleGrid();
  renderScheduleEmailLogs();
  renderScheduleLockBanner();
  bindScheduleGridEvents();
}
function renderV3591(){
  if(!selectedScheduleMemberId)selectedScheduleMemberId=member.id;
  bindScheduleGridEvents();
  renderScheduleEditorStatus();
}


// ==== v3.5.9.4 Schedule Context Clean ====
const gridMinutes = Array.from({length:34},(_,i)=>360 + i*30); // 06:00 a 22:30
function minToTime(m){
  const h=Math.floor(m/60), mm=m%60;
  return String(h).padStart(2,"0")+":"+String(mm).padStart(2,"0");
}
function timeToMin(t){
  const [h,m]=String(t||"00:00").split(":").map(Number);
  return (h||0)*60+(m||0);
}
function slotEndFromStart(start){
  return minToTime(timeToMin(start)+30);
}
function gridSlot(memberId,weekday,minute){
  const hh=minToTime(minute)+":00";
  return gridSlots(memberId).find(s=>Number(s.weekday)===Number(weekday) && String(s.slot_start).slice(0,8)===hh);
}
async function saveGridDraft(){
  const changes=Object.values(gridDraft);
  if(!changes.length){premiumToast("Sin cambios","No hay cambios pendientes para guardar.","warning");return}
  if(scheduleIsLocked()){premiumToast("Horario bloqueado","Solicita a tu jefe habilitar cambios.","warning");return}
  try{
    for(const c of changes){
      if(c.slot_type==="permiso"){
        await createQuickOverlayException(c);
      }else{
        const {error}=await sb.rpc("ibm_v359_set_my_grid_slot",{
          p_weekday:c.weekday,p_slot_start:c.slot_start,p_slot_end:c.slot_end,p_is_active:c.is_active,
          p_slot_type:c.slot_type,p_work_mode:c.work_mode,p_label:c.label,p_notes:c.notes
        });
        if(error)throw error;
      }
    }
    gridDraft={};
    await loadAll();
    selectedScheduleMemberId=member.id;
    renderSchedulePro();
    premiumToast("Cambios guardados","Tu cuadrícula de medias horas fue actualizada.","success");
  }catch(err){premiumToast("No se pudo guardar",err.message,"error")}
}
function paintRangeToDraft(){
  if(!scheduleViewerIsSelf()){premiumToast("Vista solo lectura","Presiona Editar mi horario para pintar tu cuadrícula.","warning");return}
  if(scheduleIsLocked()){premiumToast("Horario bloqueado","Solicita a tu jefe habilitar cambios.","warning");return}
  const day=Number(safeVal("rangeWeekday")), start=safeVal("rangeStart"), end=safeVal("rangeEnd"), type=safeVal("rangeType");
  addRangeToDraft(day,start,end,type);
  renderScheduleGrid();
  updateDraftUI();
  premiumToast("Rango pintado",`${dayNames[day]} ${start} - ${end}`,"success");
}
function paintSameRangeWeek(){
  if(!scheduleViewerIsSelf()){premiumToast("Vista solo lectura","Presiona Editar mi horario para pintar tu cuadrícula.","warning");return}
  if(scheduleIsLocked()){premiumToast("Horario bloqueado","Solicita a tu jefe habilitar cambios.","warning");return}
  const start=safeVal("rangeStart"), end=safeVal("rangeEnd"), type=safeVal("rangeType");
  [1,2,3,4,5].forEach(d=>addRangeToDraft(d,start,end,type));
  renderScheduleGrid();
  updateDraftUI();
  premiumToast("Rango aplicado","Se pintó de lunes a viernes.","success");
}
async function applyPresetOfficeWeek(){
  if(scheduleIsLocked()){premiumToast("Horario bloqueado","Solicita a un jefe habilitar cambios.","warning");return}
  const ok=await premiumConfirmModal({title:"Aplicar horario base",subtitle:"Se marcará lunes a viernes de 8:30 a 18:30 como borrador visual.",confirmLabel:"Aplicar",cancelLabel:"Cancelar"});
  if(!ok)return;
  [1,2,3,4,5].forEach(d=>addRangeToDraft(d,"08:30","18:30","trabajo"));
  renderScheduleGrid();
  updateDraftUI();
  premiumToast("Horario base en borrador","Lunes a viernes 8:30 - 18:30.","success");
}
function renderV3592(){
  if($("scheduleGrid"))$("scheduleGrid").classList.add("half-hour-grid");
  bindScheduleGridEvents();
}


// ==== v3.5.9.4 Schedule Context Clean ====
let gridUndoStack=[];
function pushUndoSnapshot(){
  gridUndoStack.push(JSON.parse(JSON.stringify(gridDraft||{})));
  if(gridUndoStack.length>15)gridUndoStack.shift();
  updateUndoStatus();
}
function updateUndoStatus(){
  if($("undoStatus"))$("undoStatus").textContent=gridUndoStack.length?`${gridUndoStack.length} acción(es) para deshacer`:"Sin acciones para deshacer";
}
function undoLastGridAction(){
  if(!gridUndoStack.length){premiumToast("Nada que deshacer","Aún no hay acciones en borrador.","warning");return}
  gridDraft=gridUndoStack.pop()||{};
  renderScheduleGrid();
  updateDraftUI();
  updateUndoStatus();
  premiumToast("Deshecho","Se restauró el estado anterior del borrador.","success");
}
function addRangeToDraft(day,start,end,type){
  const s=timeToMin(start), e=timeToMin(end);
  if(e<=s){premiumToast("Rango inválido","La hora final debe ser mayor que la inicial.","warning");return}
  if(s%30!==0 || e%30!==0){premiumToast("Usa medias horas","El rango debe terminar en :00 o :30.","warning");return}
  pushUndoSnapshot();
  for(let m=s;m<e;m+=30){
    const key=draftKey(day,m);
    const existing=gridSlot(member.id,day,m);
    if(type==="borrar"){
      gridDraft[key]={weekday:day,hour:m,minute:m,slot_start:minToTime(m),slot_end:minToTime(m+30),is_active:false,slot_type:existing?.slot_type||"trabajo",work_mode:existing?.work_mode||"presencial",label:"Borrar",notes:"",erase:true};
    }else{
      const slotType=type==="remoto"?"trabajo":(type==="permiso"?"permiso":type);
      const mode=type==="remoto"?"remoto":(type==="trabajo"?"presencial":"presencial");
      gridDraft[key]={weekday:day,hour:m,minute:m,slot_start:minToTime(m),slot_end:minToTime(m+30),is_active:true,slot_type:slotType,work_mode:mode,label:gridTypeLabel(type),notes:""};
    }
  }
}
function clearSelectedDayDraft(){
  if(!scheduleViewerIsSelf()){premiumToast("Vista solo lectura","Presiona Editar mi horario.","warning");return}
  if(scheduleIsLocked()){premiumToast("Horario bloqueado","Solicita a tu jefe habilitar cambios.","warning");return}
  const day=Number(safeVal("rangeWeekday")||1);
  const okTitle=`Limpiar ${dayNames[day]}`;
  premiumConfirmModal({title:okTitle,subtitle:"Se marcará como borrado todo el día seleccionado en el borrador. Luego debes guardar cambios.",confirmLabel:"Limpiar día",cancelLabel:"Cancelar"}).then(ok=>{
    if(!ok)return;
    pushUndoSnapshot();
    gridMinutes.forEach(m=>{
      const existing=gridSlot(member.id,day,m);
      const key=draftKey(day,m);
      gridDraft[key]={weekday:day,hour:m,minute:m,slot_start:minToTime(m),slot_end:minToTime(m+30),is_active:false,slot_type:existing?.slot_type||"trabajo",work_mode:existing?.work_mode||"presencial",label:"Borrar",notes:"",erase:true};
    });
    renderScheduleGrid();
    updateDraftUI();
    premiumToast("Día marcado para limpiar",`${dayNames[day]} quedó en borrador como borrado.`,"success");
  });
}
function renderV3593(){
  updateUndoStatus();
}


// ==== v3.5.9.4 Schedule Context Clean ====
let scheduleContextCell=null;
function hideScheduleCellMenu(){
  const m=$("scheduleCellMenu");
  if(m)m.classList.remove("open");
  scheduleContextCell=null;
}
function showScheduleCellMenu(x,y,weekday,minute){
  const m=$("scheduleCellMenu");
  if(!m)return;
  scheduleContextCell={weekday:Number(weekday),minute:Number(minute)};
  const time=minToTime(Number(minute));
  if($("scheduleCellMenuTitle"))$("scheduleCellMenuTitle").textContent=`${dayNames[weekday]} · ${time}`;
  m.style.left=Math.min(x, window.innerWidth-220)+"px";
  m.style.top=Math.min(y, window.innerHeight-170)+"px";
  m.classList.add("open");
}
function cleanSingleCell(weekday,minute){
  if(!scheduleViewerIsSelf()){
    premiumToast("Vista solo lectura","Presiona Editar mi horario para modificar tu cuadrícula.","warning");
    return;
  }
  if(scheduleIsLocked()){
    premiumToast("Horario bloqueado","Solicita a tu jefe habilitar cambios.","warning");
    return;
  }
  pushUndoSnapshot();
  const key=draftKey(weekday,minute);
  const existing=gridSlot(member.id,weekday,minute);
  const draft=gridDraft[key];
  if(draft && draft.is_active && !existing){
    delete gridDraft[key];
  }else{
    gridDraft[key]={
      weekday,
      hour:minute,
      minute,
      slot_start:minToTime(minute),
      slot_end:minToTime(minute+30),
      is_active:false,
      slot_type:existing?.slot_type||draft?.slot_type||"trabajo",
      work_mode:existing?.work_mode||draft?.work_mode||"presencial",
      label:"Limpiar",
      notes:"",
      cleared:true
    };
  }
  hideScheduleCellMenu();
  renderScheduleGrid();
  updateDraftUI();
  premiumToast("Celda limpia","La celda quedó en blanco. Guarda cambios para confirmar.","success");
}
function paintSingleCellWithCurrentMode(weekday,minute){
  hideScheduleCellMenu();
  setDraftCell(Number(weekday),Number(minute),true);
}
function renderScheduleGrid(){
  if(!$("scheduleGrid"))return;
  const memberId=selectedScheduleMemberId||member.id;
  const self=memberId===member.id;
  const editable=self && !scheduleIsLocked();
  let html=`<div class="grid-head">Hora</div>${[1,2,3,4,5,6,7].map(d=>`<div class="grid-head">${dayNames[d]}</div>`).join("")}`;
  gridMinutes.forEach(min=>{
    const time=minToTime(min);
    const isHalf=min%60===30;
    html+=`<div class="grid-hour ${isHalf?'half-hour-label':'full-hour-label'}">${time}</div>`;
    [1,2,3,4,5,6,7].forEach(d=>{
      const existing=gridSlot(memberId,d,min);
      const draft=self?gridDraft[draftKey(d,min)]:null;
      const view=draft||existing;
      const active=!!(view&&view.is_active);
      const type=view?.slot_type;
      const mode=view?.work_mode;
      const draftCls=draft?(draft.cleared||draft.erase?"cleared-draft ":draft.is_active?"draft ":""):"";
      const activeCls=active?"active ":"";
      const extraCls=type==="permiso"?"permission":(type==="descanso"?"break":type==="hora_extra"?"extra":type==="libre"?"free":mode==="remoto"?"remote":"");
      html+=`<div class="grid-cell ${editable?'editable':'readonly'} ${activeCls}${draftCls}${extraCls}" data-weekday="${d}" data-minute="${min}" data-hour="${min}" data-label="${active?esc(gridTypeLabel(type==='permiso'?'permiso':mode==='remoto'?'remoto':type)):""}" title="${editable?'Clic para pintar · clic derecho para limpiar':'Solo lectura'} · ${dayNames[d]} ${time}">
        ${active?`<span class="cell-dot"></span>`:""}
      </div>`;
    });
  });
  $("scheduleGrid").innerHTML=html;
  renderScheduleLockBanner();
  renderScheduleEditorStatus();
}
function bindScheduleGridEvents(){
  const grid=$("scheduleGrid");
  if(!grid || grid.dataset.boundPaint==="contextclean")return;
  grid.dataset.boundPaint="contextclean";
  grid.addEventListener("contextmenu",e=>{
    const cell=e.target.closest(".grid-cell");
    if(!cell)return;
    e.preventDefault();
    showScheduleCellMenu(e.clientX,e.clientY,cell.dataset.weekday,cell.dataset.minute);
  });
  grid.addEventListener("mousedown",e=>{
    if(e.button!==0)return;
    hideScheduleCellMenu();
    const cell=e.target.closest(".grid-cell");
    if(!cell)return;
    e.preventDefault();
    isPaintingGrid=true;
    setDraftCell(Number(cell.dataset.weekday),Number(cell.dataset.minute));
    cell.dataset.paintedNow="1";
  });
  grid.addEventListener("mouseover",e=>{
    const cell=e.target.closest(".grid-cell");
    if(!cell || !isPaintingGrid)return;
    const key=draftKey(Number(cell.dataset.weekday),Number(cell.dataset.minute));
    if(gridDraft[key]?.painted)return;
    paintGridCell(Number(cell.dataset.weekday),Number(cell.dataset.minute));
    if(gridDraft[key])gridDraft[key].painted=true;
  });
}
function bindScheduleCellMenu(){
  if($("cleanCellMenuBtn") && $("cleanCellMenuBtn").dataset.bound!=="1"){
    $("cleanCellMenuBtn").dataset.bound="1";
    $("cleanCellMenuBtn").onclick=()=>{if(scheduleContextCell)cleanSingleCell(scheduleContextCell.weekday,scheduleContextCell.minute)};
  }
  if($("paintCellMenuBtn") && $("paintCellMenuBtn").dataset.bound!=="1"){
    $("paintCellMenuBtn").dataset.bound="1";
    $("paintCellMenuBtn").onclick=()=>{if(scheduleContextCell)paintSingleCellWithCurrentMode(scheduleContextCell.weekday,scheduleContextCell.minute)};
  }
  if($("closeCellMenuBtn") && $("closeCellMenuBtn").dataset.bound!=="1"){
    $("closeCellMenuBtn").dataset.bound="1";
    $("closeCellMenuBtn").onclick=hideScheduleCellMenu;
  }
}
document.addEventListener("click",e=>{
  const m=$("scheduleCellMenu");
  if(m && m.classList.contains("open") && !e.target.closest("#scheduleCellMenu") && !e.target.closest(".grid-cell")) hideScheduleCellMenu();
});
function setDraftCell(weekday,minute,explicitActive=null){
  if(!scheduleViewerIsSelf()){
    premiumToast("Vista solo lectura","Estás viendo el horario de otro miembro. Presiona “Editar mi horario”.","warning");
    return;
  }
  if(scheduleIsLocked()){
    premiumToast("Horario bloqueado","Ya enviaste tu horario. Solicita a un jefe habilitar cambios.","warning");
    return;
  }
  pushUndoSnapshot();
  const key=draftKey(weekday,minute);
  const existing=gridSlot(member.id,weekday,minute);
  let active;
  if(selectedGridType==="borrar"){
    active=false;
  }else{
    const current=(gridDraft[key]?.is_active ?? (existing&&existing.is_active) ?? false);
    active=explicitActive===null?!current:explicitActive;
  }
  const start=minToTime(minute);
  const end=minToTime(minute+30);
  const type=selectedGridType==="borrar"?(existing?.slot_type||"trabajo"):(selectedGridType==="remoto"?"trabajo":(selectedGridType==="permiso"?"permiso":selectedGridType));
  const mode=selectedGridType==="remoto"?"remoto":(selectedGridType==="trabajo"?"presencial":(existing?.work_mode||"presencial"));
  gridDraft[key]={weekday,hour:minute,minute,slot_start:start,slot_end:end,is_active:active,slot_type:type,work_mode:mode,label:selectedGridType==="borrar"?"Limpiar":gridTypeLabel(selectedGridType),notes:"",cleared:selectedGridType==="borrar"};
  renderScheduleGrid();
  updateDraftUI();
}
function paintGridCell(weekday,minute){
  if(!isPaintingGrid)return;
  const key=draftKey(weekday,minute);
  if(gridDraft[key]?.painted)return;
  const existing=gridSlot(member.id,weekday,minute);
  const start=minToTime(minute);
  const end=minToTime(minute+30);
  const type=selectedGridType==="borrar"?(existing?.slot_type||"trabajo"):(selectedGridType==="remoto"?"trabajo":(selectedGridType==="permiso"?"permiso":selectedGridType));
  const mode=selectedGridType==="remoto"?"remoto":(selectedGridType==="trabajo"?"presencial":(existing?.work_mode||"presencial"));
  gridDraft[key]={weekday,hour:minute,minute,slot_start:start,slot_end:end,is_active:selectedGridType==="borrar"?false:true,slot_type:type,work_mode:mode,label:selectedGridType==="borrar"?"Limpiar":gridTypeLabel(selectedGridType),notes:"",painted:true,cleared:selectedGridType==="borrar"};
  renderScheduleGrid();
  updateDraftUI();
}
function renderV3594(){
  bindScheduleGridEvents();
  bindScheduleCellMenu();
}

function navTo(id){
  if(typeof v417CanAccessSection==="function" && !v417CanAccessSection(id)){
    try{premiumToast("Acceso restringido","Tu rol no puede abrir este módulo.","warning")}catch(e){}
    id="home";
  }
  if(!$(id))id="home";
  currentSection=id;
  try{homeRememberSection(id)}catch(e){}
  try{v414Audit("navigation",id,"")}catch(e){}
  try{touchPresence("online",id)}catch(e){}
  document.querySelectorAll(".nav-leaf").forEach(b=>b.classList.toggle("active",b.dataset.section===id));
  document.querySelectorAll(".section").forEach(sec=>sec.classList.toggle("active",sec.id===id));
  const arenaMode=id==="creativeRoomsClean";
  document.body.classList.toggle("ca-arena-mode",arenaMode);
  document.body.classList.toggle("ib-home-mode",id==="home");
  if(arenaMode)window.scrollTo(0,0);
  const titles={home:"Inicio",myday:"Mi día",search:"Buscador",notifications:"Notificaciones",schedulePro:"Horario Pro",workIntel:"Trabajo 360",tasks:"Tareas",requests360:"Solicitudes 360",approvals:"Aprobaciones",workload:"Carga del equipo",campaigns:"Campañas / Briefs",editorial:"Editorial",calendarOps:"Calendario operativo",creativeRoomsClean:"Salas creativas",hub:"Creative Hub",assets:"Archivos",wall:"Muro",messages:"Mensajes",profile:"Mi espacio",templates:"Plantillas",incidents:"Incidencias",team:"Equipo",live:"En vivo",treasury:"Tesorería y contratos",control:"Control gerencial",performance:"Rendimiento técnico",reports:"Reportes Pro",automations:"Automatizaciones",governance:"Seguridad y gobernanza",auditpro:"Auditoría Pro",permissions:"Permisos",admin:"Administración",memberProfile:"Muro del miembro",socialTrash:"Mi basurero",settings:"Conexión"};
  if($("pageTitle"))$("pageTitle").textContent=titles[id]||id;
  if(typeof window.v412EnhanceSections==="function")window.v412EnhanceSections();
  v412RenderSection(id);
  try{cleanMinimalUI()}catch(e){}
  try{v415CloseMobileMenu();v415SyncMobileNav(id);v415OptimizeImages($(id))}catch(e){}
  if(!arenaMode)window.scrollTo({top:0,behavior:"smooth"});
}
function bind(){
  document.addEventListener("submit",e=>{if(e.target&&e.target.tagName==="FORM")e.preventDefault()},true);window.addEventListener("error",e=>logClientError("browser","error",e));window.addEventListener("unhandledrejection",e=>logClientError("browser","promise",e.reason||e));
  if($("v412RetryBoot"))$("v412RetryBoot").onclick=()=>enterApp();
  if($("v412ExitBoot"))$("v412ExitBoot").onclick=()=>{v412HideBoot();show("loginScreen")};
  v412ConnectionUI();
  if($("saveConfigBtn"))$("saveConfigBtn").onclick=()=>{syncManagedRuntimeConfig();location.reload()};
  $("loginForm").addEventListener("submit",async e=>{e.preventDefault();const submit=e.submitter||$("loginForm").querySelector('button[type="submit"],button:not([type])');$("loginMsg").textContent="Ingresando…";if(submit)submit.disabled=true;try{const {data,error}=await sb.auth.signInWithPassword({email:safeVal("email"),password:safeVal("password")});if(error)throw error;session=data.session;authUser=data.user;await enterApp()}catch(error){$("loginMsg").textContent=friendlyAuthError(error)}finally{if(submit)submit.disabled=false}});
  $("logoutBtn").onclick=async()=>{await sb.auth.signOut();location.reload()};
  $("refreshBtn").onclick=async()=>{v412SetBoot("Actualizando datos","Consultando la información más reciente.",25,"Sincronizando");try{await loadAll();await renderAll();v412SetBoot("Actualización completa","La información ya está al día.",100,"Completado");setTimeout(v412HideBoot,180);toast("Actualizado")}catch(err){v412SetBoot("No se pudo actualizar",v412Message(err),100,"Error",true)}};
  if($("resetConfigBtn"))$("resetConfigBtn").onclick=async()=>{const button=$("resetConfigBtn"),original=button.textContent;button.disabled=true;button.textContent="Comprobando…";try{syncManagedRuntimeConfig();if(!sb)sb=createClient();if(!sb)throw new Error("Cliente no disponible");const {error}=await sb.auth.getUser();if(error&&!/auth session missing/i.test(String(error.message||"")))throw error;toast("Conexión disponible","La configuración automática responde correctamente.")}catch(error){premiumToast("No se pudo comprobar",friendlyAuthError(error),"error")}finally{button.disabled=false;button.textContent=original}};
  document.querySelectorAll(".nav-leaf").forEach(b=>b.onclick=()=>navTo(b.dataset.section));document.querySelectorAll(".work-tabbar button").forEach(b=>b.onclick=()=>setWorkTab(b.dataset.worktab));document.querySelectorAll(".grid-mode-picker button").forEach(b=>b.onclick=()=>{selectedGridType=b.dataset.gridtype;document.querySelectorAll(".grid-mode-picker button").forEach(x=>x.classList.toggle("active",x===b));});document.querySelectorAll(".nav-main-btn").forEach(b=>b.onclick=()=>toggleGroup(b.dataset.group));
  [["scheduleBlockForm",saveScheduleBlock],["scheduleExceptionForm",saveScheduleException],["myWorkProfileForm",saveMyWorkProfile],["timeRequestForm",saveTimeRequest],["workLinkForm",saveWorkLink],["taskForm",saveTask],["taskUpdateForm",updateTask],["campaignForm",saveCampaign],["briefForm",saveBrief],["editorialForm",saveEditorial],["postForm",savePost],["messageForm",saveMessage],["profileForm",saveProfile],["boardForm",saveBoard],["cardForm",saveCard],["assetForm",saveAsset],["templateForm",saveTemplate],["incidentForm",saveIncident],["adminUserForm",saveAdminUser]].forEach(([id,fn])=>$(id).addEventListener("submit",fn));
  $("emojiBtn").onclick=e=>{e.preventDefault();$("emojiPop").classList.contains("open")?closeEmoji():openEmoji()};
  $("emojiSearch").oninput=renderEmoji;if($("exceptionTitle"))["exceptionType","exceptionTitle","exceptionDate","exceptionStart","exceptionEnd","exceptionHours","exceptionFullDay","exceptionReason"].forEach(id=>$(id).addEventListener("input",buildScheduleEmail));if($("requestTitle"))["eventType","requestTitle","requestStart","requestEnd","requestHours","requestDescription"].forEach(id=>$(id).addEventListener("input",buildPermissionEmail));if($("saveHomePrefsBtn"))$("saveHomePrefsBtn").onclick=saveHomeFeedPreferences;if($("saveNavPrefsBtn"))$("saveNavPrefsBtn").onclick=saveNavPreferences;if($("markAllMsgBtn"))$("markAllMsgBtn").onclick=markAllMessagesRead;if($("markAllNotifBtn"))$("markAllNotifBtn").onclick=markAllNotificationsRead;if($("manualSyncBtn"))$("manualSyncBtn").onclick=()=>safeSync("manual");if($("savePermBtn"))$("savePermBtn").onclick=savePermission;if($("exportAuditBtn"))$("exportAuditBtn").onclick=exportAuditCSV;if($("globalSearch"))$("globalSearch").oninput=renderSearch;if($("refreshNotifBtn"))$("refreshNotifBtn").onclick=async()=>{await loadAll();renderNotifications();toast("Notificaciones actualizadas")};document.querySelectorAll(".admin-tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".admin-tabs button").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".admin-pane").forEach(p=>p.classList.toggle("active",p.id==="admin_"+b.dataset.admin))});if($("adminUserSelect"))$("adminUserSelect").onchange=e=>loadAdminUser(e.target.value);if($("adminClearUser"))$("adminClearUser").onclick=()=>loadAdminUser("");
  document.addEventListener("click",e=>{if($("emojiPop").classList.contains("open")&&!e.target.closest(".emoji-wrap"))closeEmoji()});
  /* v4.16: el módulo móvil se enlaza después de cargar su script. */
}

// Legacy creative-board engines removed; v4.23 keeps only the stable Creative Arena runtime.

// ==== v4.23 SCHEDULE POLISH ONLY ====
window.v412PolishOperational=function(){
  const target=document.getElementById("schedule")||document.getElementById("schedulePro")||document.getElementById("horarioPro")||Array.from(document.querySelectorAll(".section")).find(s=>/horario pro|horario|schedule/i.test((s.textContent||"").slice(0,500)));
  if(!target||target.dataset.v423Schedule==="1")return;
  target.dataset.v423Schedule="1";
  Array.from(target.querySelectorAll("button")).forEach(btn=>{const txt=(btn.textContent||"").trim().toLowerCase();if(/guardar|save|actualizar|registrar/.test(txt)){btn.style.maxWidth="max-content";btn.style.width="auto";btn.style.minHeight="auto";btn.style.padding="9px 14px";btn.style.borderRadius="999px";btn.style.fontSize="13px"}});
  const header=target.querySelector(".module-title, .top, .panel h3"),note=document.createElement("span");
  note.className="v442-schedule-compact-note";note.textContent="Horario Pro compactado · botones reducidos";
  if(header&&header.parentNode){if(header.classList&&header.classList.contains("module-title"))header.appendChild(note);else header.parentNode.insertBefore(note,header.nextSibling)}else target.prepend(note);
  Array.from(target.querySelectorAll(".panel")).forEach(panel=>{if((panel.textContent||"").trim().length<8)panel.style.display="none";panel.style.marginBottom="12px"});
};

// ==== v4.17 SECURITY & GOVERNANCE · integrated operational layer ====
function v413TaskBuckets(){
  const tasks=state.tasks||[],open=tasks.filter(t=>!v412TaskDone(t));
  return {open,late:open.filter(t=>v412TaskOverdue(t)),today:open.filter(t=>t.due_date===today()),review:tasks.filter(t=>["en_revision","observado","corregido"].includes(v412StatusKey(t.status))),mine:open.filter(t=>t.assigned_to===member.id),evidence:tasks.filter(t=>!!t.evidence_url)};
}
function v413RenderHomeCommand(){
  const host=$("v413HomeCommand");if(!host||!member?.id)return;const b=v413TaskBuckets();
  const campaigns=(state.campaigns||[]).filter(c=>!["finalizada","archivada"].includes(v412StatusKey(c.status))),risky=campaigns.filter(c=>(state.tasks||[]).some(t=>t.campaign_id===c.id&&v412TaskOverdue(t)));
  host.innerHTML=`<div class="v413-command"><div class="v413-command-main"><span class="v413-eyebrow">TEAM OPERATIONS</span><h2>Trabajo, entregas y proyectos en una sola lectura.</h2><p>La prioridad es clara: resolver vencimientos, entregar evidencias y mover las campañas hacia aprobación.</p><div class="v413-actions"><button type="button" class="primary" onclick="navTo('myday')">Abrir mi trabajo</button><button type="button" class="ghost" onclick="navTo('campaigns')">Ver proyectos</button><button type="button" class="ghost" onclick="navTo('approvals')">Revisar entregas</button></div></div><div class="v413-command-side"><span class="v413-eyebrow">PULSO OPERATIVO</span><div class="v413-pulse-list" style="margin-top:12px"><div class="v413-pulse ${b.late.length?'danger':'success'}"><span>Tareas vencidas</span><strong>${b.late.length}</strong></div><div class="v413-pulse ${b.review.length?'warning':'success'}"><span>En revisión</span><strong>${b.review.length}</strong></div><div class="v413-pulse ${risky.length?'danger':'success'}"><span>Proyectos en riesgo</span><strong>${risky.length}</strong></div><div class="v413-pulse success"><span>Con evidencia</span><strong>${b.evidence.length}</strong></div></div></div></div>`;
}
function v413RenderTaskCommand(){
  const host=$("v413TaskCommand");if(!host||!member?.id)return;const b=v413TaskBuckets();
  host.innerHTML=`<div class="v413-command"><div class="v413-command-main"><span class="v413-eyebrow">CENTRO DE EJECUCIÓN</span><h2>${b.mine.length?`Tienes ${b.mine.length} tareas abiertas.`:'Tu cola personal está al día.'}</h2><p>Entrega evidencias desde cada tarea y separa claramente ejecución, revisión y aprobación.</p><div class="v413-actions"><button type="button" class="primary" onclick="v413SetTaskScope('mine')">Mis tareas</button><button type="button" class="ghost" onclick="v413SetTaskScope('late')">Vencidas</button><button type="button" class="ghost" onclick="v413SetTaskScope('review')">En revisión</button></div></div><div class="v413-command-side"><span class="v413-eyebrow">ESTADO</span><div class="v413-pulse-list" style="margin-top:12px"><div class="v413-pulse ${b.late.length?'danger':'success'}"><span>Riesgo</span><strong>${b.late.length}</strong></div><div class="v413-pulse warning"><span>Hoy</span><strong>${b.today.length}</strong></div><div class="v413-pulse success"><span>Evidencias</span><strong>${b.evidence.length}</strong></div></div></div></div>`;
}
function v413SetTaskScope(scope){v412TaskView.scope=scope;if($("v412TaskScope"))$("v412TaskScope").value=scope;renderTasks();const board=$("taskKanban");if(board)board.scrollIntoView({behavior:"smooth",block:"start"})}
function v413BindDynamicTaskCards(){document.querySelectorAll("[data-task-id]").forEach(el=>{if(el.dataset.v413Bound==="1")return;el.dataset.v413Bound="1";el.addEventListener("click",()=>v412OpenTask(el.dataset.taskId))})}
function v413TogglePanel(id,show){const el=$(id);if(!el)return;const shouldShow=show??el.classList.contains("v413-collapsed");el.classList.toggle("v413-collapsed",!shouldShow);if(shouldShow)el.scrollIntoView({behavior:"smooth",block:"start"})}
function v413PrepareTaskUpdate(id,status){navTo("tasks");v413TogglePanel("v413UpdateTaskPanel",true);if($("updateTaskId"))$("updateTaskId").value=id;if(status&&$("updateTaskStatus"))$("updateTaskStatus").value=status;if($("updateEvidence"))$("updateEvidence").focus()}
async function v413DeliverTask(id){
  const task=by(state.tasks,id);if(!task)return;
  const evidence=await premiumInputModal({title:"Entregar evidencia",subtitle:"Pega el enlace final de Drive, Canva, video o publicación.",icon:"✓",label:"Enlace de evidencia",placeholder:"https://...",preview:`<strong>${esc(task.title)}</strong><p>${esc(task.description||"")}</p>`,confirmLabel:"Enviar a revisión",required:true});
  if(evidence===null)return;
  const comment=await premiumInputModal({title:"Comentario de entrega",subtitle:"Resume qué se realizó y qué debe revisar el supervisor.",icon:"",label:"Comentario",placeholder:"Entregable final listo para revisión…",confirmLabel:"Confirmar entrega",required:false});
  if(comment===null)return;
  try{const {error}=await sb.rpc("ibm_v30_update_task",{p_task_id:id,p_status:"en_revision",p_evidence_url:evidence,p_quality:null,p_comment:comment||"Entrega enviada a revisión"});if(error)throw error;premiumToast("Entrega enviada","La evidencia quedó registrada y la tarea pasó a revisión.","success");await loadAll();await renderAll();navTo("myday")}catch(err){premiumToast("No se pudo entregar",err.message,"error")}
}
function v413ShowCampaignForms(){v413TogglePanel("v413CampaignForms",true);if($("campaignName"))$("campaignName").focus()}
function v413OpenCampaign(id){
  const c=by(state.campaigns,id);if(!c)return;const tasks=(state.tasks||[]).filter(t=>t.campaign_id===id),done=tasks.filter(v412TaskDone),late=tasks.filter(t=>v412TaskOverdue(t)),briefs=(state.briefs||[]).filter(b=>b.campaign_id===id),editorial=(state.editorial||[]).filter(e=>e.campaign_id===id),assets=(state.assets||[]).filter(a=>a.campaign_id===id);const progress=tasks.length?Math.round(done.length*100/tasks.length):0;
  openPremiumModal({title:c.name||"Proyecto",subtitle:`${nameOf(state.clients,c.client_id)||"Sin cliente"} · ${c.status||"planificación"}`,icon:"",body:`<div class="v412-task-detail"><div class="v412-task-detail-grid"><div class="v412-task-detail-box"><span>Avance</span><strong>${progress}%</strong></div><div class="v412-task-detail-box"><span>Tareas</span><strong>${tasks.length}</strong></div><div class="v412-task-detail-box"><span>Vencidas</span><strong>${late.length}</strong></div><div class="v412-task-detail-box"><span>Entregables</span><strong>${assets.length}</strong></div><div class="v412-task-detail-box"><span>Briefs</span><strong>${briefs.length}</strong></div><div class="v412-task-detail-box"><span>Publicaciones</span><strong>${editorial.length}</strong></div></div><div class="v412-task-detail-box"><span>Objetivo</span><p>${esc(c.objective||"Sin objetivo registrado")}</p></div><div class="v412-task-detail-box"><span>Tareas vinculadas</span>${tasks.length?tasks.slice(0,10).map(t=>`<div class="v413-mini-item" data-task-id="${esc(t.id)}"><div><strong>${esc(t.title)}</strong><span>${esc(memberName(t.assigned_to))} · ${esc(t.status||"")}</span></div><span>${esc(v412DateLabel(t.due_date))}</span></div>`).join(""):`<p>Sin tareas vinculadas.</p>`}</div><div class="v413-detail-actions"><button type="button" class="primary" onclick="closePremiumModal();navTo('tasks');if($('taskCampaign'))$('taskCampaign').value='${esc(c.id)}';v413TogglePanel('v413CreateTaskPanel',true)">Crear tarea</button><button type="button" class="ghost" onclick="closePremiumModal();navTo('editorial')">Ver editorial</button></div></div>`,actions:[{label:"Cerrar",value:true,className:"ghost"}]});setTimeout(v413BindDynamicTaskCards,0)
}
function v413FormDraftKey(form){return `inbestiga:v413:draft:${member?.id||'anon'}:${form.id}`}
function v413SaveFormDraft(form){const payload={};form.querySelectorAll("input,textarea,select").forEach(el=>{if(!el.id||el.type==="file"||el.type==="password")return;payload[el.id]=el.value});try{localStorage.setItem(v413FormDraftKey(form),JSON.stringify({saved_at:new Date().toISOString(),payload}));const note=form.querySelector(".v413-draft-note");if(note){note.textContent="Borrador local guardado";note.classList.add("show")}}catch(e){}}
function v413RestoreFormDraft(form){try{const raw=localStorage.getItem(v413FormDraftKey(form));if(!raw)return;const data=JSON.parse(raw);Object.entries(data.payload||{}).forEach(([id,value])=>{const el=$(id);if(el&&!el.value)el.value=value});const note=form.querySelector(".v413-draft-note");if(note){note.textContent="Se recuperó un borrador local no enviado.";note.classList.add("show")}}catch(e){}}
function v413ClearFormDraft(form){try{localStorage.removeItem(v413FormDraftKey(form))}catch(e){}const note=form.querySelector(".v413-draft-note");if(note)note.classList.remove("show")}
function v413BindDrafts(){["taskForm","taskUpdateForm","campaignForm","briefForm","editorialForm","postForm"].forEach(id=>{const form=$(id);if(!form||form.dataset.v413Draft==="1")return;form.dataset.v413Draft="1";const note=document.createElement("div");note.className="v413-draft-note";form.appendChild(note);v413RestoreFormDraft(form);form.addEventListener("input",()=>v413SaveFormDraft(form));form.addEventListener("submit",()=>setTimeout(()=>v413ClearFormDraft(form),0))})}
function v413Bind(){
  if($("v413ToggleCreate"))$("v413ToggleCreate").onclick=()=>v413TogglePanel("v413CreateTaskPanel");
  if($("v413ToggleUpdate"))$("v413ToggleUpdate").onclick=()=>v413TogglePanel("v413UpdateTaskPanel");
  if($("v413ToggleCampaignForms"))$("v413ToggleCampaignForms").onclick=()=>v413TogglePanel("v413CampaignForms");
  if($("v413ApprovalToolbar"))$("v413ApprovalToolbar").addEventListener("click",e=>{const b=e.target.closest("[data-approval-filter]");if(!b)return;v413ApprovalFilter=b.dataset.approvalFilter;renderApprovals()});
  v413BindDrafts();
}


const v414Perf={startedAt:performance.now(),phases:{startup:{start:performance.now(),duration:null}},renders:[],audit:[]};
function v414PerfStart(name){v414Perf.phases[name]={start:performance.now(),duration:null}}
function v414PerfEnd(name){const p=v414Perf.phases[name]||(v414Perf.phases[name]={start:performance.now()});p.duration=Math.max(0,performance.now()-p.start);p.end=performance.now();return p.duration}
function v414RecordRender(section,label,duration){v414Perf.renders.push({section,label,duration:Number(duration||0),at:new Date().toISOString()});if(v414Perf.renders.length>80)v414Perf.renders.splice(0,v414Perf.renders.length-80)}
function v414Audit(type,label,detail=""){v414Perf.audit.push({type,label,detail,at:new Date().toISOString()});if(v414Perf.audit.length>100)v414Perf.audit.shift()}
function v414Ms(value){return Number.isFinite(value)?`${Math.round(value)} ms`:"--"}
function v414HealthRows(){
  const tasks=state.tasks||[],campaigns=state.campaigns||[],members=state.members||[],briefs=state.briefs||[],assets=state.assets||[];
  return [
    {label:"Tareas sin responsable",value:tasks.filter(t=>!t.assigned_to).length,detail:"Dificultan seguimiento y carga laboral."},
    {label:"Tareas abiertas sin fecha",value:tasks.filter(t=>!v412TaskDone(t)&&!t.due_date).length,detail:"No pueden priorizarse por vencimiento."},
    {label:"Proyectos sin brief",value:campaigns.filter(c=>!briefs.some(b=>b.campaign_id===c.id)).length,detail:"Conviene documentar objetivo y entregables."},
    {label:"Miembros sin vinculacion Auth",value:members.filter(m=>!m.auth_user_id).length,detail:"Solo aplica si deben iniciar sesion."},
    {label:"Archivos sin proyecto",value:assets.filter(a=>!a.campaign_id&&!a.related_task_id).length,detail:"Pueden perder contexto operativo."},
    {label:"Errores registrados",value:(state.client_errors||[]).length,detail:"Revisar Auditoria Pro si el valor aumenta."}
  ];
}
function renderPerformance(){
  const nav=performance.getEntriesByType("navigation")[0],startup=v414Perf.phases.startup?.duration,load=v414Perf.phases.loadAll?.duration,render=v414Perf.phases.renderAll?.duration,last=v414Perf.renders[v414Perf.renders.length-1];
  if($("v414PerfMetrics"))$("v414PerfMetrics").innerHTML=[["Inicio total",v414Ms(startup)],["Carga Supabase",v414Ms(load)],["Render esencial",v414Ms(render)],["Ultimo modulo",last?v414Ms(last.duration):"--"]].map(x=>`<div class="v414-perf-card"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
  const recent=v414Perf.renders.slice().sort((a,b)=>b.duration-a.duration).slice(0,18);
  if($("v414PerfTimeline"))$("v414PerfTimeline").innerHTML=`<table class="v414-perf-table"><thead><tr><th>Modulo</th><th>Duracion</th><th>Hora</th></tr></thead><tbody>${recent.map(r=>`<tr><td>${esc(r.label||r.section)}</td><td>${v414Ms(r.duration)}</td><td>${new Date(r.at).toLocaleTimeString("es-PE")}</td></tr>`).join("")}</tbody></table>`||"<p>Abre modulos para registrar sus tiempos.</p>";
  const health=v414HealthRows();
  if($("v414DataHealth"))$("v414DataHealth").innerHTML=health.map(h=>`<div class="v414-health-row ${h.value>5?'bad':h.value?'warn':''}"><i></i><div><strong>${esc(h.label)}</strong><p>${esc(h.detail)}</p></div><strong>${h.value}</strong></div>`).join("");
  const inventory=Object.entries(state||{}).filter(([,v])=>Array.isArray(v)).map(([k,v])=>({k,n:v.length})).sort((a,b)=>b.n-a.n);
  if($("v414DataInventory"))$("v414DataInventory").innerHTML=`<table class="v414-perf-table"><thead><tr><th>Coleccion</th><th>Registros</th></tr></thead><tbody>${inventory.map(x=>`<tr><td>${esc(x.k)}</td><td>${x.n}</td></tr>`).join("")}</tbody></table>`;
}
function v414Bind(){
  const searchType=$("v414SearchType");if(searchType)searchType.onchange=renderSearch;
  const filterMap={v414ControlPeriod:"period",v414ControlArea:"area",v414ControlMember:"member",v414ControlCampaign:"campaign"};
  Object.entries(filterMap).forEach(([id,key])=>{const el=$(id);if(!el)return;el.onchange=()=>{v414ControlFilter[key]=el.value;renderControl()}});
  if($("v414ControlClear"))$("v414ControlClear").onclick=()=>{Object.assign(v414ControlFilter,{period:"30",area:"",member:"",campaign:""});renderControl()};
  if($("v414PerfRefresh"))$("v414PerfRefresh").onclick=()=>{renderPerformance();premiumToast("Diagnostico actualizado","Los tiempos corresponden a esta sesion.","success")};
  document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&String(e.key).toLowerCase()==="k"){e.preventDefault();navTo("search");setTimeout(()=>$("globalSearch")?.focus(),40)}});
  window.addEventListener("online",()=>v414Audit("connection","online",""));
  window.addEventListener("offline",()=>v414Audit("connection","offline",""));
}

window.addEventListener("beforeunload",()=>{try{touchPresence("offline",currentSection)}catch(e){}});
function v121StartCore(){
  if(window.__inbestigaCoreStarted)return;
  if(!window.__inbestigaModulesReady){setTimeout(v121StartCore,16);return}
  window.__inbestigaCoreStarted=true;
  bind();
  v413Bind();
  v414Bind();
  boot();
}
window.v121StartCore=v121StartCore;
