"use server"

import { refresh } from "next/cache"

import { bookMySession, cancelMyBooking, changeMyBooking } from "@/lib/dal"
import type { BookFailure, BookResult, CancelResult, ChangeResult } from "@/lib/data/bookings"

// Reservar, anular y cambiar de sesión (SPEC F5). La DAL exige la sesión, la zona de cliente y valida los ids;
// las reglas (aforo, ventana, tarifa) se comprueban en la transacción (lib/data/bookings.ts).

export type BookingActionResult = { ok: boolean; message: string }

const FAILURES: Record<BookFailure, string> = {
  not_found: "Esa sesión ya no existe. Vuelve al calendario.",
  session_cancelled: "Esta sesión se ha cancelado.",
  not_open_yet: "Las reservas de esta sesión aún no están abiertas.",
  closed: "La sesión ya ha empezado: las reservas están cerradas.",
  already_booked: "Ya tienes una reserva en esta sesión.",
  not_active: "Tu cuenta no está activa. Habla con el gimnasio.",
  no_plan: "No tienes una tarifa vigente para ese día. Habla con el gimnasio.",
  no_classes_left: "No te quedan clases en este periodo de tu tarifa.",
}

const BOOKED: Record<Extract<BookResult, "confirmed" | "waitlisted">, string> = {
  confirmed: "Reserva confirmada",
  waitlisted: "Te has apuntado a la lista de espera. Si queda una plaza, entrarás automáticamente.",
}

const CANCELLED: Record<CancelResult, string> = {
  cancelled: "Reserva anulada",
  late_cancelled: "Reserva anulada. Es una anulación tardía: el gimnasio decidirá si descuenta la clase.",
  left_waitlist: "Has salido de la lista de espera",
  not_found: "Esa reserva ya no está activa. Recarga la página.",
  closed: "La sesión ya ha empezado: no se puede anular.",
}

const CHANGED: Record<Exclude<ChangeResult, BookFailure>, string> = {
  changed: "Reserva cambiada",
  changed_late: "Reserva cambiada. La anterior queda como anulación tardía: el gimnasio decidirá si la descuenta.",
  same_session: "Ya estás en esta sesión.",
  full: "Esta sesión está completa: solo puedes cambiar a una con plaza libre.",
}

const done = (ok: boolean, message: string): BookingActionResult => {
  if (ok) refresh()
  return { ok, message }
}

export async function bookSessionAction(sessionId: unknown): Promise<BookingActionResult> {
  const result = await bookMySession(sessionId)
  return result === "confirmed" || result === "waitlisted" ? done(true, BOOKED[result]) : done(false, FAILURES[result])
}

export async function cancelBookingAction(bookingId: unknown): Promise<BookingActionResult> {
  const result = await cancelMyBooking(bookingId)
  return done(result !== "not_found" && result !== "closed", CANCELLED[result])
}

export async function changeBookingAction(bookingId: unknown, sessionId: unknown): Promise<BookingActionResult> {
  const result = await changeMyBooking(bookingId, sessionId)
  if (result in CHANGED) {
    const key = result as keyof typeof CHANGED
    return done(key === "changed" || key === "changed_late", CHANGED[key])
  }
  return done(false, FAILURES[result as BookFailure])
}
