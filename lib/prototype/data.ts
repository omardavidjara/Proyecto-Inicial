// DATOS DE EJEMPLO SOLO PARA EL PROTOTIPO (Fase 2).
// Se sustituyen por consultas a Neon en la Fase 5 (F3, F5, F6). Nombres ficticios.
import { addDays, isDateKey, toDateKey, weekdayIndex } from "@/lib/dates"
import type { ClassColor } from "@/lib/sessions"

export type ProtoClassType = {
  name: string
  color: ClassColor
  kind: "group" | "individual"
}

export type ProtoBookingStatus = "confirmed" | "waitlisted" | "late_cancelled"

export type ProtoSession = {
  id: string
  date: string
  start: string
  end: string
  classType: ProtoClassType
  coach: string
  capacity: number
  booked: number
  waitlist: number
  status: "scheduled" | "cancelled"
  /** Reserva del cliente que mira el prototipo */
  myBooking?: { status: ProtoBookingStatus; waitlistPosition?: number }
}

const TYPES = {
  cross: { name: "CrossTraining", color: "orange", kind: "group" },
  weightlifting: { name: "Halterofilia", color: "blue", kind: "group" },
  mobility: { name: "Movilidad", color: "teal", kind: "group" },
  hyrox: { name: "Hyrox", color: "red", kind: "group" },
  personal: { name: "Entrenamiento personal", color: "violet", kind: "individual" },
} satisfies Record<string, ProtoClassType>

type Slot = [start: string, end: string, type: keyof typeof TYPES, coach: string, capacity: number]

const WEEKDAY: Slot[] = [
  ["07:00", "08:00", "cross", "Laura", 12],
  ["08:30", "09:30", "mobility", "Marta", 10],
  ["10:00", "11:00", "weightlifting", "Dani", 8],
  ["13:00", "14:00", "cross", "Dani", 12],
  ["17:00", "18:00", "personal", "Marta", 1],
  ["18:00", "19:00", "cross", "Laura", 12],
  ["19:00", "20:00", "hyrox", "Dani", 14],
  ["20:00", "21:00", "cross", "Marta", 12],
]

const SATURDAY: Slot[] = [
  ["10:00", "11:00", "cross", "Laura", 16],
  ["11:30", "12:30", "hyrox", "Dani", 14],
]

export const LATE_CANCELLATIONS = [
  { id: "lc1", client: "Cliente de ejemplo 1", session: "CrossTraining · 07:00", when: "Anuló 40 min antes" },
  { id: "lc2", client: "Cliente de ejemplo 2", session: "Hyrox · 19:00 (ayer)", when: "Anuló 15 min antes" },
]

export function prototypeToday(): string {
  return toDateKey(new Date())
}

export function prototypeSessions(date: string, today = prototypeToday()): ProtoSession[] {
  const weekday = weekdayIndex(date)
  const slots = weekday === 6 ? [] : weekday === 5 ? SATURDAY : WEEKDAY
  const offset = daysBetween(today, date)

  return slots.map(([start, end, type, coach, capacity], index) => {
    const seed = hash(`${date}${start}`)
    const fullness = offset <= 0 ? 0.9 : offset >= 5 ? 0.3 : 0.75
    const booked = Math.min(capacity, Math.round(capacity * fullness + (seed % 5) - 2))
    const session: ProtoSession = {
      id: `${date}_${start.replace(":", "")}`,
      date,
      start,
      end,
      classType: TYPES[type],
      coach,
      capacity,
      booked: Math.max(0, booked),
      waitlist: booked >= capacity ? 1 + (seed % 3) : 0,
      status: "scheduled",
    }

    // Casos que el prototipo quiere enseñar
    if (offset === 0 && index === 5) session.myBooking = { status: "confirmed" }
    if (offset === 1 && index === 0) session.myBooking = { status: "confirmed" }
    if (offset === 1 && index === 6) {
      session.booked = capacity
      session.waitlist = 3
      session.myBooking = { status: "waitlisted", waitlistPosition: 2 }
    }
    if (offset === 2 && index === 3) session.status = "cancelled"
    return session
  })
}

export function prototypeSession(id: string): ProtoSession | undefined {
  const [date] = id.split("_")
  if (!isDateKey(date)) return undefined
  return prototypeSessions(date).find((s) => s.id === id)
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
}

function hash(text: string): number {
  let h = 0
  for (const char of text) h = (h * 31 + char.charCodeAt(0)) >>> 0
  return h
}

// Para que la lista de días del calendario tenga siempre una semana
export function prototypeWeek(today = prototypeToday()): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(today, i))
}
