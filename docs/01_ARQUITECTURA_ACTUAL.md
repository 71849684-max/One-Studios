# Arquitectura actual

## Cadena de ejecución

```text
index.html
  → configuración pública
  → cliente Supabase
  → Auth
  → RPC ibm_v375_bootstrap
  → estado global
  → renderizadores de dominio
  → RPC / Storage / Realtime
```

## Componentes

| Componente | Responsabilidad actual | Riesgo principal |
|------------|------------------------|------------------|
| `index.html` | Shell, vistas, estilos y lógica legacy | Acoplamiento y tamaño. |
| `assets/js/` | Módulos acumulativos y hotfixes | Variantes históricas coexistentes. |
| `service-worker.js` | Shell PWA y caché | Diferencias con recursos del HTML. |
| `config/` | Configuración pública y manifiestos | Mantenimiento manual. |
| `api/` | Funciones serverless | Contrato no probado localmente. |
| Supabase | Auth, datos, RPC, Storage y Realtime | Esquema no reproducible desde una secuencia única. |
| `SAKURA_LOCAL_BRIDGE/` | Ollama, memoria y acciones locales | Ciclo de vida independiente. |

## Regla de compatibilidad

El código legacy sigue siendo productivo durante la transición. Se puede extraer y envolver, pero no reescribir en bloque. Cada extracción debe conservar orden de carga, nombres globales y contrato RPC hasta disponer de pruebas funcionales equivalentes.
