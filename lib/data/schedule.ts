import { and, asc, eq, gt, isNull, notExists, sql } from "drizzle-orm"

import { bookings, classTypes, profiles, scheduleSlots, sessions } from "@/db/schema"
import { addDays, GYM_TIME_ZONE, toDateKey } from "@/lib/dates"
import type { ClassColor } from "@/lib/sessions"
import type { ClassKind } from "@/lib/validation/class-types"
import type { ScheduleSlotInput } from "@/lib/validation/schedule"

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
  if (input.coachId) {
    const [coach] = await db
      .select({ userId: profiles.userId })
      .from(profiles)
      .where(and(eq(profiles.userId, input.coachId), eq(profiles.isCoach, true), eq(profiles.status, "active"), isNull(profiles.deletedAt)))
    if (!coach) return "invalid_coach" as const
  }
  return { ...input, capacity: type.kind === "individual" ? 1 : input.capacity }
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
  const tz = sql`coalesce((select timezone from gym_settings where id = 1), ${GYM_TIME_ZONE})`
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
