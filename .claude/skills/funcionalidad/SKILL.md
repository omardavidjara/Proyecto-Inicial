---
name: funcionalidad
description: Ciclo completo para construir una funcionalidad o arreglo en un proyecto con main protegida - rama, plan con OK del usuario, implementación con tests, comprobación, PR con CI en verde y actualización de ROADMAP/SPEC/ARCHITECTURE. Úsala al empezar cualquier funcionalidad (F1, F2…), arreglo o cambio que acabe en una PR.
---

# Ciclo de una funcionalidad

`rama → 🛑 plan y OK → implementar con tests → check → push → CI verde → PR → el usuario pide fusionar`

## 1. Rama
`git switch main && git pull` y `git switch -c feat/<fN>-<nombre-corto>` (o `fix/`, `docs/`, `ci/`).

## 2. Plan (🛑 espera el OK)
Antes de escribir código, lee solo lo que toca: la sección de `docs/SPEC.md`, las tablas/rutas/permisos de `docs/ARCHITECTURE.md` y, si consume recursos (cron, subidas, consultas frecuentes, servicios nuevos), `docs/LIMITS.md`.

Plan breve (no más de una pantalla):
- Qué verá el usuario y qué cambia en datos (tablas, migraciones, restricciones).
- Archivos nuevos o tocados siguiendo los patrones del proyecto.
- Permisos: quién puede hacer qué y dónde se comprueba en el servidor.
- Límites de planes gratuitos afectados y alternativa si los hay.
- Datos personales o proveedores nuevos → hay que actualizar la página de privacidad.
- **Si es grande, divídela en 2–3 PR** (p. ej. 1: reglas y datos; 2: pantallas; 3: resto) y numéralas en el ROADMAP.

## 3. Implementar
- Tests junto a la funcionalidad (`__tests__/`): reglas puras, capa de datos contra BD real en memoria si el stack lo permite, componentes clave. Incluye el caso "otro usuario no ve/no toca esto".
- Valida toda entrada en el servidor (Zod). Recurso ajeno = inexistente.
- Cambios de esquema solo por el ORM + migración generada.
- Commits pequeños `feat(Fn): …`.

## 4. Comprobar
`npm run check` (lint + tipos + tests) y, si se tocó build/config, `npm run build`. Si hay migración: no se aplica a producción sin el usuario (`! npm run db:migrate`) y antes se comprueba solo leyendo que los datos existentes cumplen las reglas nuevas.

## 5. PR
`git push -u origin HEAD` y `gh pr create` con este cuerpo:

```
Fn · PR X de Y[: cierra Fn].

## Qué cambia
- (lo que verá el usuario, en su idioma)
- (capa de datos / reglas)

[Sin cambios de esquema ni migraciones. | Migración NNNN: … (aplicar con `npm run db:migrate` antes de fusionar)]

## Pruebas
- `npm run check`: N tests en verde (nuevos: …)
- `npm run build` correcto
- Cómo probarlo en la preview: …
```

Espera la CI (`gh pr checks --watch`). Si falla, arréglalo en la misma rama.

## 6. Cerrar
- Marca la casilla en `docs/ROADMAP.md` con fecha, PRs y **pendientes heredados** ("Pendiente para F10: …").
- Si cambió lo que hace la app o su modelo, actualiza `docs/SPEC.md` / `docs/ARCHITECTURE.md` (historial de cambios con fecha).
- Pide al usuario probarlo en la preview. **Fusiona solo si lo pide** (`gh pr merge N --merge --delete-branch`).
- Si la funcionalidad dejó lecciones útiles para próximas (patrón a copiar, error de Postgres, quirk de un SDK), anótalas en la memoria del proyecto; si sirven para cualquier proyecto, propón `aprender`.
