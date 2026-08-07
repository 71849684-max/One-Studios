# Historial consolidado del sistema

Este documento reemplaza los archivos TXT, JSON y Markdown de entrega, auditorÃ­a, certificaciÃ³n, hashes y continuidad que se acumularon en la raÃ­z y en `docs/`.

## Procedencia y recuperaciÃ³n

- Repositorio: `https://github.com/71849684-max/One-Studios.git`
- LÃ­nea base recuperada: `v17.16.7`.
- Los originales permanecen recuperables en Git, especialmente en los commits `dac6e1a` y `a0b6d3a`.
- Fecha de consolidaciÃ³n: 2026-08-07.

## EvoluciÃ³n resumida

1. **v14:** lÃ­nea base funcional y primeras certificaciones.
2. **v15:** colaboraciÃ³n, campaÃ±as y sistema operativo de marketing.
3. **v16:** productividad, operaciones en tiempo real y endurecimiento.
4. **v17.0â€“v17.11:** Work360, salud, ciclos, equipos, diseÃ±o y colaboraciÃ³n.
5. **v17.12:** PWA y centro de mando operativo.
6. **v17.13:** SAKURA local, piloto nativo y espacios adaptativos.
7. **v17.14:** Academy y estudio personal.
8. **v17.15:** centro de mando unificado, integridad, orbe e interfaz.
9. **v17.16:** Requests360, reinicio limpio, arena creativa y mensajerÃ­a SAKURA.
10. **v17.16.7:** Ãºltima lÃ­nea base recuperada antes de la refactorizaciÃ³n modular.

## Material retirado

Se retiraron auditorÃ­as y certificaciones versionadas, listas de archivos, manifiestos de entrega, comprobantes SHA, prompts de continuidad, notas LEER_PRIMERO, reportes de pruebas, validaciones estÃ¡ticas, diffs protegidos, guÃ­as repetidas, hotfix integrados, manifiestos RPC opcionales y variantes de recursos no utilizadas.

TambiÃ©n se eliminÃ³ `SQL_v17_5_OBSOLETO_NO_EJECUTAR.txt`. Git es la fuente de verdad para consultar el detalle exacto de una entrega pasada.

## SQL heredado conservado

- `archive/sql/required/`: requisitos histÃ³ricos de Solicitudes 360 y SAKURA Messaging V2.
- `archive/sql/optional/`: ampliaciones opcionales desde v16.1 hasta v17.12.
- `archive/sql/sakura-native/`: piloto nativo SAKURA y su rollback.
- `archive/sql/destructive/`: operaciones de limpieza que requieren respaldo y ejecuciÃ³n manual explÃ­cita.

Las nuevas modificaciones de base de datos deben crearse en `supabase/migrations/`.

## Regla de mantenimiento

No deben agregarse reportes de entrega, hashes, prompts o auditorÃ­as versionadas a la raÃ­z. Los cambios se documentan en Git y, cuando afectan la operaciÃ³n vigente, en los documentos canÃ³nicos de `docs/`.
