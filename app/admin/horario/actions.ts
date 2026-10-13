"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { cancelSession, deleteScheduleSlot, saveScheduleSlot, saveSession, setScheduleSlotActive } from "@/lib/dal"
import {
  cancelReasonSchema,
  oneOffSessionSchema,
  scheduleSlotSchema,
  sessionSchema,
  type OneOffSessionInput,
  type ScheduleSlotInput,
} from "@/lib/validation/schedule"

// Plantilla semanal y próximas sesiones (SPEC F3). La DAL exige el rol de administración y valida el id

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

// ── Próximas sesiones ─────────────────────────────────────────────────────────────────────────────────

export type SessionFormState = {
  saved?: boolean
  error?: string
  fieldErrors?: Partial<Record<keyof OneOffSessionInput, string>>
}

const SESSION_NOT_FOUND = "Esa sesión ya no existe. Recarga la página."
const SESSION_NOT_EDITABLE = "Esa sesión ya ha empezado o está cancelada: no se puede cambiar."

/** Sesión suelta (sin `id`, con tipo) o editar una sesión (con `id`; el tipo no cambia) */
export async function saveSessionAction(_prev: SessionFormState, formData: FormData): Promise<SessionFormState> {
  const id = formData.get("id") || null
  const fields = {
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    durationMinutes: formData.get("durationMinutes"),
    capacity: formData.get("capacity") ?? 1,
    coachId: formData.get("coachId") ?? "",
  }
  const parsed = id
    ? sessionSchema.safeParse(fields)
    : oneOffSessionSchema.safeParse({ ...fields, classTypeId: formData.get("classTypeId") })
  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors as Partial<Record<keyof OneOffSessionInput, string[]>>
    return {
      fieldErrors: {
        classTypeId: errors.classTypeId?.[0],
        date: errors.date?.[0],
        startTime: errors.startTime?.[0],
        durationMinutes: errors.durationMinutes?.[0],
        capacity: errors.capacity?.[0],
        coachId: errors.coachId?.[0],
      },
    }
  }
  const result = await saveSession(id, parsed.data)
  switch (result) {
    case "invalid_class_type":
      return { fieldErrors: { classTypeId: "Elige un tipo de clase activo" } }
    case "invalid_coach":
      return { fieldErrors: { coachId: "Elige un entrenador activo" } }
    case "past":
      return { fieldErrors: { startTime: "Elige un día y una hora que aún no hayan pasado" } }
    case "capacity_below_booked":
      return { fieldErrors: { capacity: "No puede ser menor que las reservas confirmadas" } }
    case "not_found":
      return { error: SESSION_NOT_FOUND }
    case "not_editable":
      return { error: SESSION_NOT_EDITABLE }
  }
  refresh()
  return { saved: true }
}

export async function cancelSessionAction(id: unknown, reason: unknown): Promise<ScheduleSlotActionResult> {
  const parsedReason = cancelReasonSchema.safeParse(reason ?? "")
  if (!parsedReason.success) return { ok: false, message: parsedReason.error.issues[0].message }
  const cancelled = await cancelSession(id, parsedReason.data)
  if (cancelled.result !== "cancelled") {
    return { ok: false, message: cancelled.result === "not_found" ? SESSION_NOT_FOUND : SESSION_NOT_EDITABLE }
  }
  refresh()
  const n = cancelled.cancelledBookings
  const bookingsNote = n === 0 ? "" : n === 1 ? " y 1 reserva anulada" : ` y ${n} reservas anuladas`
  return { ok: true, message: `Sesión cancelada${bookingsNote}` }
}
