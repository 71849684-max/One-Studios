# One Studios — Marketing Cloud

Aplicación web para operación de marketing, trabajo colaborativo, mensajería y asistencia SAKURA.

## Stack

- HTML, CSS y JavaScript vanilla.
- Supabase: Auth, PostgreSQL, RPC, Storage y Realtime.
- PWA desplegable en Vercel.
- Puente local Python para SAKURA/Ollama.
- XAMPP para validación HTTP local.

## Arquitectura durante la transición

```text
index.html                 shell y vistas legacy
assets/css/                estilos productivos
assets/js/                 módulos productivos
config/                    configuración pública y manifiestos
api/                       adaptadores serverless
solicitudes/               PWA de Solicitudes 360
SAKURA_LOCAL_BRIDGE/       integración local con Ollama
supabase/                  contrato y migraciones canónicas nuevas
ops/                       operaciones administrativas
tools/                     verificadores y utilidades de refactorización
docs/                      documentación canónica
```

La arquitectura objetivo y las reglas de dependencia están documentadas en [`docs/00_README.md`](docs/00_README.md).

## Verificación

```powershell
npm run verify
```

La verificación no necesita instalar dependencias. Comprueba sintaxis JavaScript, JSON, referencias locales y alineación básica de versión.

## Entorno local

URL XAMPP:

```text
http://127.0.0.1/Plataforma%20Marketing/
```

No se debe abrir `index.html` directamente con `file://`, porque la PWA, los módulos y las políticas del navegador necesitan HTTP.

## Regla principal

No agregar nuevas funciones directamente al monolito. Todo código nuevo debe entrar por una carpeta de dominio bajo `src/features/` y acceder a Supabase mediante `src/services/`.

## Estructura activa

- `assets/`: recursos del navegador.
- `src/`: cÃ³digo modular nuevo.
- `config/`: configuraciÃ³n vigente.
- `docs/`: documentaciÃ³n canÃ³nica e historial consolidado.
- `archive/`: SQL heredado conservado fuera de la raÃ­z operativa.
- `scripts/windows/`: utilidades locales de SAKURA.
- `supabase/migrations/`: nuevas migraciones de base de datos.
- `tests/` y `tools/`: controles automatizados.

Los reportes de entrega, hashes y auditorÃ­as histÃ³ricas se consultan en Git y no se duplican en la raÃ­z.
