# Auditoría rápida · 2026-10-17

## Contexto
Petición del usuario tras fusionar #61 (ventana de reserva y cambio de hora), antes de empezar F10 (push web):
comprobar lo construido desde la auditoría del 2026-10-14 (F7 entrenadores, F8 clientes, F9 incidencias,
«Instalar la app», cabecera de marca, «Completa tus datos», estética y vistas del calendario; PR #41–#61).

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| `npm ci` | ✅ (avisos: EBADENGINE de `@asamuzakjp/css-color`, desarrollo, pide Node ≥ 24.15 y local tiene 24.14.1; ERESOLVE de `better-call` vía `@better-auth/core`, dependencia de `@neondatabase/auth` beta) |
| `npm run check` (lint + tipos + tests) | ✅ 654 tests en 64 archivos (517 en 51 el 2026-10-14) |
| `npm run build` | ✅ |
| `npm run db:check` | ✅ |
| `npm audit --omit=dev` | ⚠️ 4 moderadas, todas de `esbuild` vía `drizzle-kit` (solo migraciones, no llega a la web) |
| `npm audit` completo | ⚠️ 13 (4 moderadas, 9 altas): las mismas que en las auditorías anteriores (`braces`/`fast-glob`, `esbuild`), solo herramientas de desarrollo |
| Secretos en archivos e historial (`postgres://…@`, `npg_`, `sk_`, `ghp_`, `gho_`, Blob, claves privadas) | ✅ ninguno (única coincidencia: un token de Blob inventado en un test) |
| `.env*` ignorados (solo `.env.example` versionado, sin valores) | ✅ |
| Variables `NEXT_PUBLIC_*` | ✅ solo `SENTRY_DSN` (no es secreto) y `VERCEL_ENV` |
| Producción: `/` 307, `/login` 200, `/privacidad` 200, `/instalar` 200, cron sin clave 401 | ✅ |
| Cabeceras: HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, CSP | ✅ |
| CI de `main` (#56–#61) y copia diaria (`db-backup.yml`) | ✅ en verde |
| Alertas de Dependabot en GitHub | ❌ siguen desactivadas (la API responde 404) |

## Código revisado
- `lib/dal.ts` (funciones nuevas de F7–F9 y del calendario): todas exigen `requireArea`; el entrenador solo ve y
  toca sus sesiones (`viewer.userId` como `coachId`) y sus incidencias (`createdBy`); los ids del navegador se
  validan con `z.uuid()` aquí o en la capa de datos; búsqueda y límites de la URL con Zod y `.catch`.
- Server Actions nuevas: `app/entrenador/actions.ts`, `app/entrenador/incidencias/actions.ts`,
  `app/entrenador/sesiones/[sessionId]/actions.ts`, `app/admin/incidencias/actions.ts`,
  `app/admin/clientes/[userId]/actions.ts`, `app/(cuenta)/perfil/actions.ts` (`completeProfile`): validan con Zod,
  solo llaman a la DAL y devuelven mensajes sin detalles internos.
- `lib/data/incidents.ts`: el entrenador solo asocia sus sesiones y clientes apuntados a ellas; ids validados.
- `lib/data/individual-sessions.ts`: tipo de clase individual activo, cliente activo, `checkMember` en transacción;
  la búsqueda escapa `%`, `_` y `\` en el `ilike`.
- `lib/booking.ts` y `lib/dates.ts` (#61): la apertura cuenta días de calendario en la zona del gimnasio.

## Pendientes

| # | Pendiente | Gravedad | Fase |
|---|---|---|---|
| 1 | `parseCoachPeriod` y `getCoachDay` (`lib/dal.ts`) calculan «hoy» con `toDateKey(now)` (zona por defecto) en vez de la zona de `gym_settings`, a diferencia del resto de la DAL. Hoy coinciden (`Europe/Madrid`); unificar si la zona llega a poder cambiarse (F11) | Baja | 5 (F11) |
| 2 | Aviso ERESOLVE de `better-call` en `npm ci` (dependencia de `@neondatabase/auth` beta): revisarlo en la PR de actualización de `@neondatabase/auth` | Baja | 9 |

Siguen abiertos de auditorías anteriores (ya en el ROADMAP, Fase 6): separar desarrollo y producción, `npm audit` de
herramientas de desarrollo, activar Dependabot (AUDITORIA-2026-10-14 #2) y borrar `getBookingForViewer`
(AUDITORIA-2026-10-14 #3); en mantenimiento, Node local ≥ 24.15 (AUDITORIA-2026-10-14 #4).
