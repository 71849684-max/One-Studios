# Mapa de módulos

| Dominio | UI actual | Límite objetivo | Contratos principales |
|---------|-----------|-----------------|-----------------------|
| Acceso | login en `index.html` | `src/app/auth/` | Supabase Auth, `marketing_app.members` |
| Inicio | renderizadores home | `src/features/home/` | bootstrap y preferencias |
| Tareas | kanban y formularios | `src/features/tasks/` | `ibm_v30_create_task`, `ibm_v30_update_task` |
| Campañas | portafolio, brief, editorial | `src/features/campaigns/` | RPC de campañas y briefs |
| Equipo | perfiles, carga, permisos | `src/features/team/` | miembros, roles y permisos |
| Mensajes | conversación y multimedia | `src/features/messaging/` | `ibm_v367_*`, Storage y Realtime |
| Solicitudes 360 | `solicitudes/` | `src/features/requests/` | `ibm_public_request_*` |
| SAKURA | orb, workspace, academy | `src/features/sakura/` | bridge local y RPC autorizadas |
| Auditoría | salud y certificación | `src/features/audit/` | eventos y verificaciones read-only |

Cada dominio deberá tener un README equivalente a los mapas modulares de Ascientifics cuando comience su extracción funcional.
