// Hook de Claude Code (.claude/settings.json, PostToolUse en Edit/Write/MultiEdit): ejecuta
// `npm run check` tras editar código. Corre en segundo plano (asyncRewake): si falla, sale con
// código 2 y el final de la salida va a Claude para que lo corrija.
// Si ya hay una comprobación en marcha, no lanza otra: la marca como pendiente y la que está en
// marcha se repite al terminar, así la última edición siempre queda comprobada.
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const CODE_FILE = /\.(ts|tsx|js|jsx|mjs|mts|cjs|cts)$/
const OUTPUT_LINES = 60

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const id = createHash("sha1").update(root).digest("hex").slice(0, 12)
const lockFile = join(tmpdir(), `claude-check-${id}.lock`)
const pendingFile = join(tmpdir(), `claude-check-${id}.pending`)

function editedFile() {
  try {
    const input = JSON.parse(readFileSync(0, "utf8"))
    return input.tool_input?.file_path ?? input.tool_response?.filePath ?? ""
  } catch {
    return ""
  }
}

function isRunning(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const file = editedFile().replaceAll("\\", "/")
if (!CODE_FILE.test(file) || file.includes("/node_modules/") || file.includes("/.next/")) process.exit(0)

if (existsSync(lockFile) && isRunning(Number(readFileSync(lockFile, "utf8")))) {
  writeFileSync(pendingFile, "")
  process.exit(0)
}
writeFileSync(lockFile, String(process.pid))

let result
try {
  do {
    rmSync(pendingFile, { force: true })
    result = spawnSync("npm run check", { cwd: root, shell: true, encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } })
  } while (existsSync(pendingFile))
} finally {
  rmSync(lockFile, { force: true })
}

if (result.status !== 0) {
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split("\n").slice(-OUTPUT_LINES).join("\n")
  process.stderr.write(`npm run check ha fallado tras editar ${file}. Últimas líneas:\n${output}\n`)
  process.exit(2)
}
