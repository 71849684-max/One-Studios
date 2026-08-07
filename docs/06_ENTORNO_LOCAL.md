# Entorno local

## Requisitos

- XAMPP con Apache.
- Navegador moderno.
- Acceso de red a Supabase y CDN mientras no se vendorizan las dependencias.
- Node.js para verificaciones.
- Python y Ollama solo para SAKURA local.

## Arranque

1. Iniciar Apache desde XAMPP.
2. Confirmar `http://127.0.0.1/Plataforma%20Marketing/`.
3. Ejecutar `npm run verify` desde la raíz.
4. Revisar consola del navegador antes de autenticar.

La aplicación principal no necesita MySQL local; sus datos viven en Supabase. MySQL puede estar activo por otros proyectos de XAMPP, pero no forma parte del contrato de Marketing Cloud.

## Diagnóstico

- `ERR_CONNECTION_REFUSED`: Apache no está escuchando.
- Pantalla de configuración: no cargó el cliente Supabase o falta configuración pública.
- Login visible sin errores: shell y dependencias esenciales cargaron.
- PWA desactualizada: revisar `service-worker.js`, limpiar solo la caché de este origen y recargar.
