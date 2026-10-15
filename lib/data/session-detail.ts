import { and, asc, eq, ilike, inArray, isNull, lte, notExists, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { z } from "zod"

import { bookings, classTypes, profiles, sessions } from "@/db/schema"
import type { ClassColor } from "@/lib/sessions"

import { lockSessions, promoteWaitlist } from "./bookings"
import type { Db } from "./db"

// Detalle de una sesión para el administrador (SPEC F6): asistentes, lista de espera, anulaciones tardías,
// añadir o quitar un cliente a mano y asistencia. Solo se llama desde la DAL tras `requireArea("admin")`.
// El entrenador (SPEC F7) reutiliza la lectura y la asistencia tras `requireArea("coach")`, pasando `coachId`
// (de la sesión verificada): entonces solo valen las sesiones que imparte, y una ajena es inexistente.

export type Attendance = "pending" | "attended" | "no_show"

export type SessionDetail = {
  id: string
  className: string
  color: ClassColor
  startsAt: Date
  endsAt: Date
  capacity: number
  coachName: string | null
  status: "scheduled" | "cancelled"
  cancelReason: string | null
  /** Reservas confirmadas, por nombre */
  attendees: { bookingId: string; fullName: string; attendance: Attendance; addedByStaff: boolean }[]
  /** Por orden de llegada; vacía cuando la sesión ya ha empezado (la lista caduca) */
  waitlist: { bookingId: string; userId: string; fullName: string }[]
  /** `charged`: `null` = pendiente de decidir */
  lateCancellations: { bookingId: string; fullName: string; cancelledAt: Date; charged: boolean | null }[]
}

const idSchema = z.uuid()

/** La sesión con sus reservas, o `null` si no existe (o, con `coachId`, si no la imparte él) */
export async function getSessionDetail(db: Db, sessionId: unknown, now = new Date(), coachId?: string): Promise<SessionDetail | null> {
  const parsed = idSchema.safeParse(sessionId)
  if (!parsed.success) return null
  const coach = alias(profiles, "coach")
  const [session] = await db
    .select({
      id: sessions.id,
      className: classTypes.name,
      color: classTypes.color,
      startsAt: sessions.startsAt,
      endsAt: sessions.endsAt,
      capacity: sessions.capacity,
      coachName: coach.fullName,
      status: sessions.status,
      cancelReason: sessions.cancelReason,
    })
    .from(sessions)
    .innerJoin(classTypes, eq(classTypes.id, sessions.classTypeId))
    .leftJoin(coach, eq(coach.userId, sessions.coachId))
    .where(coachId ? and(eq(sessions.id, parsed.data), eq(sessions.coachId, coachId)) : eq(sessions.id, parsed.data))
  if (!session) return null

  const rows = await db
    .select({
      bookingId: bookings.id,
      userId: bookings.userId,
      createdBy: bookings.createdBy,
      fullName: profiles.fullName,
      status: bookings.status,
      attendance: bookings.attendance,
      waitlistedAt: bookings.waitlistedAt,
      cancelledAt: bookings.cancelledAt,
      charged: bookings.lateCancelCharged,
    })
    .from(bookings)
    .innerJoin(profiles, eq(profiles.userId, bookings.userId))
    .where(and(eq(bookings.sessionId, session.id), inArray(bookings.status, ["confirmed", "waitlisted", "late_cancelled"])))
    .orderBy(asc(profiles.fullName), asc(bookings.id))

  const started = session.startsAt <= now
  const byTime = (a: Date | null, b: Date | null) => (a?.getTime() ?? 0) - (b?.getTime() ?? 0)
  return {
    ...(session as Omit<SessionDetail, "attendees" | "waitlist" | "lateCancellations">),
    attendees: rows
      .filter((r) => r.status === "confirmed")
      .map((r) => ({ bookingId: r.bookingId, fullName: r.fullName, attendance: r.attendance, addedByStaff: r.createdBy !== r.userId })),
    waitlist: started
      ? []
      : rows
          .filter((r) => r.status === "waitlisted")
          .sort((a, b) => byTime(a.waitlistedAt, b.waitlistedAt) || a.bookingId.localeCompare(b.bookingId))
          .map((r) => ({ bookingId: r.bookingId, userId: r.userId, fullName: r.fullName })),
    lateCancellations: rows
      .filter((r) => r.status === "late_cancelled")
      .sort((a, b) => byTime(a.cancelledAt, b.cancelledAt))
      .map((r) => ({ bookingId: r.bookingId, fullName: r.fullName, cancelledAt: r.cancelledAt as Date, charged: r.charged })),
  }
}

/** Resultados del buscador de «Añadir cliente» */
export const CLIENT_SEARCH_LIMIT = 10

const searchSchema = z.string().trim().min(2).max(60)

/**
 * Clientes activos cuyo nombre contiene `query` (sin distinguir mayúsculas; índice trigram) y que aún no tienen
 * plaza confirmada en la sesión. `waitlisted` indica que al añadirlo pasará de la lista de espera a confirmado.
 */
export async function searchClientsForSession(db: Db, sessionId: unknown, query: unknown) {
  const id = idSchema.safeParse(sessionId)
  const q = searchSchema.safeParse(query)
  if (!id.success || !q.success) return []
  const pattern = `%${q.data.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  const live = (status: "confirmed" | "waitlisted") =>
    db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.sessionId, id.data), eq(bookings.userId, profiles.userId), eq(bookings.status, status)))
  return db
    .select({
      userId: profiles.userId,
      fullName: profiles.fullName,
      waitlisted: sql<boolean>`exists (${live("waitlisted")})`,
    })
    .from(profiles)
    .where(
      and(
        eq(profiles.role, "client"),
        eq(profiles.status, "active"),
        isNull(profiles.deletedAt),
        ilike(profiles.fullName, pattern),
        notExists(live("confirmed")),
      ),
    )
    .orderBy(asc(profiles.fullName), asc(profiles.userId))
    .limit(CLIENT_SEARCH_LIMIT)
}

export type AddClientResult = "added" | "confirmed_from_waitlist" | "already_booked" | "client_not_active" | "session_cancelled" | "not_found"

/**
 * Añadir un cliente a mano: se salta el cupo de la tarifa, la ventana de reserva y el aforo (puede quedar 13/12),
 * también en sesiones pasadas para registrar la asistencia. Si estaba en la lista de espera, pasa a confirmado.
 * Bloquea la sesión y después el perfil (mismo orden que al reservar, ARCHITECTURE §4).
 */
export async function addClientToSession(db: Db, adminId: string, sessionId: unknown, userId: unknown): Promise<AddClientResult> {
  const sid = idSchema.safeParse(sessionId)
  const uid = idSchema.safeParse(userId)
  if (!sid.success || !uid.success) return "not_found"
  return db.transaction(async (tx) => {
    const [session] = await lockSessions(tx, [sid.data])
    if (!session) return "not_found"
    if (session.status !== "scheduled") return "session_cancelled"
    const [client] = await tx
      .select({ userId: profiles.userId })
      .from(profiles)
      .where(and(eq(profiles.userId, uid.data), eq(profiles.role, "client"), eq(profiles.status, "active"), isNull(profiles.deletedAt)))
      .for("update")
    if (!client) return "client_not_active"
    const [live] = await tx
      .select({ id: bookings.id, status: bookings.status })
      .from(bookings)
      .where(and(eq(bookings.sessionId, session.id), eq(bookings.userId, client.userId), inArray(bookings.status, ["confirmed", "waitlisted"])))
      .for("update")
    if (live?.status === "confirmed") return "already_booked"
    if (live) {
      await tx.update(bookings).set({ status: "confirmed" }).where(eq(bookings.id, live.id))
      return "confirmed_from_waitlist"
    }
    await tx.insert(bookings).values({ sessionId: session.id, userId: client.userId, createdBy: adminId, status: "confirmed" })
    return "added"
  })
}

export type RemoveResult = "removed" | "session_cancelled" | "not_found"

/**
 * Quitar a un cliente (plaza confirmada o lista de espera): la reserva queda anulada **sin descontar**, aunque
 * falte poco o la sesión ya haya pasado. Si deja una plaza libre en una sesión futura, se promueve la lista de espera.
 */
export async function removeBookingFromSession(db: Db, bookingId: unknown, now = new Date()): Promise<RemoveResult> {
  const parsed = idSchema.safeParse(bookingId)
  if (!parsed.success) return "not_found"
  const [found] = await db.select({ sessionId: bookings.sessionId }).from(bookings).where(eq(bookings.id, parsed.data))
  if (!found) return "not_found"
  return db.transaction(async (tx) => {
    const [session] = await lockSessions(tx, [found.sessionId])
    if (!session) return "not_found"
    if (session.status !== "scheduled") return "session_cancelled"
    const [booking] = await tx
      .select({ status: bookings.status })
      .from(bookings)
      .where(and(eq(bookings.id, parsed.data), inArray(bookings.status, ["confirmed", "waitlisted"])))
      .for("update")
    if (!booking) return "not_found"
    // La asistencia vuelve a pendiente: una falta ya marcada no debe quedar en una reserva anulada
    await tx.update(bookings).set({ status: "cancelled", cancelledAt: now, attendance: "pending" }).where(eq(bookings.id, parsed.data))
    if (booking.status === "confirmed") await promoteWaitlist(tx, session.id, now)
    return "removed"
  })
}

/**
 * Asistencia de una plaza confirmada, solo desde que empieza la sesión (y si no está cancelada). `false` si no
 * se puede. «Faltó» cuenta para el cupo de la tarifa (ARCHITECTURE §4). Con `coachId`, solo en sus sesiones.
 */
export async function setAttendance(db: Db, bookingId: unknown, attendance: Attendance, now = new Date(), coachId?: string) {
  const parsed = idSchema.safeParse(bookingId)
  if (!parsed.success) return false
  const startedSessions = db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.status, "scheduled"), lte(sessions.startsAt, now), coachId ? eq(sessions.coachId, coachId) : undefined))
  const updated = await db
    .update(bookings)
    .set({ attendance })
    .where(and(eq(bookings.id, parsed.data), eq(bookings.status, "confirmed"), inArray(bookings.sessionId, startedSessions)))
    .returning({ id: bookings.id })
  return updated.length > 0
}
