# Patrones probados (Athlos App, 2026-10)

## Capas
```
Navegador ─ proxy.ts (solo redirección optimista por cookie; no consulta tablas)
  ├─ Server Components → lib/dal.ts (sesión + rol) → lib/data/* → db (Drizzle)
  ├─ Server Actions    → Zod → lib/dal.ts → lib/data/* → revalidatePath
  └─ Route Handlers    → /api/cron/* (con CRON_SECRET), /api/auth/* (pasarela de Neon Auth)
```
- `lib/dal.ts` es **la que protege**: `getSessionUser()` / `getViewer()` memorizadas con `cache` de React; `requireViewer()` y `requireArea("admin")` redirigen. Los layouts llaman a `requireArea`, pero un layout no se re-ejecuta al navegar entre sus páginas: **cada función de datos vuelve a comprobar**.
- `lib/data/*` reciben el perfil de quien consulta (`Viewer`) y usan su `user_id`, nunca uno del navegador. Un id ajeno solo en acciones de admin y siempre validado (`z.uuid()`) y con permiso comprobado. **Recurso ajeno = inexistente** (misma respuesta).
- Reglas de negocio y de acceso como **funciones puras** (`lib/roles.ts`, `lib/booking.ts`): fáciles de testear.
- `db/` y `lib/dal.ts` importan `server-only` (el build falla si el cliente los importa). En tests se sustituye por un alias (`__tests__/helpers/server-only.ts`).
- `db/index.ts` crea el cliente al primer uso (`getDb()` HTTP; `getTxDb()` con Pool para transacciones): así el build y la CI no necesitan secretos.
- Patrón de funcionalidad admin: capa de datos → DAL (`requireArea` + id validado) → `app/admin/<ruta>/actions.ts` con Zod → página + diálogo en `components/admin/`.

## Usuarios y datos (Neon Auth)
- Tabla `profiles` con `user_id` = `neon_auth.user.id` (**uuid**), sin FK hacia `neon_auth` (lo gestiona Neon). Creada en el primer login (idempotente). Rol y estado viven en `profiles`, no en el proveedor.
- FK hacia `profiles` con `on delete restrict`: el perfil nunca se borra; al eliminar la cuenta se **anonimiza** en una transacción y luego se borra el usuario de Neon Auth con la API de Neon (clave de organización limitada al proyecto, solo en Production: las previews copian la base de datos con los mismos ids).
- Script `db:set-role -- <correo> <rol>` (`node --env-file=.env.local scripts/set-role.mts`) para asignar el primer rol de desarrollador.

## Esquema y migraciones
- Solo `db/schema.ts` + `drizzle-kit generate`. SQL a mano (extensiones, restricciones de exclusión, filas iniciales) con `drizzle-kit generate --custom --name=x`.
- La CI regenera migraciones y falla si `drizzle/` cambia (esquema sin migración).
- Restricciones en la base de datos (check, únicos, exclusión) además de Zod: los tests sobre PGlite las comprueban.
- Fechas en `timestamptz` (UTC); se muestran en la zona configurada.
- Índices para cada FK consultada (Postgres no los crea solo). Paginación por cursor `(created_at, id)`, nunca `OFFSET`; filtros en la URL.

## Tests
- Vitest + jsdom + Testing Library. Base de datos: **PGlite** en memoria con las migraciones reales (`createTestDb()`), sin tocar Neon ni gastar cómputo. Extensiones desde `@electric-sql/pglite/contrib/*`.
- Siempre un test "dos usuarios: ninguno ve los datos del otro".
- `__tests__/contrast.test.ts` lee los tokens de `app/globals.css` y exige WCAG AA en claro y oscuro.
- Hook de Claude Code que corre `npm run check` en segundo plano tras cada edición (plantilla de `nuevo-proyecto`).

## Seguridad web
- Cabeceras en `next.config.ts`: HSTS con preload, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, CSP base.
- Límite de intentos de login por correo e IP en una tabla (HMAC de correo e IP, no en claro).
- Pasarela `/api/auth/*` con lista blanca de lo que necesita el navegador; el resto por Server Actions.
- Subidas: el navegador reduce la imagen (512 px WebP < 300 KB) y sube directo a Vercel Blob con token firmado por el servidor solo para su carpeta; borrar la anterior con `del()`; nunca `list()` en producción.
- Páginas `/privacidad` y `/aviso-legal` desde el principio, con datos del titular en `lib/legal.ts` y `updatedAt`; actualizarlas con cada proveedor o dato personal nuevo.

## Diseño (móvil primero)
- Tokens de shadcn sobre Tailwind v4 en `app/globals.css`; nada de hexadecimales en componentes.
- Zonas táctiles ≥ 44 px, navegación inferior con safe areas, una acción principal por pantalla, estado por color **y** texto.
- Estados: `loading.tsx` con esqueletos, `error.tsx` por segmento, vacío con acción, toasts (sonner) para éxito/error de acción.
- Anillos de foco opacos (`ring-ring`, no `/50`), `active:` además de `hover:`, `touch-action: manipulation`.
- PWA: manifest, iconos, service worker básico y `/offline`. Las cookies de sesión `__Secure-` exigen HTTPS: probar en el móvil con una preview de Vercel, no con la IP local.
