// Reglas de reserva (SPEC F5 y §4, ARCHITECTURE §4): funciones puras, sin base de datos. Las transacciones que
// las aplican están en lib/data/bookings.ts.

import type { PlanPeriod } from "@/lib/validation/plans"

export type BookingRules = {
  /** Días antes de la sesión en que se abren las reservas */
  bookingWindowDays: number
  /** Minutos antes de la sesión hasta los que se anula sin penalización */
  cancelDeadlineMinutes: number
}

/** Valores de SPEC §4, por si falta la fila de `gym_settings` */
export const DEFAULT_BOOKING_RULES: BookingRules = { bookingWindowDays: 7, cancelDeadlineMinutes: 120 }

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/** Cuándo se abren las reservas de una sesión. Se cierran al empezar */
export function bookingOpensAt(startsAt: Date, rules: BookingRules): Date {
  return new Date(startsAt.getTime() - rules.bookingWindowDays * DAY)
}

export type BookingWindow = "open" | "not_open_yet" | "closed"

/** En qué punto está la ventana de reserva de una sesión programada */
export function bookingWindow(startsAt: Date, now: Date, rules: BookingRules): BookingWindow {
  if (startsAt <= now) return "closed"
  if (now < bookingOpensAt(startsAt, rules)) return "not_open_yet"
  return "open"
}

/** Anular una plaza confirmada a menos de `cancelDeadlineMinutes` del inicio es una anulación tardía */
export function isLateCancel(startsAt: Date, now: Date, rules: BookingRules): boolean {
  return startsAt.getTime() - now.getTime() < rules.cancelDeadlineMinutes * MINUTE
}

/** Le queda alguna clase en el periodo: las ilimitadas siempre */
export function hasClassesLeft(plan: { period: PlanPeriod; classesPerPeriod: number | null }, used: number): boolean {
  if (plan.period === "unlimited" || plan.classesPerPeriod == null) return true
  return used < plan.classesPerPeriod
}

/** Con plaza libre se confirma; si no, a la lista de espera */
export function placeFor(capacity: number, confirmed: number): "confirmed" | "waitlisted" {
  return confirmed < capacity ? "confirmed" : "waitlisted"
}

/** "2 horas", "1 hora", "90 minutos" */
export function formatMinutes(minutes: number): string {
  if (minutes > 0 && minutes % 60 === 0) {
    const hours = minutes / 60
    return hours === 1 ? "1 hora" : `${hours} horas`
  }
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`
}
