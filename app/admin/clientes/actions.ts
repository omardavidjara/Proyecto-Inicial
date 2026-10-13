"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { changeClientPlan, decideClient } from "@/lib/dal"
import { toDateKey } from "@/lib/dates"
import { changePlanSchema } from "@/lib/validation/plans"

const decisionSchema = z.enum(["approve", "reject", "deactivate", "reactivate"])

export type DecisionResult = { ok: boolean; message: string }

const DONE: Record<z.infer<typeof decisionSchema>, string> = {
  approve: "Alta aprobada",
  reject: "Alta rechazada: la cuenta queda de baja",
  deactivate: "Cliente dado de baja y reservas futuras anuladas",
  reactivate: "Cliente reactivado",
}

const CONFLICT = "No se ha podido: puede que otra persona ya lo haya cambiado. Recarga la lista."
const PLAN_GONE = "Esa tarifa ya no está activa. Recarga la página y elige otra."

/**
 * Aprobar, rechazar, dar de baja o reactivar a un cliente (SPEC F1). Al aprobar o reactivar se puede elegir
 * una tarifa (opcional, SPEC F4). La DAL exige el rol de administración
 */
export async function decideClientAction(decision: unknown, userId: unknown, planId: unknown = null): Promise<DecisionResult> {
  const parsed = decisionSchema.safeParse(decision)
  if (!parsed.success) return { ok: false, message: "Acción no válida" }
  const outcome = await decideClient(parsed.data, userId, planId)
  if (outcome === "plan_not_found") return { ok: false, message: PLAN_GONE }
  if (outcome === "conflict") return { ok: false, message: CONFLICT }
  refresh()
  return { ok: true, message: DONE[parsed.data] }
}

export type ChangePlanFormState = {
  saved?: boolean
  error?: string
  fieldErrors?: { planId?: string; startsOn?: string }
}

/** Cambiar o quitar la tarifa de un cliente activo desde hoy o una fecha futura */
export async function changeClientPlanAction(_prev: ChangePlanFormState, formData: FormData): Promise<ChangePlanFormState> {
  const parsed = changePlanSchema(toDateKey(new Date())).safeParse({
    planId: formData.get("planId"),
    startsOn: formData.get("startsOn"),
  })
  if (!parsed.success) {
    const fields = z.flattenError(parsed.error).fieldErrors
    return { fieldErrors: { planId: fields.planId?.[0], startsOn: fields.startsOn?.[0] } }
  }
  const result = await changeClientPlan(formData.get("userId"), parsed.data.planId, parsed.data.startsOn)
  if (result === "plan_not_found") return { fieldErrors: { planId: PLAN_GONE } }
  if (result === "not_found") return { error: CONFLICT }
  refresh()
  return { saved: true }
}
