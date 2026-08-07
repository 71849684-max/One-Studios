(function(){
  if(window.__IBM_V412_ENHANCER__)return;window.__IBM_V412_ENHANCER__=true;
  function title(id,title,subtitle){const el=document.getElementById(id);if(!el||el.dataset.v412Title==="1")return;el.dataset.v412Title="1";const head=document.createElement("div");head.className="v47-section-title";head.innerHTML=`<h2>${title}</h2><p>${subtitle}</p>`;el.insertBefore(head,el.firstChild)}
  window.v412EnhanceSections=function(){title("wall","Muro del equipo","Publicaciones, comentarios y avances reales en un solo lugar.");title("workIntel","Trabajo 360","Progreso, carga y prioridades por miembro.");title("schedulePro","Horario Pro","Planificación semanal y disponibilidad del equipo.");title("campaigns","Proyectos y campañas","Tareas, briefs, evidencias y publicaciones conectadas.")};
  document.addEventListener("DOMContentLoaded",()=>window.v412EnhanceSections());
})();
