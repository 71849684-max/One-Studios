# Documentación canónica

Este directorio es el punto de entrada documental de One Studios. Sigue la convención usada en Ascientifics: mapa explícito de capas, contrato de base de datos, verificaciones reproducibles y separación visible del código legacy.

## Índice

| Documento | Propósito |
|-----------|-----------|
| [`01_ARQUITECTURA_ACTUAL.md`](01_ARQUITECTURA_ACTUAL.md) | Describe el sistema recuperado sin idealizarlo. |
| [`02_ARQUITECTURA_OBJETIVO.md`](02_ARQUITECTURA_OBJETIVO.md) | Define capas y dependencias permitidas. |
| [`03_MAPA_MODULOS.md`](03_MAPA_MODULOS.md) | Relaciona cada dominio con UI, servicio y RPC. |
| [`04_CONTRATO_BASE_DATOS.md`](04_CONTRATO_BASE_DATOS.md) | Reglas para Supabase, RLS, RPC y migraciones. |
| [`05_PLAN_REFACTORIZACION.md`](05_PLAN_REFACTORIZACION.md) | Fases, riesgos y criterios de aceptación. |
| [`06_ENTORNO_LOCAL.md`](06_ENTORNO_LOCAL.md) | Arranque y diagnóstico del entorno local. |
| [`07_CHECKLIST_BASELINE.md`](07_CHECKLIST_BASELINE.md) | Controles obligatorios antes y después de cambios. |

## Fuente de verdad

- Versión de frontend: `config/build-manifest.json`.
- Recursos realmente cargados: `index.html` y `service-worker.js`.
- Configuración pública: `config/public-runtime-config.js`.
- Base de datos: migraciones nuevas en `supabase/migrations/`.
- SQL histórico: solo referencia; no ejecutar sin reconciliación previa.

Los informes `AUDITORIA_*`, `CERT_*`, `FUNCTIONAL_TESTS_*` y archivos similares son evidencia histórica. No sustituyen las pruebas ejecutables.

- [Historial legado consolidado](./HISTORIAL_LEGACY.md)
