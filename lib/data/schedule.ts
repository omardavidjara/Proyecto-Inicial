import { and, asc, eq, gt, inArray, isNull, notExists, sql } from "drizzle-orm"

import { bookings, classTypes, profiles, scheduleSlots, sessions } from "@/db/schema"
import { addDays, GYM_TIME_ZONE, toDateKey } from "@/lib/dates"
import type { ClassColor } from "@/lib/sessions"
import type { ClassKind } from "@/lib/validation/class-types"
import type { OneOffSessionInput, ScheduleSlotInput, SessionInput } from "@/lib/validation/schedule"

import { promoteWaitlist } from "./bookings"
import type { Db } from "./db"

// Plantilla semanal y generación de sesiones (SPEC F3). Solo administración y el cron: quien llama (lib/dal.ts)
// ya ha comprobado el rol o CRON_SECRET.
//
// Una sesión "intacta" es una sesión futura de la plantilla, programada, sin cambios manuales y sin ninguna
// reserva. Al cambiar una franja, sus sesiones intactas se borran y se vuelven a generar con los datos nuevos;
// las demás (con reservas o cambios a mano) se quedan como están y se ajustan desde la agenda.

/** Semanas de antelación con que se generan las sesiones (SPEC F3) */
export const GENERATION_DAYS = 28

export type ScheduleSlotRow = {
  id: string
  classTypeId: string
  className: string
  kind: ClassKind
  color: ClassColor
  classTypeActive: boolean
  weekday: number
  startTime: string // HH:MM
  durationMinutes: number
  capacity: number
  coachId: string | null
  coachName: string | null
  isActive: boolean
}

export type CoachOption = { userId: string; fullName: string }

export type SaveResult = "saved" | "not_found" | "invalid_class_type" | "invalid_coach"
export type DeleteResult = "deleted" | "in_use" | "not_found"

// `on delete restrict` da restrict_violation; una FK `no action`, foreign_key_violation
const IN_USE = ["23001", "23503"]

function pgCode(error: unknown) {
  const e = error as { code?: string; cause?: { code?: string } }
  return e?.code ?? e?.cause?.code
}

/** Por día y hora; inactivas al final de su día */
export async function listScheduleSlots(db: Db): Promise<ScheduleSlotRow[]> {
  const rows = await db
    .select({
      id: scheduleSlots.id,
      classTypeId: scheduleSlots.classTypeId,
      className: classTypes.name,
      kind: classTypes.kind,
      color: classTypes.color,
      classTypeActive: classTypes.isActive,
      weekday: scheduleSlots.weekday,
      startTime: scheduleSlots.startTime,
      durationMinutes: scheduleSlots.durationMinutes,
      capacity: scheduleSlots.capacity,
      coachId: scheduleSlots.coachId,
      coachName: profiles.fullName,
      isActive: scheduleSlots.isActive,
    })
    .from(scheduleSlots)
    .innerJoin(classTypes, eq(classTypes.id, scheduleSlots.classTypeId))
    .leftJoin(profiles, eq(profiles.userId, scheduleSlots.coachId))
    .orderBy(asc(scheduleSlots.weekday), sql`${scheduleSlots.isActive} desc`, asc(scheduleSlots.startTime), asc(classTypes.name))
  return rows.map((row) => ({ ...row, startTime: row.startTime.slice(0, 5) })) as ScheduleSlotRow[]
}

/** Entrenadores que se pueden asignar: perfil de entrenador activo y no eliminado */
export function listCoaches(db: Db): Promise<CoachOption[]> {
  return db
    .select({ userId: profiles.userId, fullName: profiles.fullName })
    .from(profiles)
    .where(and(eq(profiles.isCoach, true), eq(profiles.status, "active"), isNull(profiles.deletedAt)))
    .orderBy(asc(profiles.fullName))
}

/**
 * Comprueba tipo y entrenador y fija el aforo de las individuales (1). Un tipo inactivo no se ofrece, salvo
 * que la franja ya lo tenga (`currentClassTypeId`): así se puede editar el resto sin cambiarlo.
 */
async function resolveInput(db: Db, input: ScheduleSlotInput, currentClassTypeId?: string) {
  const [type] = await db
    .select({ kind: classTypes.kind, isActive: classTypes.isActive })
    .from(classTypes)
    .where(eq(classTypes.id, input.classTypeId))
  if (!type || (!type.isActive && input.classTypeId !== currentClassTypeId)) return "invalid_class_type" as const
  if (!(await isAssignableCoach(db, input.coachId))) return "invalid_coach" as const
  return { ...input, capacity: type.kind === "individual" ? 1 : input.capacity }
}

