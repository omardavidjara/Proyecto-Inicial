"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { deletePlan, savePlan, setPlanActive } from "@/lib/dal"
import { planSchema, type PlanInput } from "@/lib/validation/plans"

// Tarifas (SPEC F4). La DAL exige el rol de administración y valida el id

export type PlanFormState = {
  saved?: boolean
  error?: string
  fieldErrors?: Partial<Record<keyof PlanInput, string>>
}

const NOT_FOUND = "Esa tarifa ya no existe. Recarga la lista."

/** Crear o editar (con el campo oculto `id`) */
export async function savePlanAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const parsed = planSchema.safeParse({
    name: formData.get("name"),
    period: formData.get("period"),
    classesPerPeriod: formData.get("classesPerPeriod"),
  })
  if (!parsed.success) {
    const fields = z.flattenError(parsed.error).fieldErrors
    return {
      fieldErrors: {
        name: fields.name?.[0],
        period: fields.period?.[0],
        classesPerPeriod: fields.classesPerPeriod?.[0],
      },
    }
  }
  const result = await savePlan(formData.get("id") || null, parsed.data)
  if (result === "duplicate") return { fieldErrors: { name: "Ya hay una tarifa con ese nombre" } }
  if (result === "not_found") return { error: NOT_FOUND }
  refresh()
  return { saved: true }
}

export type PlanActionResult = { ok: boolean; message: string }

export async function setPlanActiveAction(id: unknown, isActive: unknown): Promise<PlanActionResult> {
  const active = z.boolean().safeParse(isActive)
  if (!active.success) return { ok: false, message: "Acción no válida" }
  if (!(await setPlanActive(id, active.data))) return { ok: false, message: NOT_FOUND }
  refresh()
  return { ok: true, message: active.data ? "Tarifa activada" : "Tarifa desactivada" }
}

export async function deletePlanAction(id: unknown): Promise<PlanActionResult> {
  const result = await deletePlan(id)
  if (result === "in_use") {
    return { ok: false, message: "No se puede eliminar porque ya se ha asignado a algún cliente. Desactívala." }
  }
  if (result === "not_found") return { ok: false, message: NOT_FOUND }
  refresh()
  return { ok: true, message: "Tarifa eliminada" }
}
