// Fechas en la zona horaria del gimnasio (docs/SPEC.md §1, docs/DESIGN.md §3).
// Una "clave de día" es una cadena AAAA-MM-DD, la misma que usa ?fecha= en la URL.

export const GYM_TIME_ZONE = "Europe/Madrid"

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY.test(value)) return false
  // Mes 13 o día 32 dan una fecha inválida (toISOString lanzaría); 02-30 se desbordaría a marzo
  const date = toUtcNoon(value)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Día (AAAA-MM-DD) de un instante, en la zona horaria del gimnasio */
export function toDateKey(date: Date, timeZone = GYM_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
}

/** Hora (HH:MM) de un instante, en la zona horaria del gimnasio */
export function toTimeKey(date: Date, timeZone = GYM_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date)
}

/**
 * El mismo instante de reloj `days` días de calendario antes o después, en esa zona: cruzar un cambio de hora no
 * desplaza la hora local (sumar bloques de 24 h sí lo haría)
 */
export function addLocalDays(date: Date, days: number, timeZone = GYM_TIME_ZONE): Date {
  const wall = date.getTime() + offsetAt(date, timeZone) + days * 86_400_000
  const guess = new Date(wall - offsetAt(date, timeZone))
  return new Date(wall - offsetAt(guess, timeZone))
}

/** Lo que va adelantada la hora local de esa zona respecto a UTC en ese instante, en ms */
function offsetAt(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  return local - Math.floor(date.getTime() / 1000) * 1000
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
/** «Empieza en 25 min», «Empieza en 1 h 30 min», «Empieza en 5 h»; null si falta 12 h o más */
export function formatStartsIn(startsAt: Date, now: Date): string | null {
  const minutes = Math.ceil((startsAt.getTime() - now.getTime()) / 60_000)
  if (minutes <= 0) return "Ya ha empezado"
  if (minutes < 60) return `Empieza en ${minutes} min`
  if (minutes >= 12 * 60) return null
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours < 3 && rest > 0 ? `Empieza en ${hours} h ${rest} min` : `Empieza en ${hours} h`
}

export function formatDayLabel(key: string, today: string): string {
  if (key === today) return "Hoy"
  if (key === addDays(today, 1)) return "Mañana"
  return format(key, { weekday: "short", day: "numeric", month: "short" }).replaceAll(".", "").replace(",", "")
}

/** "lunes, 6 de octubre" */
export function formatDayLong(key: string): string {
  return format(key, { weekday: "long", day: "numeric", month: "long" })
}

/** "6 oct 2026" */
export function formatDateShort(key: string): string {
  return format(key, { day: "numeric", month: "short", year: "numeric" }).replaceAll(".", "")
}

function toUtcNoon(key: string): Date {
  return new Date(`${key}T12:00:00Z`)
}

function format(key: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("es-ES", { ...options, timeZone: "UTC" }).format(toUtcNoon(key))
}

/** "octubre de 2026" */
export function formatMonthYear(key: string): string {
  return format(key, { month: "long", year: "numeric" })
}

/** Día 1 del mes de ese día, desplazado `months` meses */
export function startOfMonth(key: string, months = 0): string {
  const date = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + months, 1, 12))
  return date.toISOString().slice(0, 10)
}
