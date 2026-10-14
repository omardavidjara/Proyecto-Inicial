# Lecciones (errores reales, Athlos App 2026-10)

## Neon / Postgres
- Región: Neon en `aws-eu-central-1` y funciones de Vercel en `fra1` (`vercel.json` → `"regions": ["fra1"]`); por defecto Vercel usa EE. UU. y cada consulta cruza el Atlántico.
- Autoescalado 0,25–1 CU. El cómputo (100 CU-h/mes) es el riesgo principal: nada de polling, cron frecuentes ni monitores que toquen la base de datos.
- `URL con -pooler` para la app; la directa (`DATABASE_URL_UNPOOLED`) solo para migraciones y `pg_dump`.
- `on delete restrict` da el código **23001** (no 23503): acepta los dos al traducir el error.
- `check (x > 0)` **no falla con NULL**: añade `is not null` cuando haga falta.
- Únicos sin distinguir mayúsculas: índice único sobre `lower(name)`; en tests, nombres distintos para cada fila.
- La integración Neon–Vercel crea una rama por preview (`preview/<rama>`); Neon Free admite 10: workflow de limpieza al cerrar la PR. **Las PR de Dependabot no reciben los secretos de Actions**: `NEON_API_KEY` también en los secretos de Dependabot.
- *Reset password* en Neon actualiza solo las variables de Vercel de la integración (no convertirlas a Sensitive a mano); después: redesplegar y actualizar el secreto de GitHub y `.env.local`.
- Ni la CI ni Vercel aplican migraciones: el usuario ejecuta `! npm run db:migrate` antes de fusionar, tras comprobar solo leyendo que los datos cumplen las reglas nuevas.
- `.env.local` apuntando a producción con claves de borrado es peligroso: rama de desarrollo de Neon para local antes de tener usuarios reales.

## Neon Auth (SDK `@neondatabase/auth`, beta)
- Versión fijada y PR propia de Dependabot: leer el CHANGELOG y probar login, registro, Google y eliminar cuenta antes de subirla.
- `neon_auth.user.id` es `uuid`.
- Llamar a `await cookies()` antes del SDK en páginas, o registra la señal de render dinámico como error en el build.
- Con cookies de una sesión que ya no vale, el SDK intenta borrarlas y una página no puede: tratarlo como "sin sesión" (`unstable_rethrow` + `null`).
- Tras cerrar sesión, una copia de las cookies vale hasta 5 min (caché firmada). Rol y baja sí son inmediatos si la DAL lee `profiles` en cada petición.
- El endpoint `delete-user` viene desactivado: borrar con la API de administración de Neon.
- Con el correo compartido de Neon solo hay código de 6 cifras (no enlace) y llega en inglés desde `auth@mail.myneon.app`.
- No admite Sign in with Apple (comprobado 2026-10-07): en iOS ocultar "Continuar con Google" (norma 4.8 de la App Store).
- Las previews de Vercel necesitan su dirección en los orígenes de confianza de Neon Auth para poder iniciar sesión.
- Google con credenciales propias: proyecto en Google Cloud, cliente OAuth web con redirección `{NEON_AUTH_BASE_URL}/callback/google`. La pantalla mostrará el dominio de Neon salvo con marca verificada (requiere dominio propio).

## Vercel (Hobby)
- **Uso comercial prohibido** en Hobby: decidir Pro u otro alojamiento antes de abrir a un cliente real.
- Cron como mucho diario y ±59 min; una expresión más frecuente hace fallar el despliegue. Frecuente → cron-job.org en horario de uso + ruta idempotente por ventana + GitHub Actions de respaldo.
- Logs de ejecución solo 1 h: hace falta Sentry. Comprobar un cron por sus efectos en la base de datos.
- *Ignored Build Step* que compara con `VERCEL_GIT_PREVIOUS_SHA` y **construye siempre un redeploy del mismo commit** (si no, el Redeploy manual sale cancelado).
- Un solo proyecto de Vercel conectado al repo (se habían creado tres).
- Las variables nuevas requieren *Redeploy*. Los secretos se copian sin salto de línea final (generar en PowerShell + `Set-Clipboard`).
- Blob en Hobby: superar un cupo **bloquea 30 días**. Navegar el almacén en el panel gasta operaciones avanzadas.

## Sentry (SDK v11)
- Recoge por defecto cookies, cabeceras, cuerpos y variables locales (`sendDefaultPii` ya no existe): `dataCollection` todo apagado + `beforeSend` que deja solo el id del usuario, con test.
- Sin `SENTRY_AUTH_TOKEN`, desactivar los source maps o quedan publicados.
- `withSentryConfig` se importa de `@sentry/nextjs/config`. Solo en Production; `tracesSampleRate` 0,1; sin Replay.

## GitHub
- Repo público: Actions ilimitado y protección de rama gratis; privado en Free pierde la protección de rama.
- Workflows programados: se retrasan o descartan en horas punta y se desactivan tras 60 días sin actividad en repos públicos. Usar minutos "raros" (`17 3 * * *`).
- Artefactos de Actions descargables por cualquiera en repos públicos: nada sin cifrar.
- CI: `persist-credentials: false`, `permissions: contents: read`, concurrencia que cancela PRs anteriores, caché de `.next/cache`.
- `npm audit --omit=dev --audit-level=high` bloqueante; el completo solo como aviso (herramientas de desarrollo sin parche).
- Dependabot semanal: menores y parches agrupados, tope de PR abiertas (cada una abre preview y rama de Neon), `@types/node` sin mayores (sigue la versión de Node en producción).

## Claude Code
- Hooks nuevos no se activan en la sesión que los crea.
- El modo automático bloquea migraciones contra producción y fusionar PR sin petición explícita en la sesión, y llamar a APIs de consolas con la sesión del navegador.
