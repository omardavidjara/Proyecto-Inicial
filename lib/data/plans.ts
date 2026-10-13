import { asc, count, desc, eq, gte, isNull, or } from "drizzle-orm"

import { memberships, plans } from "@/db/schema"
import { toDateKey } from "@/lib/dates"
import type { PlanInput, PlanPeriod } from "@/lib/validation/plans"

import type { Db } from "./db"

// Tarifas (SPEC F4). Solo administración: quien llama (lib/dal.ts) ya ha comprobado el rol.
// Las reglas viven también en la base de datos (cupo coherente con el periodo, nombre único sin distinguir
// mayúsculas, y no se borra una tarifa que se ha asignado alguna vez): aquí se traducen sus errores.

export type PlanRow = {
  id: string
  name: string
  period: PlanPeriod
  classesPerPeriod: number | null
  isActive: boolean
  /** Clientes con esta tarifa vigente o programada (para avisar al editarla) */
  clients: number
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

/** Activas primero y, dentro de cada grupo, por nombre. `today` en la zona del gimnasio */
export async function listPlans(db: Db, today = toDateKey(new Date())): Promise<PlanRow[]> {
  const current = db
    .select({ planId: memberships.planId, clients: count().as("clients") })
    .from(memberships)
    .where(or(isNull(memberships.endsOn), gte(memberships.endsOn, today)))
    .groupBy(memberships.planId)
    .as("current")

  const rows = await db
    .select({
      id: plans.id,
      name: plans.name,
      period: plans.period,
      classesPerPeriod: plans.classesPerPeriod,
      isActive: plans.isActive,
      clients: current.clients,
    })
    .from(plans)
    .leftJoin(current, eq(current.planId, plans.id))
    .orderBy(desc(plans.isActive), asc(plans.name), asc(plans.id))
  return rows.map((row) => ({ ...row, clients: Number(row.clients ?? 0) }))
}

export function createPlan(db: Db, input: PlanInput): Promise<SaveResult> {
  return translate(
    async () => {
      await db.insert(plans).values(input)
      return "saved"
    },
    [UNIQUE_VIOLATION],
    "duplicate",
  )
}

/** El cambio vale para quien ya la tiene: las reservas hechas no se tocan; el cupo nuevo cuenta desde ahora */
export function updatePlan(db: Db, id: string, input: PlanInput): Promise<SaveResult> {
  return translate(
    async () => {
      const changed = await db.update(plans).set(input).where(eq(plans.id, id)).returning({ id: plans.id })
      return changed.length > 0 ? "saved" : "not_found"
    },
    [UNIQUE_VIOLATION],
    "duplicate",
  )
}

/** Una tarifa inactiva no se ofrece al asignar; quien ya la tiene la conserva */
export async function setPlanActive(db: Db, id: string, isActive: boolean) {
  const changed = await db.update(plans).set({ isActive }).where(eq(plans.id, id)).returning({ id: plans.id })
  return changed.length > 0
}

/** Solo si nunca se ha asignado: la FK de `memberships` lo impide (historial); entonces, desactivarla */
export function deletePlan(db: Db, id: string): Promise<DeleteResult> {
  return translate(
    async () => {
      const deleted = await db.delete(plans).where(eq(plans.id, id)).returning({ id: plans.id })
      return deleted.length > 0 ? "deleted" : "not_found"
    },
    IN_USE,
    "in_use",
  )
}
