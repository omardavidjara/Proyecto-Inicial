// Calendario del cliente con vistas Día · Semana · Mes (SPEC F5): reglas puras, sin base de datos. El mes muestra
// todas las sesiones generadas; las que aún no admiten reserva llevan «Se abre …» (opción a, 2026-10-16).
import { agendaRange, parseAgendaParams, type AgendaRange, type AgendaView } from "@/lib/agenda"
import { bookingOpensAt, bookingWindow, type BookingRules } from "@/lib/booking"
import { addDays, formatDayLabel, toDateKey, toTimeKey } from "@/lib/dates"

export type CalendarParams = { vista?: unknown; fecha?: unknown; cambiar?: unknown }

/** `/calendario?vista=…&fecha=…` conservando la reserva que se está cambiando */
export function calendarHref(view: AgendaView, date: string, changing?: string) {
  return `/calendario?vista=${view}&fecha=${date}${changing ? `&cambiar=${changing}` : ""}`
}

export type ClientCalendarPeriod = {
  view: AgendaView
  date: string
  range: AgendaRange
  /** El periodo anterior aún tiene días de hoy en adelante */
  canGoBack: boolean
}

/** ?vista y ?fecha validadas; los días pasados no se consultan: una fecha anterior a hoy pasa a hoy */
export function clientCalendarPeriod(params: CalendarParams, today: string): ClientCalendarPeriod {
  const parsed = parseAgendaParams(params, today)
  const date = parsed.date < today ? today : parsed.date
  const range = agendaRange(parsed.view, date)
  // El periodo anterior acaba el día antes de `range.from` (en el mes, el día antes del día 1)
  const firstOfPeriod = parsed.view === "mes" ? `${date.slice(0, 7)}-01` : range.from
  return { view: parsed.view, date, range, canGoBack: addDays(firstOfPeriod, -1) >= today }
}

/**
 * «Se abre hoy a las 18:00», «Se abre mañana», «Se abre el lun 26 oct»; `undefined` si ya se puede reservar o ha
 * empezado
 */
export function opensLabel(startsAt: Date, now: Date, rules: BookingRules, timeZone?: string): string | undefined {
  if (bookingWindow(startsAt, now, rules, timeZone) !== "not_open_yet") return undefined
  const opensAt = bookingOpensAt(startsAt, rules, timeZone)
  const today = toDateKey(now, timeZone)
  const day = toDateKey(opensAt, timeZone)
  if (day === today) return `Se abre hoy a las ${toTimeKey(opensAt, timeZone)}`
  if (day === addDays(today, 1)) return "Se abre mañana"
  return `Se abre el ${formatDayLabel(day, today)}`
}
