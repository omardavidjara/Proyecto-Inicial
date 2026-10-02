@AGENTS.md

# mi-app

App web (Next.js) que se instala en el móvil como PWA y se publica en las tiendas con Capacitor.
Qué hace y para quién: ver `docs/SPEC.md` (nombre provisional: Athlos App, gestión de reservas de un gimnasio).

## Hoja de ruta
Sigue `docs/ROADMAP.md` y su protocolo de sesión. Si el usuario dice "continúa", toma la siguiente tarea abierta.

## Stack
Next.js 16 (App Router) + TypeScript · Tailwind v4 + shadcn/ui · Neon (Postgres + Neon Auth) + Drizzle ORM · Vitest · GitHub + Vercel · Capacitor

## Comandos
- `npm run dev`: servidor local
- `npm run check`: lint + tipos + tests. Ejecutar antes de cada commit
- `npm test`: solo los tests

## Documentos (lee solo el que necesites)
- `docs/SPEC.md`: funcionalidades, usuarios, pantallas
- `docs/ARCHITECTURE.md`: tablas, rutas, permisos
- `docs/DESIGN.md`: sistema de diseño

## Reglas
- Idioma: UI y documentos en español; código e identificadores en inglés.
- Antes de usar una API de Next.js, lee su guía en `node_modules/next/dist/docs/`.
- Tests junto a cada funcionalidad, en `__tests__/`.
- Todo vive en Neon: datos y autenticación (Neon Auth). No usar Supabase.
- No modificar a mano el esquema `neon_auth`: lo gestiona Neon.
- Cambios de esquema solo en `db/schema.ts` + migraciones de drizzle-kit en `drizzle/`.
- A Neon solo se accede desde el servidor. Cada consulta filtra por el `user_id` de la sesión verificada de Neon Auth.
- `DATABASE_URL` y cualquier clave de servidor nunca con prefijo `NEXT_PUBLIC_` ni en componentes de cliente.
- Valida toda entrada con Zod en el servidor.
- Secretos en `.env.local`, nunca en el código.
- Una funcionalidad por rama. No fusionar en `main` con la CI en rojo.
