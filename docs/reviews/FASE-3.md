# Revisión de cierre · Fase 3 (Datos y seguridad base)

Fecha: 2026-10-07 · Estado: **cerrada**. La app tiene base de datos real, inicio de sesión, rutas protegidas por rol,
copia de seguridad diaria y web publicada en https://athlosapp.vercel.app.

## 1. Qué se entrega

| Entregable | Dónde |
|---|---|
| Proyecto de Neon en Frankfurt (`aws-eu-central-1`, Postgres 18.6) con Neon Auth (correo y contraseña, Google) | Consola de Neon; `.env.example` |
| Esquema de 12 tablas, índices y restricciones; 3 migraciones aplicadas | `db/schema.ts`, `drizzle/` |
| Inicio de sesión real, perfil creado en el primer acceso (pendiente), `/pendiente`, cerrar sesión | `lib/auth.ts`, `app/(auth)/`, `app/api/auth/` |
| Protección en dos capas: `proxy.ts` (optimista) y `lib/dal.ts` (la real), reglas puras en `lib/roles.ts` | ARCHITECTURE §6 |
| Capa de datos que recibe a quien consulta; recursos ajenos = inexistentes | `lib/data/` |
| Asignar roles desde la terminal | `npm run db:set-role` (`scripts/set-role.mts`) |
| Vercel en `fra1`, sin builds de cambios solo de documentos | `vercel.json`, `scripts/vercel-ignore-build.sh` |
| Copia diaria cifrada (age) en Cloudflare R2 (UE), borrado a 30 días; restauración probada | `.github/workflows/db-backup.yml`, `docs/BACKUPS.md` |
| Borrado de ramas de Neon al cerrar PR | `.github/workflows/neon-branch-cleanup.yml` |
| Decisiones D2 (cron-job.org) y D5 (R2) | `docs/LIMITS.md` |
| `/privacidad` con Cloudflare como encargado y la conservación de las copias | `app/privacidad/page.tsx` |

## 2. Verificaciones

### Tests y compilación
- `npm run check`: lint, tipos y **130 tests** en verde (90 al cerrar la Fase 2).
- Tests de base de datos sobre Postgres real en memoria (PGlite) con las mismas migraciones: restricciones (reservas
  duplicadas, tarifas solapadas, cupo coherente, notificaciones únicas), perfil en el primer acceso (idempotente) y
  **dos usuarios: ninguno ve las reservas del otro**; pedir un id ajeno devuelve lo mismo que uno inexistente.
- `npm run build` sin errores ni avisos.

### De extremo a extremo
- **Local contra Neon real** (cuenta de prueba, borrada después): alta → `/pendiente`; como cliente, entrenador y
  administrador, cada uno llega a su inicio y no entra en las zonas ajenas; cerrar sesión → `/login`.
- **Web publicada**: sin sesión, todas las rutas privadas → `/login`; páginas públicas, `sw.js` y manifest en 200;
  contraseña incorrecta → 401 con mensaje claro; **inicio de sesión con Google del desarrollador → «Hoy»**.
  Funciones en `fra1`; cabeceras de seguridad y HSTS presentes.

### Copia de seguridad
- Primera copia subida el 2026-10-07 (61 KB) y **restaurada con éxito** en una rama de prueba: 22 tablas con las mismas
  filas que producción y un marcador borrado antes que volvió con la restauración (detalle en `docs/BACKUPS.md`).

### Seguridad
- `npm audit --omit=dev`: 4 avisos moderados (ver §4). Sin secretos en el repositorio (revisado antes de cada push).
- Secretos solo en `.env.local`, Vercel y GitHub Actions; las anotaciones del workflow de copia ocultan URL, hosts,
  contraseñas, claves y correos.

## 3. Problemas encontrados y corregidos en esta fase

| # | Gravedad | Problema | Corrección |
|---|---|---|---|
| 1 | Alta | `neon_auth.user.id` es `uuid`, no `text` como suponía ARCHITECTURE | Ids de usuario `uuid` antes de aplicar ninguna migración |
| 2 | Media | Una tarifa semanal o mensual sin cupo pasaba el `check` (`NULL > 0` no falla) | `is not null` en la restricción; lo detectó un test |
| 3 | Media | Un *Redeploy* a mano en Vercel salía cancelado (el *Ignored Build Step* comparaba el commit consigo mismo) | Un redeploy del mismo commit siempre se construye |
| 4 | Media | Los errores de la copia no se podían diagnosticar sin acceso de administrador a los logs | Una anotación pública y sin datos sensibles por fase; dominio UE de R2; validación del Account ID |
| 5 | Baja | El SDK de Neon Auth registraba como error la señal de página dinámica durante el build | `cookies()` antes de llamar al SDK |
| 6 | Baja | Tres proyectos de Vercel conectados al repo y 17 orígenes de confianza heredados en Neon Auth | Un solo proyecto; orígenes reducidos a `localhost:3000` y la web |
| 7 | Baja | Ramas de preview de Neon de ramas ya fusionadas | Borradas, junto con las ramas de git |

## 4. Pendientes que heredan otras fases

| Pendiente | Fase |
|---|---|
| **Sesión tras cerrar sesión**: una copia robada de las cookies sigue valiendo hasta 5 min (caché firmada del SDK). Las bajas y cambios de rol sí son inmediatos. Valorar acortar `sessionDataTtl` | 6 |
| `npm audit --omit=dev`: 4 avisos moderados de `esbuild` dentro de `drizzle-kit`, que `better-auth` declara como dependencia opcional; no llega al código publicado. La CI debe bloquear desde `--audit-level=high` o excluir ese aviso | 4 |
| SDK de Neon Auth en beta (`0.5.0-beta`, versión fijada): revisar con Dependabot y leer su CHANGELOG antes de subir | 4 / 9 |
| `ubuntu-latest` pasa a Ubuntu 26 desde el 19-10-2026: vigilar que la copia diaria (instala `age` con apt y usa Docker) sigue en verde | 4 / 9 |
| **Eliminar mi cuenta**: el endpoint `delete-user` de Neon Auth está desactivado (404); activarlo o usar la API de Neon | 5 (F1) |
| Las cuentas `pending` deben poder abrir `/perfil` (hoy solo `/pendiente`) | 5 (F1) |
| Iniciar sesión en las *previews* de Vercel exige añadir su dirección a los orígenes de confianza de Neon Auth; cada preview usa su propia rama de base de datos | 5 |
| Probar en el móvil: las cookies de sesión exigen HTTPS, así que usar la web publicada o una preview, no la IP de la red local | — |
| Opcional: `NEON_API_KEY` y `NEON_PROJECT_ID` en GitHub para que el workflow de limpieza borre las ramas de preview al cerrar cada PR (sin ellos no hace nada) | 4 |
| Uso comercial: Vercel Hobby no lo permite (LIMITS D1) | 7 |
| Pendientes de la Fase 2 aún abiertos (`robots`, CSP completa, logo en alta resolución) | 6 / 7 / 8 |