/** Un entrenador de `listCoaches` por id (ya validado), o `null` */
export async function getCoach(db: Db, coachId: string): Promise<CoachOption | null> {
  const [coach] = await db
    .select({ userId: profiles.userId, fullName: profiles.fullName })
    .from(profiles)
    .where(and(eq(profiles.userId, coachId), eq(profiles.isCoach, true), eq(profiles.status, "active"), isNull(profiles.deletedAt)))
  return coach ?? null
}

/** Sin entrenador, o uno de `listCoaches` */
export async function isAssignableCoach(db: Db, coachId: string | null) {
  if (!coachId) return true
  const [coach] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(and(eq(profiles.userId, coachId), eq(profiles.isCoach, true), eq(profiles.status, "active"), isNull(profiles.deletedAt)))
  return Boolean(coach)
}

/** Crea la franja (vale desde hoy) y sus sesiones de las próximas semanas */
export async function createScheduleSlot(db: Db, input: ScheduleSlotInput, now = new Date()): Promise<SaveResult> {
  return db.transaction(async (tx) => {
    const values = await resolveInput(tx, input)
    if (typeof values === "string") return values
    const [slot] = await tx
      .insert(scheduleSlots)
      .values({ ...values, validFrom: toDateKey(now) })
      .returning({ id: scheduleSlots.id })
    await generateSessions(tx, now, slot.id)
    return "saved"
  })
}

/** Cambia la franja y rehace sus sesiones intactas */
export async function updateScheduleSlot(db: Db, id: string, input: ScheduleSlotInput, now = new Date()): Promise<SaveResult> {
  return db.transaction(async (tx) => {
    const [current] = await tx.select({ classTypeId: scheduleSlots.classTypeId }).from(scheduleSlots).where(eq(scheduleSlots.id, id))
    if (!current) return "not_found"
    const values = await resolveInput(tx, input, current.classTypeId)
    if (typeof values === "string") return values
    await tx.update(scheduleSlots).set(values).where(eq(scheduleSlots.id, id))
    await resyncSlot(tx, id, now)
    return "saved"
  })
}

/** Desactivar borra sus sesiones intactas; activar las vuelve a generar */
export async function setScheduleSlotActive(db: Db, id: string, isActive: boolean, now = new Date()) {
  return db.transaction(async (tx) => {
    const changed = await tx.update(scheduleSlots).set({ isActive }).where(eq(scheduleSlots.id, id)).returning({ id: scheduleSlots.id })
    if (changed.length === 0) return false
    await resyncSlot(tx, id, now)
    return true
  })
}

/**
 * Solo si no le queda ninguna sesión pasada, con reservas o cambiada a mano (la FK lo impide): entonces,
 * desactivarla. Sus sesiones intactas se borran con ella; si no se puede, no se toca nada.
 */
export async function deleteScheduleSlot(db: Db, id: string, now = new Date()): Promise<DeleteResult> {
  try {
    return await db.transaction(async (tx) => {
      await deleteUntouchedSessions(tx, id, now)
      const deleted = await tx.delete(scheduleSlots).where(eq(scheduleSlots.id, id)).returning({ id: scheduleSlots.id })
      return deleted.length > 0 ? "deleted" : "not_found"
    })
  } catch (error) {
    if (IN_USE.includes(pgCode(error) ?? "")) return "in_use"
    throw error
  }
}

/** Zona horaria del gimnasio (ajustes; por defecto, la de lib/dates) */
const tz = sql`coalesce((select timezone from gym_settings where id = 1), ${GYM_TIME_ZONE})`

async function resyncSlot(db: Db, slotId: string, now: Date) {
  await deleteUntouchedSessions(db, slotId, now)
  await generateSessions(db, now, slotId)
}

function deleteUntouchedSessions(db: Db, slotId: string, now: Date) {
  return db
    .delete(sessions)
    .where(
      and(
        eq(sessions.slotId, slotId),
        eq(sessions.isCustomized, false),
        eq(sessions.status, "scheduled"),
        gt(sessions.startsAt, now),
        notExists(db.select({ id: bookings.id }).from(bookings).where(eq(bookings.sessionId, sessions.id))),
      ),
    )
}

