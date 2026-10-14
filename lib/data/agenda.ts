import { and, asc, eq, gte, isNull, lt, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { z } from "zod"

import { bookings, classTypes, profiles, sessions } from "@/db/schema"
import { addDays } from "@/lib/dates"
import type { ClassColor } from "@/lib/sessions"

import { startOfDay } from "./calendar"
import type { Db } from "./db"

// Agenda y anulaciones tardías del administrador (SPEC F6). Solo se llama desde la DAL tras `requireArea("admin")`:
// aquí se ven las reservas de todos los clientes.

export type AgendaSession = {
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
}

// Con el nombre de la tabla: sin él, el subselect leería "id" como bookings.id (lib/data/schedule.ts)
const countBookings = (status: "confirmed" | "waitlisted") =>
  sql<number>`(select count(*)::int from bookings b where b.session_id = "sessions"."id" and b.status = ${status})`

/** Sesiones de los días `from` a `to` (incluidos, en la zona del gimnasio), canceladas incluidas, por hora */
export async function listSessionsBetween(db: Db, from: string, to: string, now = new Date()): Promise<AgendaSession[]> {
  const rows = (await db
    .select({
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
    })
    .from(sessions)
    .innerJoin(classTypes, eq(classTypes.id, sessions.classTypeId))
    .leftJoin(profiles, eq(profiles.userId, sessions.coachId))
    .where(and(gte(sessions.startsAt, startOfDay(from)), lt(sessions.startsAt, startOfDay(addDays(to, 1)))))
    .orderBy(asc(sessions.startsAt), asc(classTypes.name))) as AgendaSession[]
  return rows.map((row) => (row.startsAt <= now ? { ...row, waitlisted: 0 } : row))
}

// ── Anulaciones tardías (ARCHITECTURE §4) ───────────────────────────────────────────────────────────────

export type PendingLateCancellation = {
  id: string
  clientName: string
  className: string
  startsAt: Date
  cancelledAt: Date
}

/** Tope de la lista: se deciden a diario y son pocas; si se llega, se ven las más antiguas primero */
export const LATE_CANCELLATIONS_LIMIT = 100

const pendingLate = and(eq(bookings.status, "late_cancelled"), isNull(bookings.lateCancelCharged))

/** Anulaciones tardías sin decidir, de la más antigua a la más reciente */
export async function listPendingLateCancellations(db: Db, limit = LATE_CANCELLATIONS_LIMIT): Promise<PendingLateCancellation[]> {
  const client = alias(profiles, "client")
  const rows = await db
    .select({
      id: bookings.id,
      clientName: client.fullName,
      className: classTypes.name,
      startsAt: sessions.startsAt,
      cancelledAt: bookings.cancelledAt,
    })
    .from(bookings)
    .innerJoin(client, eq(client.userId, bookings.userId))
    .innerJoin(sessions, eq(sessions.id, bookings.sessionId))
    .innerJoin(classTypes, eq(classTypes.id, sessions.classTypeId))
    .where(pendingLate)
    .orderBy(asc(bookings.cancelledAt), asc(bookings.id))
    .limit(limit)
  return rows as PendingLateCancellation[]
}

export const countPendingLateCancellations = (db: Db) => db.$count(bookings, pendingLate)

const bookingIdSchema = z.uuid()

/**
 * Descontar (`charge = true`) o no la clase de una anulación tardía pendiente. `false` si no existe o ya está
 * decidida (otra persona se adelantó). Si se descuenta y el cliente ya superaba su cupo, no se anula nada: solo
 * cuenta para la próxima comprobación (ARCHITECTURE §4).
 */
export async function decideLateCancellation(db: Db, adminId: string, bookingId: unknown, charge: boolean) {
  const parsed = bookingIdSchema.safeParse(bookingId)
  if (!parsed.success) return false
  const updated = await db
    .update(bookings)
    .set({ lateCancelCharged: charge, lateCancelDecidedBy: adminId })
    .where(and(eq(bookings.id, parsed.data), pendingLate))
    .returning({ id: bookings.id })
  return updated.length > 0
}
