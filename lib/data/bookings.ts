import { and, asc, desc, eq, gt, inArray, isNull } from "drizzle-orm"
import { z } from "zod"

import { bookings, classTypes, gymSettings, profiles, sessions } from "@/db/schema"
import {
  bookingWindow,
  DEFAULT_BOOKING_RULES,
  hasClassesLeft,
  isLateCancel,
  placeFor,
  type BookingRules,
} from "@/lib/booking"
import { GYM_TIME_ZONE, toDateKey } from "@/lib/dates"
import { isStaff } from "@/lib/roles"

import type { Db } from "./db"
import { countUsedClasses, getMembershipOn } from "./memberships"
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


// ── Reservar, anular, cambiar y lista de espera (SPEC F5, ARCHITECTURE §4) ──────────────────────────────────
// Cada operación es una transacción que bloquea primero las sesiones (`FOR UPDATE`, por id si son varias) y
// después el perfil: así dos reservas a la vez no superan el aforo ni el cupo de la tarifa, y el orden de los
// bloqueos es siempre el mismo (sesión → perfil), también en la baja y al eliminar la cuenta.

type BookingSettings = BookingRules & { timeZone: string }

/** Reglas de reserva y zona horaria del gimnasio (valores de SPEC §4 si falta la fila) */
export async function getBookingSettings(db: Db): Promise<BookingSettings> {
  const [row] = await db
    .select({
      timeZone: gymSettings.timezone,
      bookingWindowDays: gymSettings.bookingWindowDays,
      cancelDeadlineMinutes: gymSettings.cancelDeadlineMinutes,
    })
    .from(gymSettings)
    .where(eq(gymSettings.id, 1))
  return row ?? { ...DEFAULT_BOOKING_RULES, timeZone: GYM_TIME_ZONE }
}

type LockedSession = { id: string; status: "scheduled" | "cancelled"; startsAt: Date; capacity: number }

/** Bloquea las sesiones en orden de id (el mismo en todas las operaciones, para no bloquearse entre ellas) */
async function lockSessions(db: Db, ids: string[]): Promise<LockedSession[]> {
  if (ids.length === 0) return []
  return db
    .select({ id: sessions.id, status: sessions.status, startsAt: sessions.startsAt, capacity: sessions.capacity })
    .from(sessions)
    .where(inArray(sessions.id, ids))
    .orderBy(asc(sessions.id))
    .for("update")
}

const isLive = inArray(bookings.status, ["confirmed", "waitlisted"])

const countConfirmed = (db: Db, sessionId: string) =>
  db.$count(bookings, and(eq(bookings.sessionId, sessionId), eq(bookings.status, "confirmed")))

type MemberCheck = "ok" | "not_active" | "no_plan" | "no_classes_left"

/**
 * El cliente puede gastar una clase en esa sesión: perfil activo, tarifa vigente el día de la sesión y clases
 * libres en su periodo (ARCHITECTURE §4, paso 3). Bloquea el perfil hasta el final de la transacción.
 */
async function checkMember(db: Db, userId: string, startsAt: Date, timeZone: string): Promise<MemberCheck> {
  const [profile] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(and(eq(profiles.userId, userId), eq(profiles.status, "active"), isNull(profiles.deletedAt)))
    .for("update")
  if (!profile) return "not_active"
  const day = toDateKey(startsAt, timeZone)
  const membership = await getMembershipOn(db, userId, day)
  if (!membership) return "no_plan"
  if (membership.period === "unlimited") return "ok"
  const used = await countUsedClasses(db, userId, membership.period, day)
  return hasClassesLeft(membership, used) ? "ok" : "no_classes_left"
}

export type BookFailure =
  | "not_found"
  | "session_cancelled"
  | "not_open_yet"
  | "closed"
  | "already_booked"
  | Exclude<MemberCheck, "ok">

export type BookResult = "confirmed" | "waitlisted" | BookFailure

/** Lo que se comprueba de la sesión antes que de la persona; `null` si se puede reservar */
async function checkSession(db: Db, userId: string, session: LockedSession | undefined, now: Date, rules: BookingRules) {
  if (!session) return "not_found" as const
  if (session.status !== "scheduled") return "session_cancelled" as const
  const window = bookingWindow(session.startsAt, now, rules)
  if (window !== "open") return window
  const [live] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.sessionId, session.id), eq(bookings.userId, userId), isLive))
  return live ? ("already_booked" as const) : null
}

const sessionIdSchema = z.uuid()

/**
 * Reservar para uno mismo: plaza confirmada si queda, si no a la lista de espera (que no gasta clase, pero
 * también exige tarifa y clases libres). Quien llama comprueba que el rol puede reservar.
 */
