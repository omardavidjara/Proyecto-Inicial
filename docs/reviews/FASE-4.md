# Revisión de cierre · Fase 4 (Auto-auditoría automatizada)

Fecha: 2026-10-07 · Estado: **cerrada**. Cada cambio pasa por una CI que bloquea la fusión si algo falla, los errores
de producción llegan a Sentry y Dependabot propone las actualizaciones cada semana.

## 1. Qué se entrega

| Entregable | Dónde |
|---|---|
| CI en cada push a `main` y en cada PR: lint, tipos, tests, migraciones coherentes con `db/schema.ts` y build (job «Comprobaciones»); `npm audit` de producción bloqueante desde gravedad alta y el completo como aviso (job «Dependencias») | `.github/workflows/ci.yml` |
| `main` protegida: solo por PR, con «Comprobaciones» y «Dependencias» en verde y la rama al día; sin excepciones para administradores, sin *force push* ni borrado | GitHub → Settings → Branches |
| Hook de Claude Code: `npm run check` en segundo plano tras editar código, avisa solo si falla | `.claude/settings.json`, `scripts/claude-check.mjs` |
| Dependabot semanal (lunes, 07:00) para npm y GitHub Actions: menores y parches en una PR, mayores sueltas, SDK de Neon Auth aparte; como mucho 4 PR abiertas (ramas de Neon) | `.github/dependabot.yml` |
| Sentry en la región UE (Fráncfort), plan Developer: servidor, navegador y página de error global; solo en Production de Vercel; sin datos personales ni Session Replay; trazas al 10 % | `lib/sentry.ts`, `instrumentation.ts`, `instrumentation-client.ts`, `app/global-error.tsx`, `next.config.ts` |
| Ruta de comprobación de Sentry, solo para el rol developer (404 para el resto) | `app/api/sentry-test/route.ts` |
| `/privacidad` con Sentry como encargado y la conservación de sus registros (30 días) | `app/privacidad/page.tsx`, `lib/legal.ts` |

## 2. Verificaciones

### Tests y compilación
- `npm run check`: lint, tipos y **135 tests** en verde (130 al cerrar la Fase 3). Nuevos: privacidad de Sentry
  (`dataCollection` apagado, sin Replay, `beforeSend` deja solo el id del usuario y quita cookies y cabeceras) y la ruta
  de prueba (404 salvo para un desarrollador activo).
- `npm run build` sin secretos, como en la CI, y con el DSN, como en producción: sin archivos `.map` publicados.

### CI y protección de rama
- Primera ejecución en GitHub en verde (Comprobaciones 95 s, Dependencias 13 s), y también en los commits siguientes.
- La API de GitHub confirma la protección de `main` con los dos checks obligatorios para todos (`enforcement_level: everyone`).

### Hook de Claude Code
- Probado a mano: un `.md` no lanza nada, un `.ts` correcto sale con 0 y un error de tipos provocado sale con 2 y el
  mensaje de `tsc`. En la sesión en que se creó no se activa (Claude Code no vigilaba `.claude/`): requiere abrir
  `/hooks` o una sesión nueva.

### Sentry en producción
- El código publicado incluye el DSN de la región UE; `/api/sentry-test` sin sesión responde 404.
- Error de prueba lanzado como desarrollador en https://athlosapp.vercel.app y **recibido en Sentry**.

### Seguridad
- `npm audit --omit=dev --audit-level=high`: sin avisos (quedan los 4 moderados de `esbuild`, ver §4).
- Sin secretos en el repositorio. El DSN es público por diseño (va en el navegador); `SENTRY_AUTH_TOKEN`, si se añade,
  irá solo en Vercel.

## 3. Problemas encontrados y corregidos en esta fase

| # | Gravedad | Problema | Corrección |
|---|---|---|---|
| 1 | Alta | Dos avisos altos nuevos en dependencias de producción: `sharp` ≤ 0.35.4 (librsvg) y `source-map-js` 1.2.1 | `npm audit fix` (sin cambios de versión mayor): `sharp` 0.35.5 y `source-map-js` 1.2.2 |
| 2 | Alta | El SDK v11 de Sentry recoge por defecto cookies, cabeceras, cuerpos de las peticiones, parámetros de la URL, datos de consultas y variables locales (`sendDefaultPii` ya no existe) | `dataCollection` con todo apagado, `beforeSend` como segunda defensa y test que lo comprueba |
| 3 | Media | Sin token de Sentry, el build generaría *source maps* que no se suben ni se borran, y quedarían publicados | Se desactivan si no hay `SENTRY_AUTH_TOKEN` |
| 4 | Media | Las PR de Dependabot no reciben los secretos de Actions: el workflow de limpieza no borraría sus ramas de Neon | Anotado en el workflow y en LIMITS D4 (ver §4) |
| 5 | Baja | En el SDK v11, `withSentryConfig` está en `@sentry/nextjs/config` | Importado desde ahí |

## 4. Pendientes que heredan otras fases

| Pendiente | Fase |
|---|---|
| **Revisar un evento real en Sentry** y confirmar que no muestra correo, IP ni cookies | 6 |
| `npm audit --omit=dev`: 4 avisos moderados de `esbuild` dentro de `drizzle-kit` (vía `better-auth`); no bloquean la CI (`--audit-level=high`) ni llegan al código publicado | 9 |
| `npm audit` de desarrollo: avisos altos de `braces` en la CLI de shadcn y `eslint-config-next`, sin versión corregida; aviso en la CI | 9 |
| `NEON_API_KEY` también en Settings → Secrets and variables → **Dependabot**, y `NEON_API_KEY` / `NEON_PROJECT_ID` en Actions, para que el workflow de limpieza borre las ramas de Neon de las PR | 5 |
| Ya no se puede hacer push directo a `main`: todo cambio, incluidos los de documentos, va por rama y PR | 5 |
| Opcional: `SENTRY_ORG`, `SENTRY_PROJECT` y `SENTRY_AUTH_TOKEN` en Vercel (Production) para ver el código original en los errores | 7 |
| Monitor de disponibilidad de Sentry sobre una ruta `/api/health` que no toque la base de datos, y monitor de cron para los recordatorios (LIMITS, Sentry) | 5 (F10) |
| No hay `error.tsx` por zona: un error de una pantalla muestra la página de error global (sin el marco de la app) | 5 |
| `ubuntu-latest` pasa a Ubuntu 26 desde el 19-10-2026: vigilar la copia diaria y la CI | 9 |
| SDK de Neon Auth en beta (`0.5.0-beta`): Dependabot lo propone en PR propia; leer su CHANGELOG antes de fusionar | 9 |
| Pendientes de las Fases 2 y 3 aún abiertos (sesión 5 min tras cerrar sesión, `delete-user`, `robots`, CSP completa, logo) | 5 / 6 / 7 / 8 |
