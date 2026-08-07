(function(){
  if(window.__IBM_V472_TOPNAV__) return;
  window.__IBM_V472_TOPNAV__ = true;

  var NAV = [
    {
      id:"principal",
      label:"Principal",
      title:"Inicio y vista general",
      subtitle:"Accede rápido a lo más importante de Marketing Cloud.",
      links:[
        ["Inicio","home"],
        ["Mi día","myday"],
        ["Buscador","search"],
        ["Notificaciones","notifications"]
      ],
      small:[
        ["Mi espacio","profile"],
        ["Equipo","team"]
      ]
    },
    {
      id:"trabajo",
      label:"Trabajo",
      title:"Trabajo, tareas y aprobaciones",
      subtitle:"Gestiona avance, carga del equipo, tareas y revisiones.",
      links:[
        ["Trabajo 360","workIntel"],
        ["Horario Pro","schedulePro"],
        ["Tareas","tasks"],
        ["Aprobaciones","approvals"],
        ["Carga del equipo","workload"]
      ],
      small:[
        ["Mi día","myday"],
        ["Reportes","reports"]
      ]
    },
    {
      id:"planificacion",
      label:"Planificación",
      title:"Proyectos y calendario editorial",
      subtitle:"Ordena campañas, briefs, publicaciones y ejecución.",
      links:[
        ["Proyectos","campaigns"],
        ["Editorial","editorial"],
        ["Calendario operativo","calendarOps"],
        ["Plantillas","templates"],
        ["Assets","assets"]
      ],
      small:[
        ["Incidencias","incidents"],
        ["Reportes","reports"]
      ]
    },
    {
      id:"creativo",
      label:"Creativo",
      title:"Crea visualmente",
      subtitle:"Entra a salas creativas, storyboards, referencias e ideas.",
      links:[
        ["Salas creativas","creativeRoomsClean"],
        ["Hub creativo","hub"],
        ["Assets","assets"],
        ["Plantillas","templates"]
      ],
      small:[
        ["Comienza a crear","creativeRoomsClean"],
        ["Muro creativo","wall"]
      ]
    },
    {
      id:"social",
      label:"Social",
      title:"Muro, mensajes y actividad",
      subtitle:"Comunicación interna, publicaciones, mensajes y señales del equipo.",
      links:[
        ["Muro","wall"],
        ["Mensajes","messages"],
        ["Notificaciones","notifications"],
        ["En vivo","live"],
        ["Mi basurero","socialTrash"]
      ],
      small:[
        ["Perfil","profile"],
        ["Equipo","team"]
      ]
    },
    {
      id:"control",
      label:"Control",
      title:"Control gerencial",
      subtitle:"Revisa indicadores filtrables, rendimiento, auditoría, permisos e incidencias.",
      links:[
        ["Control gerencial","control"],
        ["Rendimiento técnico","performance"],
        ["Reportes Pro","reports"],
        ["Automatizaciones","automations"],
        ["Seguridad y gobernanza","governance"],
        ["Auditoría Pro","auditpro"],
        ["Incidencias","incidents"]
      ],
      small:[
        ["Permisos","permissions"],
        ["Admin","admin"]
      ]
    },
    {
      id:"admin",
      label:"Admin",
      title:"Administración",
      subtitle:"Configura usuarios, permisos y ajustes de la plataforma.",
      links:[
        ["Admin","admin"],
        ["Permisos","permissions"],
        ["Ajustes","settings"],
        ["Equipo","team"]
      ],
      small:[
        ["Perfil","profile"],
        ["Auditoría Pro","auditpro"]
      ]
    }
  ];

  function $(sel, root){ return (root || document).querySelector(sel); }
  function $all(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }
  function esc(v){ return String(v == null ? "" : v).replace(/[&<>"']/g,function(m){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]; }); }
  function icon(name){
    if(name === "search") return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>';
    if(name === "bag") return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>';
    if(name === "menu") return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>';
    return "";
  }
  function routeTo(id){
    closeAll();
    try{
      if(typeof window.navTo === "function") window.navTo(id);
    }catch(e){}
  }
  function createTopNav(){
    if($("#v472AppleTopNav")) return;
    var nav = document.createElement("div");
    nav.id = "v472AppleTopNav";
    nav.innerHTML =
      '<div class="v472-nav-inner">' +
        '<button class="v472-brand" id="v472Brand"><span class="v472-brand-mark">iB</span><span class="v472-brand-text">Marketing Cloud <small style="font-size:9px;opacity:.55">v4.23</small></span></button>' +
        '<div class="v472-menu">' +
          NAV.map(function(n){ return '<button class="v472-menu-item" data-v472-menu="'+esc(n.id)+'"><span>'+esc(n.label)+'</span></button>'; }).join("") +
        '</div>' +
        '<div class="v472-right">' +
          '<button class="v472-icon-btn v472-mobile-toggle" id="v472MobileToggle">'+icon("menu")+'</button>' +
          '<button class="v472-icon-btn" id="v472SearchBtn">'+icon("search")+'</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(nav);

    var mega = document.createElement("div");
    mega.id = "v472Mega";
    mega.className = "v472-mega";
    document.body.appendChild(mega);

    var search = document.createElement("div");
    search.id = "v472SearchPanel";
    search.className = "v472-search-panel";
    search.innerHTML =
      '<div class="v472-search-inner">' +
        '<div class="v472-search-box">'+icon("search")+'<input id="v472SearchInput" placeholder="Buscar en Marketing Cloud"></div>' +
        '<div class="v472-search-results" id="v472SearchResults"></div>' +
      '</div>';
    document.body.appendChild(search);

    var dim = document.createElement("div");
    dim.id = "v472Dim";
    dim.className = "v472-dim";
    document.body.appendChild(dim);

    $("#v472Brand").addEventListener("click", function(){ routeTo("home"); });
    $("#v472SearchBtn").addEventListener("click", toggleSearch);
    $("#v472MobileToggle").addEventListener("click", function(){ openMega("principal"); });
    $("#v472Dim").addEventListener("click", closeAll);

    $all("[data-v472-menu]").forEach(function(btn){
      btn.addEventListener("mouseenter", function(){ openMega(btn.getAttribute("data-v472-menu")); });
      btn.addEventListener("click", function(){ openMega(btn.getAttribute("data-v472-menu")); });
    });

    nav.addEventListener("mouseleave", function(){
      // keep mega open like Apple until cursor leaves mega/dim or clicks elsewhere
    });

    search.addEventListener("keydown", function(e){
      if(e.key === "Escape") closeAll();
    });
    $("#v472SearchInput").addEventListener("input", renderSearchResults);
  }
  function openMega(id){
    var cfg = NAV.find(function(n){ return n.id === id; }) || NAV[0];
    var mega = $("#v472Mega");
    if(!mega) return;
    $all(".v472-menu-item").forEach(function(b){ b.classList.toggle("active", b.getAttribute("data-v472-menu") === id); });
    mega.innerHTML =
      '<div class="v472-mega-inner">' +
        '<div>' +
          '<div class="v472-mega-kicker">'+esc(cfg.label)+'</div>' +
          '<h2 class="v472-mega-title">'+esc(cfg.title)+'</h2>' +
          '<p class="v472-mega-subtitle">'+esc(cfg.subtitle)+'</p>' +
        '</div>' +
        '<div class="v472-mega-links">' +
          (cfg.links || []).map(function(x){ return '<button class="v472-mega-link" data-v472-nav="'+esc(x[1])+'">'+esc(x[0])+'</button>'; }).join("") +
        '</div>' +
        '<div class="v472-mega-small">' +
          '<div class="v472-mega-kicker">Accesos rápidos</div>' +
          (cfg.small || []).map(function(x){ return '<button data-v472-nav="'+esc(x[1])+'">'+esc(x[0])+'</button>'; }).join("") +
        '</div>' +
      '</div>';
    mega.classList.add("open");
    $("#v472Dim").classList.add("show");

    $all("[data-v472-nav]", mega).forEach(function(btn){
      btn.addEventListener("click", function(){ routeTo(btn.getAttribute("data-v472-nav")); });
    });
    mega.onmouseleave = function(e){
      // Close when the user moves far below the mega panel.
      setTimeout(function(){
        if(!mega.matches(":hover") && !$("#v472AppleTopNav").matches(":hover")) closeMega();
      }, 220);
    };
  }
  function closeMega(){
    var mega = $("#v472Mega");
    if(mega) mega.classList.remove("open");
    var dim = $("#v472Dim");
    if(dim && !$("#v472SearchPanel").classList.contains("open")) dim.classList.remove("show");
    $all(".v472-menu-item").forEach(function(b){ b.classList.remove("active"); });
  }
  function toggleSearch(){
    var panel = $("#v472SearchPanel");
    if(!panel) return;
    var open = !panel.classList.contains("open");
    closeMega();
    panel.classList.toggle("open", open);
    $("#v472Dim").classList.toggle("show", open);
    if(open){
      renderSearchResults();
      setTimeout(function(){ $("#v472SearchInput").focus(); }, 60);
    }
  }
  function closeAll(){
    closeMega();
    var panel = $("#v472SearchPanel");
    if(panel) panel.classList.remove("open");
    var dim = $("#v472Dim");
    if(dim) dim.classList.remove("show");
  }
  function renderSearchResults(){
    var q = ($("#v472SearchInput") && $("#v472SearchInput").value || "").toLowerCase().trim();
    var all = [];
    NAV.forEach(function(group){
      (group.links || []).forEach(function(x){ all.push({label:x[0], id:x[1], group:group.label}); });
      (group.small || []).forEach(function(x){ all.push({label:x[0], id:x[1], group:group.label}); });
    });
    var seen = {};
    all = all.filter(function(x){ if(seen[x.id]) return false; seen[x.id]=true; return true; });
    if(q) all = all.filter(function(x){ return (x.label + " " + x.group).toLowerCase().includes(q); });
    $("#v472SearchResults").innerHTML = all.slice(0,10).map(function(x){
      return '<button class="v472-search-result" data-v472-search-nav="'+esc(x.id)+'">'+esc(x.label)+' <span style="color:#6e6e73;font-size:12px;font-weight:700;">· '+esc(x.group)+'</span></button>';
    }).join("");
    $all("[data-v472-search-nav]").forEach(function(btn){
      btn.addEventListener("click", function(){ routeTo(btn.getAttribute("data-v472-search-nav")); });
    });
  }
  function activate(){
    createTopNav();
    document.body.classList.add("v472-topnav-on");
    document.body.classList.add("v473-topnav-on");
  }
  function shouldActivate(){
    var setup = document.getElementById("setupScreen") || document.getElementById("loginScreen");
    if(setup && setup.classList && setup.classList.contains("active")) return false;
    return !!document.getElementById("appScreen") || !!document.querySelector(".section");
  }
  function boot(){
    if(shouldActivate()) activate();
  }
  document.addEventListener("DOMContentLoaded", function(){ setTimeout(boot, 300); });
  window.addEventListener("load", function(){ setTimeout(boot, 600); setTimeout(boot, 1600); });
  document.addEventListener("click", function(e){
    if(!e.target.closest("#v472AppleTopNav") && !e.target.closest("#v472Mega") && !e.target.closest("#v472SearchPanel")){
      closeAll();
    }
  });
})();
