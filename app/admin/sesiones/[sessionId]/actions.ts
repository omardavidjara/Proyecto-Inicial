"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { addClientToSession, removeBookingFromSession, searchClientsForSession, setBookingAttendance } from "@/lib/dal"

// Detalle de sesión (SPEC F6). La DAL exige el rol de administración y valida los ids

export type SessionActionResult = { ok: boolean; message: string }

export type ClientOption = { userId: string; fullName: string; waitlisted: boolean }

export async function searchClientsAction(sessionId: unknown, query: unknown): Promise<ClientOption[]> {
  return searchClientsForSession(sessionId, query)
}

const ADD_MESSAGES = {
  added: { ok: true, message: "Cliente añadido" },
  confirmed_from_waitlist: { ok: true, message: "Plaza confirmada desde la lista de espera" },
  already_booked: { ok: false, message: "Ese cliente ya tiene plaza en esta sesión" },
  client_not_active: { ok: false, message: "Ese cliente ya no está activo" },
  session_cancelled: { ok: false, message: "La sesión está cancelada" },
  not_found: { ok: false, message: "No se ha encontrado la sesión o el cliente" },
} as const

export async function addClientAction(sessionId: unknown, userId: unknown): Promise<SessionActionResult> {
  const result = ADD_MESSAGES[await addClientToSession(sessionId, userId)]
  refresh()
  return result
}

const REMOVE_MESSAGES = {
  removed: { ok: true, message: "Reserva anulada sin descontar" },
  session_cancelled: { ok: false, message: "La sesión está cancelada" },
  not_found: { ok: false, message: "Esa reserva ya no estaba activa. Se ha actualizado la lista." },
} as const

export async function removeBookingAction(bookingId: unknown): Promise<SessionActionResult> {
  const result = REMOVE_MESSAGES[await removeBookingFromSession(bookingId)]
  refresh()
  return result
}

const attendanceSchema = z.enum(["pending", "attended", "no_show"])

export async function setAttendanceAction(bookingId: unknown, attendance: unknown): Promise<SessionActionResult> {
  const parsed = attendanceSchema.safeParse(attendance)
  if (!parsed.success) return { ok: false, message: "Acción no válida" }
  const saved = await setBookingAttendance(bookingId, parsed.data)
  refresh()
  return saved ? { ok: true, message: "Asistencia guardada" } : { ok: false, message: "No se ha podido guardar la asistencia" }
}
