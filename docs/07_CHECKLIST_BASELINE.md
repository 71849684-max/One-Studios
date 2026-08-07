# Checklist de baseline

## Antes de modificar

- [ ] Árbol Git limpio.
- [ ] `npm run verify` termina sin errores.
- [ ] HTTP local responde 200.
- [ ] Login visible.
- [ ] Consola sin errores.
- [ ] No hay SQL destructivo en el cambio.

## Después de modificar

- [ ] Sintaxis JavaScript válida.
- [ ] JSON válido.
- [ ] Referencias locales existentes.
- [ ] HTML, manifiesto y service worker alineados.
- [ ] Login visible sin regresión.
- [ ] Consola sin errores nuevos.
- [ ] Cambio documentado y reversible.

## Cambios de base de datos

- [ ] Migración nueva y numerada.
- [ ] Verificación previa.
- [ ] RLS y grants revisados.
- [ ] Verificación posterior.
- [ ] Plan de recuperación explícito.
