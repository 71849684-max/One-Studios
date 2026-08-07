# Arquitectura objetivo

## Cadena

```text
Vista / componente
  → caso de uso del dominio
  → servicio o repositorio
  → Supabase RPC / Auth / Storage / Realtime
  → PostgreSQL con RLS
```

Es el equivalente para JavaScript/Supabase de la cadena usada en Ascientifics: vista → controller → service → procedimiento almacenado → base de datos.

## Estructura

```text
src/
  app/               arranque, sesión y navegación
  components/        UI reutilizable
  features/          dominios funcionales
  services/          límites de infraestructura
  security/          escape, validación y permisos
  shared/            utilidades sin dependencia de dominio
supabase/
  migrations/        cambios inmutables y ordenados
  verification/      consultas de comprobación
ops/
  destructive/       scripts de alto riesgo
tests/
  smoke/             carga y navegación
  contract/          RPC, permisos y respuestas
```

## Dependencias permitidas

- `features` puede usar `components`, `services`, `security` y `shared`.
- `components` no llama directamente a Supabase.
- `services` no manipula DOM.
- `security` no depende de dominios.
- Código nuevo no crea variables globales; los adaptadores legacy son la única excepción temporal.
- Ninguna operación sensible se autoriza solo desde la UI; debe validarse en RPC/RLS.
