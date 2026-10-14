import { and, asc, desc, eq, gt, inArray, lte, or, sql } from "drizzle-orm"
import { z } from "zod"

import { bookings, classTypes, profiles, sessions } from "@/db/schema"
import type { ClassColor } from "@/lib/sessions"

import type { Db } from "./db"

// «Mis reservas» (SPEC F5): las próximas (vivas, de sesiones que aún no han empezado) y el historial (todo lo
// demás: clases pasadas y anulaciones), siempre del usuario de la sesión (`userId`).

export type MyBookingRow = {
  id: string
  sessionId: string
  status: "confirmed" | "waitlisted" | "cancelled" | "late_cancelled"
  attendance: "pending" | "attended" | "no_show"
  /** Anulación tardía: `null` mientras el gimnasio no decide si descuenta la clase */
  lateCancelCharged: boolean | null
  startsAt: Date
  endsAt: Date
  sessionStatus: "scheduled" | "cancelled"
  className: string
  color: ClassColor
  coachName: string | null
  capacity: number
  /** Plazas confirmadas de la sesión */
  booked: number
  /** Puesto en la lista de espera (solo en las próximas en espera) */
  waitlistPosition?: number
}

const confirmedCount = sql<number>`(
  select count(*)::int from bookings b where b.session_id = "bookings"."session_id" and b.status = 'confirmed'
)`

const waitlistPosition = sql<number>`(
  select count(*)::int from bookings w
  where w.session_id = "bookings"."session_id" and w.status = 'waitlisted'
    and (w.waitlisted_at, w.id) <= ("bookings"."waitlisted_at", "bookings"."id")
)`

const columns = {
  id: bookings.id,
  sessionId: bookings.sessionId,
  status: bookings.status,
  attendance: bookings.attendance,
  lateCancelCharged: bookings.lateCancelCharged,
  startsAt: sessions.startsAt,
  endsAt: sessions.endsAt,
  sessionStatus: sessions.status,
  className: classTypes.name,
  color: classTypes.color,
  coachName: profiles.fullName,
  capacity: sessions.capacity,
  booked: confirmedCount,
} as const

const live = inArray(bookings.status, ["confirmed", "waitlisted"])

/** Próximas: reservas vivas de sesiones que no han empezado, de la más cercana a la más lejana */
export async function listUpcomingBookings(db: Db, userId: string, now = new Date()): Promise<MyBookingRow[]> {
  const rows = await db
    .select({ ...columns, waitlistPosition })
    .from(bookings)
    .innerJoin(sessions, eq(sessions.id, bookings.sessionId))
    .innerJoin(classTypes, eq(classTypes.id, sessions.classTypeId))
    .leftJoin(profiles, eq(profiles.userId, sessions.coachId))
    .where(and(eq(bookings.userId, userId), live, gt(sessions.startsAt, now)))
    .orderBy(asc(sessions.startsAt), asc(bookings.id))
    // La ventana de reserva las limita; el tope solo protege la consulta
    .limit(100)
  return rows.map(({ waitlistPosition, ...row }) =>
    row.status === "waitlisted" ? { ...row, waitlistPosition } : row,
  ) as MyBookingRow[]
}

/** Próxima clase confirmada, o `null` («Inicio») */
export async function getNextConfirmedBooking(db: Db, userId: string, now = new Date()) {
  const [row] = await db
    .select(columns)
    .from(bookings)
    .innerJoin(sessions, eq(sessions.id, bookings.sessionId))
    .innerJoin(classTypes, eq(classTypes.id, sessions.classTypeId))
    .leftJoin(profiles, eq(profiles.userId, sessions.coachId))
    .where(and(eq(bookings.userId, userId), eq(bookings.status, "confirmed"), gt(sessions.startsAt, now)))
    .orderBy(asc(sessions.startsAt), asc(bookings.id))
    .limit(1)
  return (row as MyBookingRow | undefined) ?? null
}

// El cursor del historial es la última fila de la página anterior: «<inicio ISO>_<id de la reserva>»
const cursorSchema = z
  .string()
  .max(80)
  .transform((value, ctx) => {
    const [iso, id] = value.split("_")
    const startsAt = new Date(iso ?? "")
    if (!z.uuid().safeParse(id).success || Number.isNaN(startsAt.getTime()) || startsAt.toISOString() !== iso) {
      ctx.addIssue({ code: "custom", message: "Cursor no válido" })
      return z.NEVER
    }
    return { startsAt, id: id as string }
  })

export const HISTORY_PAGE_SIZE = 20

export type HistoryPage = { items: MyBookingRow[]; nextCursor: string | null }

/**
 * Historial: clases que ya han empezado y reservas anuladas, de la más reciente a la más antigua, por páginas.
 * `cursor` es el `nextCursor` de la página anterior; si no es válido, se empieza por el principio.
 */
export async function listBookingHistory(
  db: Db,
  userId: string,
  { cursor, now = new Date(), limit = HISTORY_PAGE_SIZE }: { cursor?: unknown; now?: Date; limit?: number } = {},
): Promise<HistoryPage> {
  const after = cursor == null ? null : cursorSchema.safeParse(cursor)
  const size = Math.min(Math.max(limit, 1), 50)
  const rows = (await db
    .select(columns)
    .from(bookings)
    .innerJoin(sessions, eq(sessions.id, bookings.sessionId))
    .innerJoin(classTypes, eq(classTypes.id, sessions.classTypeId))
    .leftJoin(profiles, eq(profiles.userId, sessions.coachId))
    .where(
      and(
        eq(bookings.userId, userId),
        or(inArray(bookings.status, ["cancelled", "late_cancelled"]), lte(sessions.startsAt, now)),
        after?.success
          ? sql`(${sessions.startsAt}, ${bookings.id}) < (${after.data.startsAt.toISOString()}::timestamptz, ${after.data.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(sessions.startsAt), desc(bookings.id))
    .limit(size + 1)) as MyBookingRow[]

  const items = rows.slice(0, size)
  const last = items.at(-1)
  return {
    items,
    nextCursor: rows.length > size && last ? `${last.startsAt.toISOString()}_${last.id}` : null,
  }
}
