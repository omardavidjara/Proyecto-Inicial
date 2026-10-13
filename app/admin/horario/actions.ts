"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { deleteScheduleSlot, saveScheduleSlot, setScheduleSlotActive } from "@/lib/dal"
import { scheduleSlotSchema, type ScheduleSlotInput } from "@/lib/validation/schedule"

// Plantilla semanal (SPEC F3). La DAL exige el rol de administración y valida el id

export type ScheduleSlotFormState = {
  saved?: boolean
  error?: string
  fieldErrors?: Partial<Record<keyof ScheduleSlotInput, string>>
}

const NOT_FOUND = "Esa clase del horario ya no existe. Recarga la página."

/** Crear o editar (con el campo oculto `id`) */
export async function saveScheduleSlotAction(_prev: ScheduleSlotFormState, formData: FormData): Promise<ScheduleSlotFormState> {
  const parsed = scheduleSlotSchema.safeParse({
    classTypeId: formData.get("classTypeId"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    durationMinutes: formData.get("durationMinutes"),
    // Las individuales no envían aforo: la capa de datos fija 1
    capacity: formData.get("capacity") ?? 1,
    coachId: formData.get("coachId") ?? "",
  })
  if (!parsed.success) {
    const fields = z.flattenError(parsed.error).fieldErrors
    return {
      fieldErrors: {
        classTypeId: fields.classTypeId?.[0],
        weekday: fields.weekday?.[0],
        startTime: fields.startTime?.[0],
        durationMinutes: fields.durationMinutes?.[0],
        capacity: fields.capacity?.[0],
        coachId: fields.coachId?.[0],
      },
    }
  }
  const result = await saveScheduleSlot(formData.get("id") || null, parsed.data)
  if (result === "invalid_class_type") return { fieldErrors: { classTypeId: "Elige un tipo de clase activo" } }
  if (result === "invalid_coach") return { fieldErrors: { coachId: "Elige un entrenador activo" } }
  if (result === "not_found") return { error: NOT_FOUND }
  refresh()
  return { saved: true }
}

export type ScheduleSlotActionResult = { ok: boolean; message: string }

export async function setScheduleSlotActiveAction(id: unknown, isActive: unknown): Promise<ScheduleSlotActionResult> {
  const active = z.boolean().safeParse(isActive)
  if (!active.success) return { ok: false, message: "Acción no válida" }
  if (!(await setScheduleSlotActive(id, active.data))) return { ok: false, message: NOT_FOUND }
  refresh()
  return { ok: true, message: active.data ? "Clase activada" : "Clase desactivada" }
}

export async function deleteScheduleSlotAction(id: unknown): Promise<ScheduleSlotActionResult> {
  const result = await deleteScheduleSlot(id)
  if (result === "in_use") {
    return {
      ok: false,
      message: "No se puede eliminar porque ya tiene sesiones pasadas, con reservas o cambiadas a mano. Desactívala.",
    }
  }
  if (result === "not_found") return { ok: false, message: NOT_FOUND }
  refresh()
  return { ok: true, message: "Clase eliminada del horario" }
}
