# Auditoría rápida · 2026-10-14

## Contexto
Petición del usuario antes de empezar F7 (entrenadores): comprobar que todo lo construido desde la auditoría del
2026-10-12 (F2 tipos de clase, F3 horario y cron, F4 tarifas, F5 reservas, F6 agenda, anulaciones y detalle de
sesión; PR #29–#40) es correcto.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| `npm ci` | ✅ (aviso EBADENGINE: `w3c-xmlserializer`, dependencia de desarrollo, pide Node ≥ 24.15; local tiene 24.14.1) |
| `npm run check` (lint + tipos + tests) | ✅ 517 tests en 51 archivos |
| `npm run build` | ✅ |
| `npm run db:check` | ✅ |
| `npm audit --omit=dev` | ⚠️ 4 moderadas, todas de `esbuild` vía `drizzle-kit` (solo migraciones, no llega a la web) |
| `npm audit` completo | ⚠️ 13 (4 moderadas, 9 altas): las mismas de la auditoría anterior (`braces`/`fast-glob`, `esbuild`), solo herramientas de desarrollo |
| Secretos en archivos e historial (`postgres://…@`, `npg_`, `sk_`, `ghp_`, `gho_`, Blob, claves privadas) | ✅ ninguno |
| `.env*` ignorados (solo `.env.example` versionado, sin valores) | ✅ |
| Variables `NEXT_PUBLIC_*` | ✅ solo `SENTRY_DSN` (no es secreto) y `VERCEL_ENV` |
| Producción: `/` 307, `/login` 200, `/privacidad` 200, cron sin clave 401 | ✅ |
| Cabeceras: HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, CSP | ✅ |
| CI de `main` (#34–#40) y copia diaria | ✅ en verde |
| Alertas de Dependabot en GitHub | ❌ desactivadas en el repositorio |

## Código revisado
- `lib/dal.ts`: todas las funciones exigen `requireArea` o `requireViewer`; los ids del navegador se validan con Zod
  (aquí o en la capa de datos); el cron compara `CRON_SECRET` en tiempo constante.
- Server Actions: `app/(client)/calendario/actions.ts`, `app/(client)/reservas/actions.ts`,
  `app/admin/{anulaciones,clientes,horario}/actions.ts`, `app/admin/sesiones/[sessionId]/actions.ts`: validan con
  Zod, solo llaman a la DAL y no devuelven detalles internos.
- `app/api/cron/generate-sessions/route.ts`: solo la DAL; 401 sin clave.
- `lib/data/bookings.ts`: reservar, anular, cambiar y lista de espera en transacción con bloqueos sesión → perfil;
  las consultas del cliente filtran por el usuario de la sesión.
- `lib/data/session-detail.ts`, `lib/data/calendar.ts`, `lib/data/memberships.ts`, `lib/data/schedule.ts`
  (`generateSessions`, idempotente por `(slot_id, slot_date)`).
- `app/(client)/calendario/page.tsx`: `?fecha` validada con `isDateKey` y limitada a los días visibles.

## Pendientes

| # | Pendiente | Gravedad | Fase |
|---|---|---|---|
| 1 | Una falta («Faltó») sigue gastando clase después de quitar al cliente de la sesión: `countUsedClasses` (`lib/data/memberships.ts`) cuenta `attendance = 'no_show'` sin mirar el estado de la reserva, y `removeBookingFromSession` no reinicia la asistencia. La regla de F6 es que quitar nunca descuenta. Corregir (contar `no_show` solo en reservas confirmadas o reiniciar la asistencia al quitar) con test | Media | 5 (antes de F7) |
| 2 | Activar las alertas de Dependabot y las actualizaciones de seguridad (GitHub → Settings → Code security) | Baja | 6 |
| 3 | `getBookingForViewer` (`lib/data/bookings.ts`) ya no se usa fuera de sus tests: borrarla o reutilizarla | Baja | 6 |
| 4 | Node local 24.14.1: actualizar a ≥ 24.15 (aviso EBADENGINE de `w3c-xmlserializer`) | Baja | 9 |

Sigue abierto de la auditoría anterior: `npm audit` de herramientas de desarrollo y separar desarrollo y producción
(Fase 6).
