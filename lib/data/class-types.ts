import { asc, desc, eq } from "drizzle-orm"

import { classTypes } from "@/db/schema"
import type { ClassColor } from "@/lib/sessions"
import type { ClassKind, ClassTypeInput } from "@/lib/validation/class-types"

import type { Db } from "./db"

// Tipos de clase (SPEC F2). Solo administración: quien llama (lib/dal.ts) ya ha comprobado el rol.
// Las reglas viven también en la base de datos (paleta de colores, individual = aforo 1, nombre único sin
// distinguir mayúsculas, y no se borra un tipo que usan el horario o las sesiones): aquí se traducen sus errores.

export type ClassTypeRow = {
  id: string
  name: string
  kind: ClassKind
  durationMinutes: number
  defaultCapacity: number
  color: ClassColor
  isActive: boolean
}

export type SaveResult = "saved" | "duplicate" | "not_found"
export type DeleteResult = "deleted" | "in_use" | "not_found"

const UNIQUE_VIOLATION = "23505"
// `on delete restrict` da restrict_violation; una FK `no action`, foreign_key_violation
const IN_USE = ["23001", "23503"]

/** Código SQLSTATE: el driver lo pone en el error y Drizzle lo envuelve en su causa */
function pgCode(error: unknown) {
  const e = error as { code?: string; cause?: { code?: string } }
  return e?.code ?? e?.cause?.code
}

/** Errores esperados → resultado; el resto sigue su curso (Sentry) */
async function translate<T extends string>(run: () => Promise<T>, codes: string[], result: T): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (codes.includes(pgCode(error) ?? "")) return result
    throw error
  }
}

/** Activos primero y, dentro de cada grupo, por nombre */
export async function listClassTypes(db: Db): Promise<ClassTypeRow[]> {
  const rows = await db
    .select({
      id: classTypes.id,
      name: classTypes.name,
      kind: classTypes.kind,
      durationMinutes: classTypes.durationMinutes,
      defaultCapacity: classTypes.defaultCapacity,
      color: classTypes.color,
      isActive: classTypes.isActive,
    })
    .from(classTypes)
    .orderBy(desc(classTypes.isActive), asc(classTypes.name), asc(classTypes.id))
  return rows as ClassTypeRow[]
}

export function createClassType(db: Db, input: ClassTypeInput): Promise<SaveResult> {
  return translate(
    async () => {
      await db.insert(classTypes).values(input)
      return "saved"
    },
    [UNIQUE_VIOLATION],
    "duplicate",
  )
}

/** Cambiar un tipo no toca el horario ni las sesiones ya creadas: guardan su propia duración y aforo */
export function updateClassType(db: Db, id: string, input: ClassTypeInput): Promise<SaveResult> {
  return translate(
    async () => {
      const changed = await db.update(classTypes).set(input).where(eq(classTypes.id, id)).returning({ id: classTypes.id })
      return changed.length > 0 ? "saved" : "not_found"
    },
    [UNIQUE_VIOLATION],
    "duplicate",
  )
}

/** Un tipo inactivo no se ofrece al crear horario ni sesiones; lo ya creado sigue igual */
export async function setClassTypeActive(db: Db, id: string, isActive: boolean) {
  const changed = await db.update(classTypes).set({ isActive }).where(eq(classTypes.id, id)).returning({ id: classTypes.id })
  return changed.length > 0
}

/** Solo si nunca se ha usado: la FK de horario y sesiones lo impide; entonces, desactivarlo */
export function deleteClassType(db: Db, id: string): Promise<DeleteResult> {
  return translate(
    async () => {
      const deleted = await db.delete(classTypes).where(eq(classTypes.id, id)).returning({ id: classTypes.id })
      return deleted.length > 0 ? "deleted" : "not_found"
    },
    IN_USE,
    "in_use",
  )
}
