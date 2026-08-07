# Plan de refactorización

## Fase 0 — Baseline

- Repositorio Git y commit de rescate.
- Entorno HTTP local.
- Verificador reproducible.
- Documentación canónica.
- Extracción mecánica de código incrustado.

## Fase 1 — Infraestructura

- Cliente Supabase único.
- Gestión central de sesión y errores.
- Renderizado seguro y utilidades compartidas.
- Manifiesto y service worker generados desde una fuente única.

## Fase 2 — Dominios

Orden sugerido:

1. Acceso y bootstrap.
2. Tareas.
3. Campañas/editorial.
4. Equipo y permisos.
5. Mensajería.
6. Solicitudes 360.
7. SAKURA.

## Fase 3 — Base de datos

- Inventario remoto.
- Baseline declarativo.
- Migraciones incrementales.
- Pruebas de contrato y seguridad.

## Criterio por cambio

- Sintaxis y referencias válidas.
- Pantalla de acceso carga sin errores.
- No cambia el contrato RPC sin migración y prueba.
- Caché PWA contiene los recursos productivos.
- Commit pequeño y reversible.
