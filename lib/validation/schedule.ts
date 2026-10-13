import { z } from "zod"

import { isDateKey } from "@/lib/dates"
import { CAPACITY_MAX, DURATION_MAX, DURATION_MIN } from "@/lib/validation/class-types"

// Plantilla semanal (SPEC F3). Los formularios envían texto: los números se convierten aquí.
// El aforo de una clase individual lo fija la capa de datos (1), que es la que conoce el tipo.

/** 0 = lunes … 6 = domingo, como `schedule_slots.weekday` */
export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const

export const scheduleSlotSchema = z.object({
  classTypeId: z.uuid("Elige un tipo de clase"),
  weekday: z.coerce
    .number("Elige el día")
    .int("Elige el día")
    .min(0, "Elige el día")
    .max(6, "Elige el día"),
  startTime: z.string("Escribe la hora").regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Escribe la hora (HH:MM)"),
  durationMinutes: z.coerce
    .number("Escribe la duración")
    .int("La duración debe ser un número entero de minutos")
    .min(DURATION_MIN, `La duración mínima es de ${DURATION_MIN} minutos`)
    .max(DURATION_MAX, `La duración máxima es de ${DURATION_MAX} minutos`),
  capacity: z.coerce
    .number("Escribe el aforo")
    .int("El aforo debe ser un número entero")
    .min(1, "El aforo mínimo es 1")
    .max(CAPACITY_MAX, `El aforo máximo es ${CAPACITY_MAX}`),
  // "" del desplegable = sin entrenador
  coachId: z.union([z.literal("").transform(() => null), z.null(), z.uuid("Elige un entrenador")]),
})

export type ScheduleSlotInput = z.output<typeof scheduleSlotSchema>

// Sesiones concretas (SPEC F3): las sueltas eligen tipo; al editar una sesión el tipo no cambia
export const CANCEL_REASON_MAX = 200

export const sessionSchema = z.object({
  date: z.string("Elige el día").refine(isDateKey, "Elige el día"),
  startTime: scheduleSlotSchema.shape.startTime,
  durationMinutes: scheduleSlotSchema.shape.durationMinutes,
  capacity: scheduleSlotSchema.shape.capacity,
  coachId: scheduleSlotSchema.shape.coachId,
})

export const oneOffSessionSchema = sessionSchema.extend({ classTypeId: scheduleSlotSchema.shape.classTypeId })

export const cancelReasonSchema = z
  .string()
  .trim()
  .max(CANCEL_REASON_MAX, `Como mucho ${CANCEL_REASON_MAX} caracteres`)
  .transform((reason) => reason || null)

export type SessionInput = z.output<typeof sessionSchema>
export type OneOffSessionInput = z.output<typeof oneOffSessionSchema>
