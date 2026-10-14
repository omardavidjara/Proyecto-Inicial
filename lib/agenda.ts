// Textos de la agenda del administrador (SPEC F6), calculados en el servidor para no enviar fechas al navegador.
import { z } from "zod"

import { formatMinutes } from "@/lib/booking"
import {
  addDays,
  formatDayLabel,
  formatDayLong,
  formatMonthYear,
  formatWeekRange,
  isDateKey,
  startOfMonth,
  startOfWeek,
  toDateKey,
  toTimeKey,
} from "@/lib/dates"

// ── Vistas de la agenda (?vista=dia|semana|mes&fecha=AAAA-MM-DD) ─────────────────────────────────────────

export const AGENDA_VIEWS = [
  { param: "dia", label: "Día" },
  { param: "semana", label: "Semana" },
  { param: "mes", label: "Mes" },
] as const
export type AgendaView = (typeof AGENDA_VIEWS)[number]["param"]

const agendaParams = z.object({
  vista: z.enum(["dia", "semana", "mes"]).catch("dia"),
  // Años acotados: fuera de ahí no hay sesiones y los cálculos de mes dejarían de dar claves AAAA-MM-DD
  fecha: z
    .string()
    .refine((value) => isDateKey(value) && value >= "2000-01-01" && value <= "2099-12-31")
    .optional()
    .catch(undefined),
})

/** Lee ?vista y ?fecha; si faltan o no valen, vista Día de hoy */
export function parseAgendaParams(params: { vista?: unknown; fecha?: unknown }, today: string) {
  const { vista, fecha } = agendaParams.parse({ vista: params.vista, fecha: params.fecha })
  return { view: vista, date: fecha ?? today }
}

export type AgendaRange = {
  /** Primer y último día que se consultan (incluidos) */
  from: string
  to: string
  /** Fechas a las que llevan ‹ y › */
  prev: string
  next: string
  title: string
}

/** Día: ese día. Semana: de lunes a domingo. Mes: la cuadrícula entera, de lunes a domingo (hasta 42 días) */
export function agendaRange(view: AgendaView, date: string): AgendaRange {
  if (view === "dia") {
    return { from: date, to: date, prev: addDays(date, -1), next: addDays(date, 1), title: formatDayLong(date) }
  }
  if (view === "semana") {
    const monday = startOfWeek(date)
    return { from: monday, to: addDays(monday, 6), prev: addDays(monday, -7), next: addDays(monday, 7), title: formatWeekRange(monday) }
  }
  const first = startOfMonth(date)
  const next = startOfMonth(date, 1)
  return {
    from: startOfWeek(first),
    to: addDays(startOfWeek(addDays(next, -1)), 6),
    prev: startOfMonth(date, -1),
    next,
    title: formatMonthYear(first),
  }
}

/** Días de `from` a `to`, incluidos */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day)
  return days
}

export const agendaHref = (view: AgendaView, date: string) => `/admin/agenda?vista=${view}&fecha=${date}`

// ── Anulaciones tardías ─────────────────────────────────────────────────────────────────────────────────

type LateRow = { id: string; clientName: string; className: string; startsAt: Date; cancelledAt: Date }

/** "Funcional · Hoy 18:00" y "anulada 45 minutos antes" */
export function lateCancellationItem(row: LateRow, today: string) {
  const minutesBefore = Math.max(0, Math.round((row.startsAt.getTime() - row.cancelledAt.getTime()) / 60_000))
  return {
    id: row.id,
    client: row.clientName,
    session: `${row.className} · ${formatDayLabel(toDateKey(row.startsAt), today)} ${toTimeKey(row.startsAt)}`,
    when: `anulada ${formatMinutes(minutesBefore)} antes`,
  }
}