/**
 * Crea las sesiones de la plantilla desde hoy hasta dentro de GENERATION_DAYS días (de una franja o de todas).
 * Idempotente: el único `(slot_id, slot_date)` impide repetir una ocurrencia aunque se haya movido o cancelado.
 * La hora de la franja es hora local del gimnasio: Postgres la pasa a UTC con su zona (también en los cambios de
 * hora). No crea sesiones que ya han empezado. Devuelve cuántas ha creado.
 */
export async function generateSessions(db: Db, now = new Date(), slotId?: string): Promise<number> {
  const today = toDateKey(now)
  const startsAt = sql`((d.day::date + s.start_time) at time zone ${tz}::text)`
  const result = await db.execute(sql`
    insert into sessions (class_type_id, slot_id, slot_date, starts_at, ends_at, capacity, coach_id)
    select s.class_type_id, s.id, d.day::date, ${startsAt}, ${startsAt} + make_interval(mins => s.duration_minutes),
      s.capacity, s.coach_id
    from schedule_slots s
    cross join generate_series(${today}::date, ${addDays(today, GENERATION_DAYS - 1)}::date, interval '1 day') as d(day)
    where s.is_active
      and extract(isodow from d.day) - 1 = s.weekday
      and d.day::date >= s.valid_from
      and (s.valid_to is null or d.day::date <= s.valid_to)
      and ${startsAt} > ${now.toISOString()}::timestamptz
      ${slotId ? sql`and s.id = ${slotId}` : sql``}
    on conflict (slot_id, slot_date) do nothing
    returning id
  `)
  return (result as unknown as { rows: unknown[] }).rows.length
}

// ── Próximas sesiones (sueltas, mover, cambiar entrenador o aforo y cancelar) ────────────────────────────

export type SessionRow = {
  id: string
  classTypeId: string
  className: string
  kind: ClassKind
  color: ClassColor
  startsAt: Date
  endsAt: Date
  capacity: number
  coachId: string | null
  coachName: string | null
  status: "scheduled" | "cancelled"
  cancelReason: string | null
  isCustomized: boolean
  isOneOff: boolean
  /** Reservas confirmadas */
  booked: number
  waitlisted: number
}

export type SessionSaveResult = SaveResult | "not_editable" | "past" | "capacity_below_booked"
export type CancelSessionResult =
  | { result: "cancelled"; cancelledBookings: number }
  | { result: "not_found" | "not_editable" }

// Con el nombre de la tabla: sin join, Drizzle escribiría solo "id" y el subselect lo leería como bookings.id
const countBookings = (status: "confirmed" | "waitlisted") =>
  sql<number>`(select count(*)::int from bookings b where b.session_id = "sessions"."id" and b.status = ${status})`

/** Las que aún no han empezado (también las canceladas), por hora */
export async function listUpcomingSessions(db: Db, now = new Date()): Promise<SessionRow[]> {
  const rows = await db
    .select({
      id: sessions.id,
      classTypeId: sessions.classTypeId,
      className: classTypes.name,
      kind: classTypes.kind,
      color: classTypes.color,
      startsAt: sessions.startsAt,
      endsAt: sessions.endsAt,
      capacity: sessions.capacity,
      coachId: sessions.coachId,
      coachName: profiles.fullName,
      status: sessions.status,
      cancelReason: sessions.cancelReason,
      isCustomized: sessions.isCustomized,
      isOneOff: sql<boolean>`${sessions.slotId} is null`,
      booked: countBookings("confirmed"),
      waitlisted: countBookings("waitlisted"),
    })
    .from(sessions)
    .innerJoin(classTypes, eq(classTypes.id, sessions.classTypeId))
    .leftJoin(profiles, eq(profiles.userId, sessions.coachId))
    .where(gt(sessions.startsAt, now))
    .orderBy(asc(sessions.startsAt), asc(classTypes.name))
  return rows as SessionRow[]
}

/** Inicio y fin de una sesión a partir del día y la hora locales del gimnasio */
export async function sessionTimes(db: Db, input: Pick<SessionInput, "date" | "startTime" | "durationMinutes">) {
  const result = await db.execute(sql`select ((${input.date}::date + ${input.startTime}::time) at time zone ${tz}::text) as starts_at`)
  const startsAt = new Date((result as unknown as { rows: { starts_at: Date | string }[] }).rows[0].starts_at)
  return { startsAt, endsAt: new Date(startsAt.getTime() + input.durationMinutes * 60_000) }
}

