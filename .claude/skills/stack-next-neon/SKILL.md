---
name: stack-next-neon
description: Conocimiento probado para el stack Next.js 16 (App Router) + TypeScript + Tailwind/shadcn + Neon (Postgres + Neon Auth) + Drizzle + Vitest/PGlite + Vercel + Sentry - arquitectura, seguridad, límites de los planes gratuitos, errores reales y plantillas (CI, copias cifradas, limpieza de ramas de Neon). Úsala al crear o trabajar en un proyecto con este stack, o al diseñar algo con Neon, Neon Auth, Drizzle, Vercel (cron, Blob, previews) o Sentry.
---

# Stack Next.js + Neon + Vercel

Lee solo lo que necesites:
- `references/patrones.md` — arquitectura y código: capa de datos, permisos, Server Actions, tests con PGlite, diseño móvil.
- `references/lecciones.md` — errores reales y quirks de Neon, Neon Auth, Drizzle/Postgres, Vercel, Sentry, GitHub.
- `references/limites-proveedores.md` — cupos de Vercel Hobby, Neon Free, GitHub y Sentry, y decisiones D1–D8 ya probadas.

Plantillas (`templates/`, generaliza `{{proyecto}}`):
| Archivo | Para |
|---|---|
| `vitest.config.mts`, `__tests__/helpers/test-db.ts`, `__tests__/helpers/server-only.ts` | Tests con Postgres real en memoria (PGlite + migraciones de drizzle) |
| `scripts/vercel-ignore-build.sh` + `"ignoreCommand": "bash scripts/vercel-ignore-build.sh"` en `vercel.json` | No construir cambios solo de documentos |
| `.github/workflows/neon-branch-cleanup.yml` | Borrar la rama de Neon de cada preview al cerrar la PR (Neon Free: 10 ramas) |
| `.github/workflows/db-backup.yml` + `docs/BACKUPS.md` | `pg_dump` diario cifrado con age en Cloudflare R2 (Neon Free: 6 h de historial) |

Antes de usar una API de Next.js, lee su guía en `node_modules/next/dist/docs/`: la versión instalada puede diferir de lo que sabes (lo avisa el `AGENTS.md` que genera `next dev`; súbelo con el commit).
