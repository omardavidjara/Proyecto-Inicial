import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"

import { bookings, classTypes, sessions } from "@/db/schema"
import { isStaff } from "@/lib/roles"

import type { Db } from "./db"
import type { Viewer } from "./profiles"

// Reservas vistas por una persona. Toda consulta filtra por el usuario de la sesión (`viewer`),
// nunca por un id que llegue del navegador (ARCHITECTURE §6).

const myBookingColumns = {
  id: bookings.id,
  status: bookings.status,
  attendance: bookings.attendance,
  sessionId: sessions.id,
  startsAt: sessions.startsAt,
  endsAt: sessions.endsAt,
  sessionStatus: sessions.status,
  className: classTypes.name,
  classColor: classTypes.color,
} as const

/** Mis reservas, de la más reciente a la más antigua (paginación por cursor llega con F5) */
export async function listMyBookings(db: Db, viewer: Viewer, limit = 20) {
  return db
    .select(myBookingColumns)
    .from(bookings)
    .innerJoin(sessions, eq(bookings.sessionId, sessions.id))
    .innerJoin(classTypes, eq(sessions.classTypeId, classTypes.id))
    .where(eq(bookings.userId, viewer.userId))
    .orderBy(desc(bookings.createdAt), desc(bookings.id))
    .limit(Math.min(Math.max(limit, 1), 100))
}

const bookingIdSchema = z.uuid()

/**
 * Una reserva concreta. Devuelve `null` si no existe **o** si no es del usuario (salvo administración):
 * así no se puede averiguar si un id ajeno existe.
 */
export async function getBookingForViewer(db: Db, viewer: Viewer, bookingId: unknown) {
  const parsed = bookingIdSchema.safeParse(bookingId)
  if (!parsed.success) return null

  const canSeeAll = isStaff(viewer) && viewer.status === "active"
  const ownership = canSeeAll ? undefined : eq(bookings.userId, viewer.userId)
  const [row] = await db
    .select(myBookingColumns)
    .from(bookings)
    .innerJoin(sessions, eq(bookings.sessionId, sessions.id))
    .innerJoin(classTypes, eq(sessions.classTypeId, classTypes.id))
    .where(and(eq(bookings.id, parsed.data), ownership))
  return row ?? null
}