/** Sesión suelta: sin franja de la plantilla */
export async function createOneOffSession(db: Db, input: OneOffSessionInput, now = new Date()): Promise<SessionSaveResult> {
  return db.transaction(async (tx) => {
    const [type] = await tx
      .select({ kind: classTypes.kind, isActive: classTypes.isActive })
      .from(classTypes)
      .where(eq(classTypes.id, input.classTypeId))
    if (!type?.isActive) return "invalid_class_type"
    if (!(await isAssignableCoach(tx, input.coachId))) return "invalid_coach"
    const times = await sessionTimes(tx, input)
    if (times.startsAt <= now) return "past"
    await tx.insert(sessions).values({
      classTypeId: input.classTypeId,
      ...times,
      capacity: type.kind === "individual" ? 1 : input.capacity,
      coachId: input.coachId,
    })
    return "saved"
  })
}

/**
 * Mover o cambiar entrenador o aforo de una sesión programada que aún no ha empezado. Queda marcada como
 * cambiada a mano (`is_customized`): los cambios de la plantilla ya no la tocan. El aforo no puede bajar de
 * las reservas confirmadas. Al subir el aforo se promueve la lista de espera (ARCHITECTURE §4).
 */
export async function updateSession(db: Db, id: string, input: SessionInput, now = new Date()): Promise<SessionSaveResult> {
  return db.transaction(async (tx) => {
    // Bloquea la sesión, como al reservar (ARCHITECTURE §4): el recuento de reservas no cambia mientras tanto
    const [current] = await tx
      .select({ status: sessions.status, startsAt: sessions.startsAt, endsAt: sessions.endsAt, capacity: sessions.capacity, coachId: sessions.coachId, kind: classTypes.kind })
      .from(sessions)
      .innerJoin(classTypes, eq(classTypes.id, sessions.classTypeId))
      .where(eq(sessions.id, id))
      .for("update", { of: sessions })
    if (!current) return "not_found"
    if (current.status !== "scheduled" || current.startsAt <= now) return "not_editable"
    // Se puede dejar el entrenador que ya tiene aunque ya no esté disponible
    if (input.coachId !== current.coachId && !(await isAssignableCoach(tx, input.coachId))) return "invalid_coach"
    const times = await sessionTimes(tx, input)
    if (times.startsAt <= now) return "past"
    const capacity = current.kind === "individual" ? 1 : input.capacity
    const booked = await tx.$count(bookings, and(eq(bookings.sessionId, id), eq(bookings.status, "confirmed")))
    if (capacity < booked) return "capacity_below_booked"

    const unchanged =
      times.startsAt.getTime() === current.startsAt.getTime() &&
      times.endsAt.getTime() === current.endsAt.getTime() &&
      capacity === current.capacity &&
      input.coachId === current.coachId
    // Guardar sin cambios no la aparta de la plantilla
    if (!unchanged) {
      await tx.update(sessions).set({ ...times, capacity, coachId: input.coachId, isCustomized: true }).where(eq(sessions.id, id))
      if (capacity > current.capacity) await promoteWaitlist(tx, id, now)
    }
    return "saved"
  })
}

/**
 * Cancela una sesión programada que aún no ha empezado y anula sus reservas vivas, sin descontarlas de la tarifa
 * (ARCHITECTURE §4). La ocurrencia de la plantilla no se vuelve a generar. Pendiente para F10: avisar por push.
 */
export async function cancelSession(db: Db, id: string, reason: string | null, now = new Date()): Promise<CancelSessionResult> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: sessions.status, startsAt: sessions.startsAt })
      .from(sessions)
      .where(eq(sessions.id, id))
      .for("update")
    if (!current) return { result: "not_found" }
    if (current.status !== "scheduled" || current.startsAt <= now) return { result: "not_editable" }
    await tx.update(sessions).set({ status: "cancelled", cancelReason: reason }).where(eq(sessions.id, id))
    const cancelled = await tx
      .update(bookings)
      .set({ status: "cancelled", cancelledAt: now })
      .where(and(eq(bookings.sessionId, id), inArray(bookings.status, ["confirmed", "waitlisted"])))
      .returning({ id: bookings.id })
    return { result: "cancelled", cancelledBookings: cancelled.length }
  })
}
