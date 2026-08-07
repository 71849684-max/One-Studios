# Contrato de base de datos

## Reglas

- `supabase/migrations/` será la única secuencia autorizada para cambios nuevos.
- Los SQL históricos de la raíz no se ejecutan automáticamente.
- Cada migración es inmutable después de aplicarse.
- Toda tabla expuesta debe habilitar RLS y declarar políticas explícitas.
- Toda función `SECURITY DEFINER` debe fijar `search_path` y revocar ejecución pública antes de concederla a roles concretos.
- El navegador usa únicamente la clave anónima pública.
- Operaciones destructivas viven en `ops/destructive/` y exigen verificación previa y posterior.

## Respuesta de servicios

Los adaptadores nuevos normalizarán resultados como:

```js
{
  ok: true,
  data: {},
  error: null
}
```

## Verificación pendiente

Antes de consolidar migraciones se debe exportar de la instancia real:

- tablas y columnas;
- índices, restricciones y triggers;
- funciones y firmas;
- grants y políticas RLS;
- buckets y políticas de Storage;
- publicaciones Realtime.

No se debe inferir el estado productivo únicamente a partir de los SQL entregados.
