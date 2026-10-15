"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import type { SessionActionResult } from "@/app/admin/sesiones/[sessionId]/actions"
import { setBookingAttendanceForCoach } from "@/lib/dal"

// Detalle de sesión del entrenador (SPEC F7). La DAL exige ser entrenador y limita a las sesiones que imparte

const attendanceSchema = z.enum(["pending", "attended", "no_show"])

export async function setCoachAttendanceAction(bookingId: unknown, attendance: unknown): Promise<SessionActionResult> {
  const parsed = attendanceSchema.safeParse(attendance)
  if (!parsed.success) return { ok: false, message: "Acción no válida" }
  const saved = await setBookingAttendanceForCoach(bookingId, parsed.data)
  refresh()
  return saved ? { ok: true, message: "Asistencia guardada" } : { ok: false, message: "No se ha podido guardar la asistencia" }
}
