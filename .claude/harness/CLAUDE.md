# Cómo trabajo con Omar (todas las sesiones)

> Instalado desde `github.com/omardavidjara/claude-harness` (`global/CLAUDE.md` → `~/.claude/CLAUDE.md`).
> No edites la copia de `~/.claude`: cambia el repo con la skill `aprender` y vuelve a ejecutar `install.ps1`.
> Las skills se citan sin prefijo: como plugin son `harness:<nombre>`; en los proyectos sincronizados con `sync-project.mjs` (y en la nube), `<nombre>`.

## Quién soy
- Desarrollador que construye apps web con Claude Code y delega casi todo. No soy experto en infraestructura: explícame lo justo, sin jerga innecesaria.
- Windows 10 · PowerShell y Git Bash · VS Code · `gh` con sesión de `omardavidjara`.
- Mis proyectos viven cada uno en su repo de GitHub; el índice está en `PROYECTOS.md` del harness.

## Idioma
- Hablamos en español. UI y documentos en español; código, identificadores y nombres de ramas en inglés.

## Forma de trabajar
- **Delego**: haz seguidas las tareas que puedes hacer tú. Para solo en lo esencial: decisiones de producto, pagos, cuentas, claves o algo irreversible.
- **Tareas manuales mías** (consolas de Vercel, Neon, GitHub Settings, Google Cloud…): **un solo paso por mensaje**, concreto (dónde hacer clic, qué escribir), y espera a que diga que está hecho. Contexto breve.
- **Cuida los tokens**: lee solo el documento que necesites, no releas lo ya sabido, prefiere sesiones nuevas para tareas largas y recomienda `/clear` al cerrar cada bloque de trabajo (antes, la skill `guardar`).
- **Plan antes de construir** algo no trivial: rama → plan corto y mi OK → implementar con tests → comprobar → PR.
- Cuando algo no se pueda verificar (un cron, un despliegue), dime cómo y cuándo comprobarlo, y apúntalo en la memoria del proyecto.
- Al terminar, resultado en dos o tres frases: qué cambió, cómo se comprobó y qué queda pendiente.

## Proyectos
- Cada proyecto tiene `CLAUDE.md`, `docs/ROADMAP.md` (con protocolo de sesión y etiquetas [C]/[T]/[J]/🛑), `docs/SPEC.md`, `docs/ARCHITECTURE.md` y `docs/LIMITS.md`. Si un proyecto no los tiene y vamos a trabajar en serio, propón la skill `nuevo-proyecto` (sirve también para adoptar uno existente).
- "continúa" / "seguimos" = skill `continuar`.
- Planes gratuitos siempre que se pueda. Antes de diseñar algo que gaste recursos, mira `docs/LIMITS.md`; si un límite bloquea, busca la alternativa gratuita y explícala; pagar o cambiar arquitectura es decisión mía.

## Git y GitHub
- Una funcionalidad por rama (`feat/…`, `fix/…`, `docs/…`, `ci/…`). Commits `tipo(ámbito): resumen en español`.
- `main` protegida en cuanto haya CI: todo por PR. No fusionar con la CI en rojo.
- **Fusionar una PR solo cuando lo pida en la sesión** ("fusiona la 36"): `gh pr merge N --merge --delete-branch` (en la nube, con las herramientas de GitHub de la sesión).
- Repos públicos: nada de secretos, volcados, `.env*` ni datos personales reales en código, tests, issues o logs de Actions.

## Secretos
- Solo en `.env.local` (ignorado), Vercel y GitHub Secrets. Nunca `NEXT_PUBLIC_` en claves de servidor.
- Para dármelos a copiar, genéralos en **PowerShell** y cópialos con `Set-Clipboard` (sin espacios ni saltos finales). `… | clip` desde Git Bash añade un salto de línea y Vercel lo rechaza.
- Tras cambiar una variable en Vercel hace falta *Redeploy*.

## Bases de datos de producción
- Nunca se tocan sin migración. Las migraciones contra producción las ejecuto yo con `! npm run db:migrate` (el modo automático lo bloquea); antes, comprueba solo leyendo que los datos cumplen las reglas nuevas.
- No uses mi sesión del navegador para llamar a APIs de consolas: guíame paso a paso y, si hace falta, pídeme capturas.

## Sesiones en la nube (claude.ai/code, app del móvil)
- Detecta que estás en la nube por `CLAUDE_CODE_REMOTE=true`. El harness llega copiado en `.claude/` del proyecto (`sync-project.mjs`); no hay `~/.claude` ni clon del harness.
- Termina siempre en rama + PR: lo reviso y fusiono desde el móvil.
- No hay `.env.local`: si un test necesita secretos, dímelo (variables del entorno en la nube); nunca los pongas en el repo.
- Solo hay acceso a GitHub del repo de la sesión, y `gh pr …`/`gh issue …` fallan (usan GraphQL): usa las herramientas de GitHub de la sesión o `gh api repos/{owner}/{repo}/…`.
- Nada de producción: ni migraciones, ni consolas, ni despliegues manuales. Apúntalo como [T] para hacerlo desde el PC.
- Skill `aprender`: no puedes subir al harness. Apunta la lección en la memoria o el ROADMAP del proyecto para llevarla al harness desde el PC.
- Instrucciones de PowerShell o Windows de este documento: solo aplican en el PC.

## Entorno Windows (lecciones)
- Si `gh` no está en el PATH de Git Bash: `"/c/Program Files/GitHub CLI/gh.exe"`.
- Los heredocs largos en Bash a veces fallan («unexpected EOF»): escribe el script con Write en el scratchpad y ejecútalo.
- Hooks nuevos de `.claude/settings.json` no se activan en la sesión que los crea: abrir `/hooks` o sesión nueva.

## Instalar el harness en otro equipo
Requisitos: Git, GitHub CLI con sesión (`gh auth login`) y Claude Code. En PowerShell:
```powershell
gh repo clone omardavidjara/claude-harness "$HOME\Desktop\Proyectos\claude-harness"
powershell -ExecutionPolicy Bypass -File "$HOME\Desktop\Proyectos\claude-harness\install.ps1"
```
Para actualizarlo, vuelve a ejecutar la segunda línea.
