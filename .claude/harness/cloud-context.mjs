// Generado por claude-harness/sync-project.mjs: no lo edites.
// Hook SessionStart: en las sesiones en la nube carga las normas globales del harness.
import { readFileSync } from "node:fs"

if (process.env.CLAUDE_CODE_REMOTE === "true") {
  process.stdout.write(readFileSync(new URL("./CLAUDE.md", import.meta.url), "utf8"))
}
