import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm"
import { z } from "zod"

import { bookings, classTypes, profiles, sessions } from "@/db/schema"
import { addDays } from "@/lib/dates"
import type { ClassColor } from "@/lib/sessions"

import type { Db } from "./db"

// Calendario del cliente (SPEC F5): sesiones de un día con plazas y el estado de la reserva propia. Las reservas
// de los demás solo se cuentan; de la propia, se busca por el usuario de la sesión (`userId`), nunca por un id
// que llegue del navegador.

export type MyBooking = {
  id: string
  status: "confirmed" | "waitlisted" | "late_cancelled"
  /** Puesto en la lista de espera (1 = el siguiente) */
  waitlistPosition?: number
}

export type CalendarSession = {
  id: string
  className: string
  color: ClassColor
  startsAt: Date
  endsAt: Date
  capacity: number
  /** Plazas confirmadas */
  booked: number
  /** En lista de espera (0 cuando la sesión ya ha empezado: la lista caduca) */
  waitlisted: number
  coachName: string | null
  status: "scheduled" | "cancelled"
  myBooking: MyBooking | null
}

const tz = sql`coalesce((select timezone from gym_settings where id = 1), 'Europe/Madrid')`
export const startOfDay = (day: string) => sql`(${day}::date::timestamp at time zone ${tz}::text)`

// Con el nombre de la tabla: sin él, el subselect leería "id" como bookings.id (lib/data/schedule.ts)
const countBookings = (status: "confirmed" | "waitlisted") =>
  sql<number>`(select count(*)::int from bookings b where b.session_id = "sessions"."id" and b.status = ${status})`

const sessionColumns = {
  id: sessions.id,
  className: classTypes.name,
  color: classTypes.color,
  startsAt: sessions.startsAt,
  endsAt: sessions.endsAt,
  capacity: sessions.capacity,
  booked: countBookings("confirmed"),
  waitlisted: countBookings("waitlisted"),
  coachName: profiles.fullName,
  status: sessions.status,
} as const

type SessionRow = Omit<CalendarSession, "myBooking">

const waitlistPosition = sql<number>`(
  select count(*)::int from bookings w
  where w.session_id = "bookings"."session_id" and w.status = 'waitlisted'
    and (w.waitlisted_at, w.id) <= ("bookings"."waitlisted_at", "bookings"."id")
)`

/** Reserva propia en cada sesión: la viva si la hay; si no, la última anulación tardía */
async function myBookingsIn(db: Db, userId: string, sessionIds: string[]) {
  const mine = new Map<string, MyBooking>()
  if (sessionIds.length === 0) return mine
  const rows = await db
    .select({
      id: bookings.id,
      sessionId: bookings.sessionId,
      status: bookings.status,
      waitlistPosition,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, userId),
        inArray(bookings.sessionId, sessionIds),
        inArray(bookings.status, ["confirmed", "waitlisted", "late_cancelled"]),
      ),
    )
    .orderBy(desc(bookings.createdAt))
  for (const row of rows) {
    const current = mine.get(row.sessionId)
    if (current && current.status !== "late_cancelled") continue
    if (current && row.status === "late_cancelled") continue
    mine.set(row.sessionId, {
      id: row.id,
      status: row.status as MyBooking["status"],
      ...(row.status === "waitlisted" && { waitlistPosition: row.waitlistPosition }),
    })
  }
  return mine
}

/** La lista de espera caduca al empezar la sesión: ni se cuenta ni se muestra la propia */
function withMine(rows: SessionRow[], mine: Map<string, MyBooking>, now: Date): CalendarSession[] {
  return rows.map((row) => {
    const started = row.startsAt <= now
    const myBooking = mine.get(row.id) ?? null
    return {
      ...row,
      waitlisted: started ? 0 : row.waitlisted,
      myBooking: started && myBooking?.status === "waitlisted" ? null : myBooking,
    }
  })
}

/** Sesiones de un día (en la zona del gimnasio), canceladas incluidas, por hora */
export async function listDaySessions(db: Db, userId: string, day: string, now = new Date()): Promise<CalendarSession[]> {
  const rows = (await db
    .select(sessionColumns)
    .from(sessions)
    .innerJoin(classTypes, eq(classTypes.id, sessions.classTypeId))
    .leftJoin(profiles, eq(profiles.userId, sessions.coachId))
    .where(and(gte(sessions.startsAt, startOfDay(day)), lt(sessions.startsAt, startOfDay(addDays(day, 1)))))
    .orderBy(asc(sessions.startsAt), asc(classTypes.name))) as SessionRow[]
  return withMine(rows, await myBookingsIn(db, userId, rows.map((r) => r.id)), now)
}

const sessionIdSchema = z.uuid()

/** Una sesión con mi reserva, o `null` si el id no es válido o no existe */
export async function getCalendarSession(db: Db, userId: string, sessionId: unknown, now = new Date()) {
  const parsed = sessionIdSchema.safeParse(sessionId)
  if (!parsed.success) return null
  const rows = (await db
    .select(sessionColumns)
    .from(sessions)
    .innerJoin(classTypes, eq(classTypes.id, sessions.classTypeId))
    .leftJoin(profiles, eq(profiles.userId, sessions.coachId))
    .where(eq(sessions.id, parsed.data))) as SessionRow[]
  if (rows.length === 0) return null
  return withMine(rows, await myBookingsIn(db, userId, [parsed.data]), now)[0]
}

const bookingIdSchema = z.uuid()

/** Reserva viva propia que se quiere cambiar de sesión, o `null` (no existe, no es mía o ya no está viva) */
export async function getMyLiveBooking(db: Db, userId: string, bookingId: unknown) {
  const parsed = bookingIdSchema.safeParse(bookingId)
  if (!parsed.success) return null
  const [row] = await db
    .select({ id: bookings.id, sessionId: bookings.sessionId, startsAt: sessions.startsAt, className: classTypes.name })
    .from(bookings)
    .innerJoin(sessions, eq(sessions.id, bookings.sessionId))
    .innerJoin(classTypes, eq(classTypes.id, sessions.classTypeId))
    .where(and(eq(bookings.id, parsed.data), eq(bookings.userId, userId), inArray(bookings.status, ["confirmed", "waitlisted"])))
  return row ?? null
}
