# Diseño de publicación en Vercel y migración a Supabase

Fecha: 2026-09-01

## Objetivo

Publicar en Vercel únicamente el sistema web de One Studios, conservar la API
de DeColecta y migrar a un proyecto Supabase nuevo la información real que hoy
reside en el entorno Supabase local de Docker. Los tres usuarios conservarán
sus cuentas y contraseñas actuales.

## Alcance aprobado

La publicación incluirá:

- La aplicación web principal.
- La PWA de Solicitudes 360.
- Los recursos web necesarios para ambos clientes.
- La función serverless `/api/decolecta`.
- La conexión del navegador al proyecto Supabase nuevo mediante su URL y clave
  pública.

La publicación excluirá:

- SAKURA, Ollama, el puente local y toda interfaz o recurso visible de SAKURA.
- La función `/api/sakura-web`.
- Instaladores, ejecutables, scripts de Windows y artefactos de empaquetado.
- Docker, SQL local, migraciones como archivos descargables, respaldos,
  documentación interna, pruebas y herramientas de desarrollo.
- MariaDB y componentes de XAMPP.
- `supabase/seed.sql` y la cuenta local de desarrollo que contiene.

## Arquitectura de producción

Vercel servirá los clientes web y ejecutará `/api/decolecta`. El navegador se
comunicará directamente con Supabase para Auth, PostgreSQL mediante Data API y
RPC, Storage y Realtime. La función DeColecta validará la sesión del usuario
contra Supabase antes de consultar el proveedor externo.

Las credenciales se separarán así:

- El navegador recibirá solamente la URL y clave pública de Supabase.
- Vercel conservará `DECOLECTA_TOKEN` como variable secreta.
- No se usará ni publicará una clave `service_role`.
- La contraseña de PostgreSQL no se guardará en el repositorio ni se enviará
  en mensajes; se introducirá mediante una sesión interactiva o almacenamiento
  local temporal protegido.

## Estado de origen verificado

El origen es Supabase local sobre PostgreSQL 17.6 dentro de Docker. Al momento
del inventario contiene:

- Base de datos de 15 MB.
- 3 usuarios de Auth.
- 1 cliente.
- 2 contratos, 4 cuotas y 11 movimientos financieros.
- 5 roles y 247 asignaciones de permisos.
- 3 buckets privados y 0 objetos almacenados.
- 16 migraciones registradas como aplicadas.

Docker permanecerá sin cambios durante y después de la migración, y actuará
como respaldo operativo hasta que producción sea aceptada.

## Estrategia de migración

Se usará una clonación lógica completa y controlada hacia un proyecto Supabase
nuevo y vacío. Antes de restaurar se confirmará compatibilidad de versión de
PostgreSQL y se producirán dos artefactos locales:

1. Un respaldo lógico restaurable de roles, esquema y datos.
2. Un inventario de control con cantidades, objetos de esquema, funciones,
   políticas, buckets y migraciones.

La restauración preservará:

- Esquemas de aplicación, tablas públicas y sus datos.
- Funciones RPC, triggers, grants y políticas RLS.
- `auth.users`, `auth.identities` y los hashes de contraseña.
- Datos de negocio y relaciones por UUID.
- Buckets y políticas de Storage.
- Historial de migraciones.

No se migrarán sesiones ni tokens activos. Debido a que el proyecto nuevo
tendrá claves JWT distintas, los usuarios iniciarán sesión nuevamente usando
sus contraseñas actuales. No se ejecutará `seed.sql` ni se usará
`db reset --linked`.

La restauración debe ser transaccional y detenerse ante el primer error. Si una
etapa falla, no se conectará Vercel al destino y Docker seguirá siendo la fuente
vigente.

## Paquete web para Vercel

Se creará un proceso de construcción reproducible que genere un artefacto web
permitido explícitamente. El artefacto incluirá solo los clientes web y recursos
necesarios. No se publicará directamente todo el directorio del repositorio.

El proceso de construcción:

- Eliminará referencias a scripts, estilos, controles y rutas de SAKURA.
- Generará la configuración pública a partir de `SUPABASE_URL` y
  `SUPABASE_ANON_KEY` definidas en Vercel.
- Ajustará el service worker para almacenar solamente recursos presentes en el
  artefacto.
- Conservará `/api/decolecta` como la única función serverless de esta fase.
- Fallará si faltan variables obligatorias o si una referencia local apunta a
  un archivo no incluido.

`.vercelignore` excluirá, como segunda barrera, los directorios locales,
respaldos, SQL, instaladores y archivos de gran tamaño.

## Configuración externa

El propietario creará Supabase y Vercel con
`71849684@continental.edu.pe` y completará las confirmaciones de correo. El
proyecto Supabase nuevo proporcionará un nuevo `project-ref`, URL, clave pública
y contraseña de base de datos.

Vercel tendrá estas variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `DECOLECTA_TOKEN`
- Los endpoints DeColecta opcionales solamente si deben sobrescribirse sus
  valores predeterminados.

Tras obtener la URL definitiva de Vercel, Supabase Auth configurará esa URL
como Site URL y permitirá las redirecciones necesarias de producción y preview.

## Verificación y aceptación

Antes de conectar Vercel se compararán origen y destino por cantidades y
contratos de esquema. La migración se considerará válida solamente si:

- Existen los 3 usuarios y cada uno puede iniciar sesión con su contraseña
  actual.
- Coinciden cliente, contratos, cuotas, movimientos, roles y permisos.
- Las 16 migraciones constan en el historial remoto.
- Las funciones RPC, grants y políticas RLS requeridas existen.
- Los 3 buckets privados y sus políticas existen.

El despliegue preview se aceptará solamente si:

- Funcionan inicio, navegación, autenticación y operaciones autorizadas.
- Funcionan tesorería, Solicitudes 360, Realtime y Storage.
- Una consulta autenticada DNI/RUC atraviesa `/api/decolecta` sin exponer el
  token.
- La PWA instala y actualiza sin referencias faltantes.
- No hay botones, paneles, solicitudes de red ni errores de SAKURA.
- Ningún SQL, respaldo, instalador o archivo local es accesible públicamente.

Después de estas comprobaciones, el mismo despliegue preview podrá promoverse a
producción. Docker no se eliminará como parte de este trabajo.

## Recuperación ante fallos

Hasta la aceptación final, la recuperación consiste en mantener Vercel sin
promover, desconectar el proyecto Supabase nuevo y volver a utilizar Docker. No
se requiere revertir ni restaurar el origen porque la migración no lo modifica.