export async function bookSession(db: Db, userId: string, sessionId: unknown, now = new Date()): Promise<BookResult> {
  const parsed = sessionIdSchema.safeParse(sessionId)
  if (!parsed.success) return "not_found"
  const settings = await getBookingSettings(db)
  return db.transaction(async (tx) => {
    const [session] = await lockSessions(tx, [parsed.data])
    const problem = await checkSession(tx, userId, session, now, settings)
    if (problem) return problem
    const member = await checkMember(tx, userId, session.startsAt, settings.timeZone)
    if (member !== "ok") return member
    const status = placeFor(session.capacity, await countConfirmed(tx, session.id))
    await tx.insert(bookings).values({
      sessionId: session.id,
      userId,
      createdBy: userId,
      status,
      waitlistedAt: status === "waitlisted" ? now : null,
    })
    return status
  })
}

/**
 * Promueve la lista de espera de una sesión ya bloqueada mientras haya plazas: entra el primero (por
 * `waitlisted_at`) cuya tarifa lo permita; los demás siguen esperando. Solo en sesiones programadas que aún no
 * han empezado (después, la lista caduca). Devuelve las reservas promovidas (F10 les avisará por push).
 */
export async function promoteWaitlist(db: Db, sessionId: string, now = new Date()) {
  const [session] = await db
    .select({ status: sessions.status, startsAt: sessions.startsAt, capacity: sessions.capacity })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
  if (!session || session.status !== "scheduled" || session.startsAt <= now) return []
  let free = session.capacity - (await countConfirmed(db, sessionId))
  if (free <= 0) return []

  const { timeZone } = await getBookingSettings(db)
  const queue = await db
    .select({ id: bookings.id, userId: bookings.userId })
    .from(bookings)
    .where(and(eq(bookings.sessionId, sessionId), eq(bookings.status, "waitlisted")))
    .orderBy(asc(bookings.waitlistedAt), asc(bookings.id))
  const promoted: { id: string; userId: string }[] = []
  for (const candidate of queue) {
    if (free === 0) break
    if ((await checkMember(db, candidate.userId, session.startsAt, timeZone)) !== "ok") continue
    await db.update(bookings).set({ status: "confirmed" }).where(eq(bookings.id, candidate.id))
    promoted.push(candidate)
    free--
  }
  return promoted
}

/** Reserva viva propia (o `undefined`): solo el id de su sesión, para bloquearla antes de tocar la reserva */
async function findLiveBooking(db: Db, userId: string, bookingId: unknown) {
  const parsed = bookingIdSchema.safeParse(bookingId)
  if (!parsed.success) return undefined
  const [row] = await db
    .select({ sessionId: bookings.sessionId })
    .from(bookings)
    .where(and(eq(bookings.id, parsed.data), eq(bookings.userId, userId), isLive))
  return row ? { id: parsed.data, sessionId: row.sessionId } : undefined
}

/** Vuelve a leer la reserva con la sesión ya bloqueada: puede haber cambiado mientras tanto */
async function lockLiveBooking(db: Db, bookingId: string, userId: string) {
  const [row] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId), isLive))
    .for("update")
  return row as { status: "confirmed" | "waitlisted" } | undefined
}

/** Anula una reserva viva: salir de la lista de espera, anular a tiempo o anulación tardía (pendiente de decidir) */
async function releaseBooking(
  db: Db,
  bookingId: string,
  status: "confirmed" | "waitlisted",
  startsAt: Date,
  now: Date,
  rules: BookingRules,
) {
  const late = status === "confirmed" && isLateCancel(startsAt, now, rules)
  await db
    .update(bookings)
    .set({ status: late ? "late_cancelled" : "cancelled", cancelledAt: now })
    .where(eq(bookings.id, bookingId))
  if (status === "waitlisted") return "left_waitlist" as const
  return late ? ("late_cancelled" as const) : ("cancelled" as const)
}

export type CancelResult = "cancelled" | "late_cancelled" | "left_waitlist" | "not_found" | "closed"

/**
 * Anular una reserva propia antes de que empiece la sesión. A menos de `cancel_deadline_minutes` queda como
 * tardía y no descuenta hasta que decida el administrador. La plaza se libera y se promueve la lista de espera.
 */
