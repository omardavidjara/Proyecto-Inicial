---
name: nuevo-proyecto
description: Arranca un proyecto nuevo (o adopta uno existente) con la forma de trabajar del usuario - entrevista, repo en GitHub, CLAUDE.md, ROADMAP con protocolo de sesión, SPEC, ARCHITECTURE, LIMITS, check + hook de Claude Code, CI, Dependabot y protección de main. Úsala cuando el usuario diga "nuevo proyecto", "quiero hacer una app", "empecemos algo", o al trabajar en serio en un proyecto sin docs/ROADMAP.md.
---

# Proyecto nuevo

Las plantillas están en `templates/` (junto a este archivo). `{{…}}` = rellenar. Para Next.js + Neon + Vercel, carga además la skill `stack-next-neon`.

## Fase 0 · Cimientos (todo [C] salvo lo marcado)
1. **Preguntas mínimas** (una tanda, con opción recomendada): nombre, qué hace en una frase, ¿repo público o privado?, ¿stack por defecto (Next.js + Neon + Vercel) u otro? Lo demás sale en la entrevista de la Fase 1.
   - Público: Actions ilimitado y protección de rama gratis, pero todo es visible. Privado: 2 000 min/mes de Actions y **sin protección de rama en GitHub Free**. Recomendado: público mientras no haya datos ni código sensible; cuidado extremo con secretos.
2. **Carpeta** en `C:\Users\Omar\Desktop\Proyectos\<nombre>` (o la que diga). Si es Next.js: `npx create-next-app@latest` con TypeScript, Tailwind, ESLint, App Router.
3. **Scripts** en `package.json`: `typecheck`, `test` (Vitest), `check` = `lint && typecheck && test`.
4. **Copia las plantillas** (`templates/`):
   - `CLAUDE.md`, `docs/ROADMAP.md`, `docs/LIMITS.md`, `docs/SPEC.md`, `docs/ARCHITECTURE.md`
   - `.claude/settings.json` + `scripts/claude-check.mjs` (hook: `npm run check` en segundo plano tras editar código; solo avisa si falla)
   - `.github/workflows/ci.yml` (quita el paso de migraciones si no hay ORM) y `.github/dependabot.yml` (ajusta grupos y exclusiones)
   - Añade a `.gitignore`: `.env*`, `!.env.example`, `.claude/settings.local.json`, `*.tsbuildinfo`, `~$*`
5. **Harness en el proyecto** (para trabajar también desde claude.ai/code o el móvil): `node <clon-del-harness>/sync-project.mjs .` (la ruta del clon está en `~/.claude/CLAUDE.md`). Copia las skills a `.claude/skills/`, las normas a `.claude/harness/` y ajusta `.claude/settings.json`.
6. **GitHub**: `gh repo create omardavidjara/<nombre> --<public|private> --source . --push`. Primer commit `chore: fase 0, cimientos`.
7. **Añade el proyecto a `PROYECTOS.md` del harness** (skill `aprender`, solo esa línea).
8. **[T] Protección de `main`** (cuando la CI haya pasado una vez): Settings → Branches → solo por PR, checks obligatorios «Comprobaciones» y «Dependencias», también para administradores. Guía un paso por mensaje. Desde entonces todo va por rama y PR.

## Fase 1 · Especificación ([J] → 🛑)
Entrevista al usuario **por bloques cortos** (no un cuestionario de 30 preguntas): para quién es, roles, funcionalidades (numéralas F1…Fn en el orden de construcción), pantallas, datos personales que se guardan, necesidades del móvil, qué queda fuera. Resultado: `docs/SPEC.md`. Luego `docs/ARCHITECTURE.md` (tablas, rutas, permisos por rol, índices, paginación, reparto servidor/cliente) y 🛑 revisión del usuario.

## Después
El ROADMAP de la plantilla ya trae las fases típicas (diseño, datos y seguridad, CI, funcionalidades, auditoría, publicación, móvil, mantenimiento): recórtalo a lo que necesite el proyecto en la Fase 1. A partir de aquí, skill `continuar`.

## Adoptar un proyecto existente
Igual, pero sin crear nada que ya exista: lee el código, escribe SPEC y ARCHITECTURE describiendo lo que hay (🛑 que el usuario lo confirme), y un ROADMAP que empiece en lo pendiente. Añade check, hook, CI y el harness (`sync-project.mjs`, en una rama `chore/sync-harness` con su PR) si faltan.
