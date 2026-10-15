// Argumentos de `npm run db:set-role` (scripts/set-role.mts), aparte para poder probarlos sin base de datos.
import { z } from "zod"

export const ROLES = ["developer", "admin", "coach", "client"] as const

const USAGE = `Uso: npm run db:set-role -- <correo> <${ROLES.join("|")}> [--coach | --no-coach]`

export type SetRoleArgs =
  | { ok: true; email: string; role: (typeof ROLES)[number]; coachFlag: "true" | "false" | null }
  | { ok: false; error: string }

/**
 * Entrenador siempre imparte clases y cliente nunca (restricción `check` de `profiles`, ARCHITECTURE §2).
 * Administrador y desarrollador conservan su marca salvo que se pase `--coach` o `--no-coach`.
 */
export function parseSetRoleArgs(argv: string[]): SetRoleArgs {
  const parsed = z
    .tuple([z.email().trim().toLowerCase(), z.enum(ROLES)])
    .rest(z.enum(["--coach", "--no-coach"]))
    .safeParse(argv)
  if (!parsed.success || parsed.data.length > 3) return { ok: false, error: USAGE }
  const [email, role, flag] = parsed.data

  if (role === "coach" && flag === "--no-coach") return { ok: false, error: "Un entrenador siempre imparte clases: no admite --no-coach" }
  if (role === "client" && flag === "--coach") return { ok: false, error: "Un cliente no imparte clases: no admite --coach" }

  const coachFlag = role === "coach" ? "true" : role === "client" ? "false" : flag === "--coach" ? "true" : flag === "--no-coach" ? "false" : null
  return { ok: true, email, role, coachFlag }
}
