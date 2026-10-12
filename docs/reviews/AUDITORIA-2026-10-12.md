# Auditoría rápida · 2026-10-12 (F1 terminada, antes de F2)

Revisión general pedida por el usuario tras cerrar F1, rotar la contraseña de Neon y fusionar la PR #27 de Dependabot.
No se ha encontrado nada crítico. No se ha corregido nada en esta revisión: los pendientes van a su fase en `docs/ROADMAP.md`.

## 1. Comprobaciones

| Comprobación | Resultado |
|---|---|
| `npm ci`, `npm run check` (lint, tipos, 286 tests en 33 archivos) | ✅ |
| `npm run db:check` (esquema frente a migraciones) | ✅ |
| `npm run build` | ✅ |
| Producción tras el despliegue de #27 (`/`, `/api/auth/get-session`, `/privacidad`) | ✅ |
| Secretos en archivos versionados y en todo el historial de git (cadenas de Neon, tokens de Blob, claves de API de Neon y GitHub) | ✅ ninguno; `.env.local` ignorado |
| Cabeceras en producción: HSTS con `preload`, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, CSP base | ✅ |

Código revisado a mano: `lib/dal.ts`, Server Actions (`app/(auth)`, `app/(cuenta)/perfil`, `app/admin/clientes`), `app/api/avatar/upload`,
`app/api/sentry-test`, `proxy.ts`, `lib/auth-gateway.ts`, `lib/roles.ts`, `lib/avatar.ts`, `lib/login-limit.ts`, `lib/neon-admin.ts`.
Sesión, rol y estado se comprueban en la DAL; las decisiones de admin solo tocan perfiles `client` y validan el id con Zod; límite de
intentos con HMAC de correo e IP; la foto solo se sube a la carpeta propia (token de 5 min, WebP/JPEG < 300 KB) y la URL se revalida;
solo `NEXT_PUBLIC_SENTRY_DSN` y `NEXT_PUBLIC_VERCEL_ENV` llegan al navegador.

## 2. Pendientes

| # | Pendiente | Gravedad | Fase |
|---|---|---|---|
| 1 | Menú de admin sin acceso a `/perfil` (la página «Más» no lo enlaza) | Baja (usabilidad) | 5 (con F2) |
| 2 | `.env.local` apunta a la base de datos de producción **y lleva `NEON_API_KEY`**: probar «Eliminar mi cuenta» en local borra usuarios reales. Mitigación inmediata posible: quitar `NEON_API_KEY`, `NEON_PROJECT_ID` y `NEON_AUTH_BRANCH_ID` de `.env.local` (la app muestra «no disponible en este entorno»). Solución: rama de desarrollo de Neon para local | Media | 6 (antes de clientes reales) |
| 3 | `npm audit`: 9 altos y 4 moderados, todos en herramientas de desarrollo (`braces`/`micromatch`/`fast-glob` vía `eslint-config-next` y `shadcn`; `esbuild` vía `drizzle-kit`). No llegan a la web; la CI solo bloquea altos de producción. Revisar si las actualizaciones de Dependabot los resuelven | Baja | 6 |
| 4 | `@neondatabase/auth` en `0.5.0-beta`; existe `0.6.0-beta`. Llegará en PR propia de Dependabot: leer el changelog y probar login, registro, Google y eliminar cuenta antes de fusionar | Baja | 9 (al llegar la PR) |
| 5 | Heredados de la auditoría del 2026-10-08, sin cambios: CSP de scripts con nonce y `sessionDataTtl` (Fase 6); «Allow Localhost» y Google mostrando «neon.tech» (Fase 7); login en previews de Vercel | — | 6 y 7 |
| 6 | Antes de abrir al gimnasio real (ya en ROADMAP Fase 7): Vercel Pro (LIMITS D1), datos legales del titular, DPA de Vercel y Neon, dominio propio | — | 7 |
