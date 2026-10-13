"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { deleteClassType, saveClassType, setClassTypeActive } from "@/lib/dal"
import { classTypeSchema, type ClassTypeInput } from "@/lib/validation/class-types"

// Tipos de clase (SPEC F2). La DAL exige el rol de administración y valida el id

export type ClassTypeFormState = {
  saved?: boolean
  error?: string
  fieldErrors?: Partial<Record<keyof ClassTypeInput, string>>
}

const NOT_FOUND = "Ese tipo de clase ya no existe. Recarga la lista."

/** Crear o editar (con el campo oculto `id`) */
export async function saveClassTypeAction(_prev: ClassTypeFormState, formData: FormData): Promise<ClassTypeFormState> {
  const parsed = classTypeSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    durationMinutes: formData.get("durationMinutes"),
    defaultCapacity: formData.get("defaultCapacity"),
    color: formData.get("color"),
  })
  if (!parsed.success) {
    const fields = z.flattenError(parsed.error).fieldErrors
    return {
      fieldErrors: {
        name: fields.name?.[0],
        kind: fields.kind?.[0],
        durationMinutes: fields.durationMinutes?.[0],
        defaultCapacity: fields.defaultCapacity?.[0],
        color: fields.color?.[0],
      },
    }
  }
  const result = await saveClassType(formData.get("id") || null, parsed.data)
  if (result === "duplicate") return { fieldErrors: { name: "Ya hay un tipo de clase con ese nombre" } }
  if (result === "not_found") return { error: NOT_FOUND }
  refresh()
  return { saved: true }
}

export type ClassTypeActionResult = { ok: boolean; message: string }

export async function setClassTypeActiveAction(id: unknown, isActive: unknown): Promise<ClassTypeActionResult> {
  const active = z.boolean().safeParse(isActive)
  if (!active.success) return { ok: false, message: "Acción no válida" }
  if (!(await setClassTypeActive(id, active.data))) return { ok: false, message: NOT_FOUND }
  refresh()
  return { ok: true, message: active.data ? "Tipo de clase activado" : "Tipo de clase desactivado" }
}

export async function deleteClassTypeAction(id: unknown): Promise<ClassTypeActionResult> {
  const result = await deleteClassType(id)
  if (result === "in_use") {
    return { ok: false, message: "No se puede eliminar porque ya se usa en el horario o en sesiones. Desactívalo." }
  }
  if (result === "not_found") return { ok: false, message: NOT_FOUND }
  refresh()
  return { ok: true, message: "Tipo de clase eliminado" }
}
