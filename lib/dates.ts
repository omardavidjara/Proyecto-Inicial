// Fechas en la zona horaria del gimnasio (docs/SPEC.md §1, docs/DESIGN.md §3).
// Una "clave de día" es una cadena AAAA-MM-DD, la misma que usa ?fecha= en la URL.

export const GYM_TIME_ZONE = "Europe/Madrid"

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY.test(value)) return false
  return toUtcNoon(value).toISOString().slice(0, 10) === value
}

/** Día (AAAA-MM-DD) de un instante, en la zona horaria del gimnasio */
export function toDateKey(date: Date, timeZone = GYM_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
}

export function addDays(key: string, days: number): string {
  const date = toUtcNoon(key)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** 0 = lunes … 6 = domingo */
export function weekdayIndex(key: string): number {
  return (toUtcNoon(key).getUTCDay() + 6) % 7
}

/** Lunes de la semana de ese día (las semanas van de lunes a domingo, docs/SPEC.md §8) */
export function startOfWeek(key: string): string {
  return addDays(key, -weekdayIndex(key))
}

/** "5 – 11 oct" o "29 sept – 5 oct" */
export function formatWeekRange(monday: string): string {
  const sunday = addDays(monday, 6)
  const month = (key: string) => format(key, { month: "short" }).replace(".", "")
  const start = monday.slice(5, 7) === sunday.slice(5, 7) ? formatDayNumber(monday) : `${formatDayNumber(monday)} ${month(monday)}`
  return `${start} – ${formatDayNumber(sunday)} ${month(sunday)}`
}

/** "lun" */
export function formatWeekdayShort(key: string): string {
  return format(key, { weekday: "short" }).replace(".", "")
}

/** "6" */
export function formatDayNumber(key: string): string {
  return String(toUtcNoon(key).getUTCDate())
}

/** "Hoy", "Mañana" o "lun 6 oct" */
export function formatDayLabel(key: string, today: string): string {
  if (key === today) return "Hoy"
  if (key === addDays(today, 1)) return "Mañana"
  return format(key, { weekday: "short", day: "numeric", month: "short" }).replaceAll(".", "").replace(",", "")
}

/** "lunes, 6 de octubre" */
export function formatDayLong(key: string): string {
  return format(key, { weekday: "long", day: "numeric", month: "long" })
}

function toUtcNoon(key: string): Date {
  return new Date(`${key}T12:00:00Z`)
}

function format(key: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("es-ES", { ...options, timeZone: "UTC" }).format(toUtcNoon(key))
}
