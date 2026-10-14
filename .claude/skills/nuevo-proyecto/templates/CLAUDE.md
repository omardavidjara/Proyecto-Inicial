# {{nombre}}

{{Qué es en una frase y para quién}}. Detalle: `docs/SPEC.md`.

## Hoja de ruta
Sigue `docs/ROADMAP.md` y su protocolo de sesión. Si el usuario dice "continúa", toma la siguiente tarea abierta.

## Stack
{{p. ej.: Next.js (App Router) + TypeScript · Tailwind + shadcn/ui · Neon (Postgres + Neon Auth) + Drizzle ORM · Vitest · GitHub + Vercel}}

## Comandos
- `npm run dev`: servidor local
- `npm run check`: lint + tipos + tests. Ejecutar antes de cada commit
- Hook de Claude Code (`.claude/settings.json` → `scripts/claude-check.mjs`): tras editar código, `npm run check` corre en segundo plano y solo avisa si falla
- `npm test`: solo los tests
{{comandos de base de datos, scripts propios…}}

## Documentos (lee solo el que necesites)
- `docs/SPEC.md`: funcionalidades, usuarios, pantallas
- `docs/ARCHITECTURE.md`: tablas, rutas, permisos
- `docs/LIMITS.md`: límites de los planes gratuitos y alternativas
- `docs/reviews/`: revisiones de cierre de fase y auditorías (pendientes que heredan las siguientes)

## Reglas
- Idioma: UI y documentos en español; código e identificadores en inglés.
- Tests junto a cada funcionalidad, en `__tests__/`.
- A la base de datos solo se accede desde el servidor. Cada consulta filtra por el usuario de la sesión verificada.
- Claves de servidor nunca con prefijo `NEXT_PUBLIC_` ni en componentes de cliente. Secretos en `.env.local`, nunca en el código.
- Valida toda entrada en el servidor (Zod).
- Cambios de esquema solo en el esquema del ORM + migraciones generadas.
- Una funcionalidad por rama. No fusionar en `main` con la CI en rojo.
- Planes gratuitos: antes de diseñar algo que consuma recursos, revisa `docs/LIMITS.md`. Si un límite bloquea, elige una alternativa gratuita y anótala; pagar o cambiar la arquitectura es [J].
- Colores solo como tokens de CSS (nada de hexadecimales sueltos en componentes); contraste AA.
- Protección de datos: si un cambio añade datos personales, un proveedor que los trate o cookies no técnicas, actualiza la página de privacidad.
- {{Si el repo es público}}: nada de secretos, volcados ni datos personales reales en código, tests, issues o logs de Actions.