export async function cancelBooking(db: Db, userId: string, bookingId: unknown, now = new Date()): Promise<CancelResult> {
  const found = await findLiveBooking(db, userId, bookingId)
  if (!found) return "not_found"
  const settings = await getBookingSettings(db)
  return db.transaction(async (tx) => {
    const [session] = await lockSessions(tx, [found.sessionId])
    const booking = await lockLiveBooking(tx, found.id, userId)
    if (!session || !booking) return "not_found"
    if (session.startsAt <= now) return "closed"
    const result = await releaseBooking(tx, found.id, booking.status, session.startsAt, now, settings)
    if (booking.status === "confirmed") await promoteWaitlist(tx, session.id, now)
    return result
  })
}

export type ChangeResult = "changed" | "changed_late" | "same_session" | "full" | BookFailure

/** Deshace la transacción de un cambio que no se puede completar, devolviendo el motivo */
class ChangeAborted extends Error {
  constructor(readonly result: ChangeResult) {
    super(result)
  }
}

/**
 * Cambiar una reserva a otra sesión = anular + reservar en una sola transacción (SPEC F5): si la nueva no se
 * puede reservar, la antigua sigue igual. Solo a una sesión con plaza libre: no se cambia una plaza por la
 * lista de espera. La anulación sigue las reglas de siempre (puede ser tardía).
 */
export async function changeBooking(
  db: Db,
  userId: string,
  bookingId: unknown,
  newSessionId: unknown,
  now = new Date(),
): Promise<ChangeResult> {
  const found = await findLiveBooking(db, userId, bookingId)
  const parsed = sessionIdSchema.safeParse(newSessionId)
  if (!found || !parsed.success) return "not_found"
  if (parsed.data === found.sessionId) return "same_session"
  const settings = await getBookingSettings(db)
  try {
    return await db.transaction(async (tx) => {
      const locked = await lockSessions(tx, [found.sessionId, parsed.data])
      const oldSession = locked.find((s) => s.id === found.sessionId)
      const newSession = locked.find((s) => s.id === parsed.data)
      const booking = await lockLiveBooking(tx, found.id, userId)
      if (!oldSession || !booking) return "not_found"
      if (oldSession.startsAt <= now) return "closed"
      const problem = await checkSession(tx, userId, newSession, now, settings)
      if (problem || !newSession) return problem ?? "not_found"
      if (placeFor(newSession.capacity, await countConfirmed(tx, newSession.id)) !== "confirmed") return "full"

      // Primero se anula la antigua: si era del mismo periodo, su clase vuelve a quedar libre
      const released = await releaseBooking(tx, found.id, booking.status, oldSession.startsAt, now, settings)
      const member = await checkMember(tx, userId, newSession.startsAt, settings.timeZone)
      if (member !== "ok") throw new ChangeAborted(member)
      await tx.insert(bookings).values({ sessionId: newSession.id, userId, createdBy: userId, status: "confirmed" })
      if (booking.status === "confirmed") await promoteWaitlist(tx, oldSession.id, now)
      return released === "late_cancelled" ? "changed_late" : "changed"
    })
  } catch (error) {
    if (error instanceof ChangeAborted) return error.result
    throw error
  }
}

/**
 * Baja o cuenta eliminada (ARCHITECTURE §4), primera parte: bloquea las sesiones futuras en las que la persona
 * tiene reservas vivas, **antes** de tocar su perfil (mismo orden de bloqueos que al reservar).
 */
export async function lockFutureSessionsOf(db: Db, userId: string, now = new Date()) {
  const rows = await db
    .selectDistinct({ id: bookings.sessionId })
    .from(bookings)
    .innerJoin(sessions, eq(sessions.id, bookings.sessionId))
    .where(and(eq(bookings.userId, userId), isLive, gt(sessions.startsAt, now)))
  return (await lockSessions(db, rows.map((r) => r.id))).map((s) => s.id)
}

/**
 * Segunda parte: anula sus reservas vivas futuras sin descontar y promueve la lista de espera de cada sesión
 * afectada. Si entretanto se coló alguna reserva en otra sesión, la bloquea también.
 */
export async function cancelFutureBookingsOf(db: Db, userId: string, lockedSessionIds: string[], now = new Date()) {
  const future = db.select({ id: sessions.id }).from(sessions).where(gt(sessions.startsAt, now))
  const cancelled = await db
    .update(bookings)
    .set({ status: "cancelled", cancelledAt: now })
    .where(and(eq(bookings.userId, userId), isLive, inArray(bookings.sessionId, future)))
    .returning({ sessionId: bookings.sessionId })
  const affected = [...new Set(cancelled.map((b) => b.sessionId))].sort()
  await lockSessions(db, affected.filter((id) => !lockedSessionIds.includes(id)))
  for (const sessionId of affected) await promoteWaitlist(db, sessionId, now)
  return cancelled.length
}
