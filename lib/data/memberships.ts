import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm"

import { bookings, memberships, plans, sessions } from "@/db/schema"
import { addDays, GYM_TIME_ZONE, startOfWeek } from "@/lib/dates"
import type { PlanPeriod } from "@/lib/validation/plans"

import type { Db } from "./db"

// Tarifa asignada a cada cliente (SPEC F4, ARCHITECTURE §3). Las fechas son días (`YYYY-MM-DD`) en la zona del
// gimnasio. La base de datos impide dos tarifas solapadas para el mismo cliente (restricción de exclusión):
// asignar una nueva cierra antes la que cubre esa fecha y sustituye las programadas para después.

export type MembershipRow = {
  id: string
  planId: string
  planName: string
  period: PlanPeriod
  classesPerPeriod: number | null
  startsOn: string
  endsOn: string | null
}

const membershipColumns = {
  id: memberships.id,
  planId: memberships.planId,
  planName: plans.name,
  period: plans.period,
  classesPerPeriod: plans.classesPerPeriod,
  startsOn: memberships.startsOn,
  endsOn: memberships.endsOn,
} as const

/** La tarifa cubre ese día */
const covers = (day: string) =>
  and(lte(memberships.startsOn, day), or(isNull(memberships.endsOn), gte(memberships.endsOn, day)))

/** Tarifa vigente de un cliente en un día (como mucho una, por la restricción de exclusión) */
export async function getMembershipOn(db: Db, userId: string, day: string): Promise<MembershipRow | null> {
  const [row] = await db
    .select(membershipColumns)
    .from(memberships)
    .innerJoin(plans, eq(plans.id, memberships.planId))
    .where(and(eq(memberships.userId, userId), covers(day)))
    .limit(1)
  return (row as MembershipRow | undefined) ?? null
}

/** Historial de varios clientes (la más reciente primero), agrupado por cliente */
export async function listMemberships(db: Db, userIds: string[]): Promise<Map<string, MembershipRow[]>> {
  const byUser = new Map<string, MembershipRow[]>()
  if (userIds.length === 0) return byUser
  const rows = await db
    .select({ ...membershipColumns, userId: memberships.userId })
    .from(memberships)
    .innerJoin(plans, eq(plans.id, memberships.planId))
    .where(inArray(memberships.userId, userIds))
    .orderBy(asc(memberships.userId), desc(memberships.startsOn))
  for (const { userId, ...row } of rows) {
    const list = byUser.get(userId) ?? []
    list.push(row as MembershipRow)
    byUser.set(userId, list)
  }
  return byUser
}

/**
 * Deja al cliente sin tarifa desde `from` (incluido): borra las que empiezan ese día o después y cierra el día
 * anterior la que lo cubre. Sirve para cambiar de tarifa, quitarla o dar de baja. Va dentro de una transacción.
 */
export async function endMembershipsFrom(db: Db, userId: string, from: string) {
  await db.delete(memberships).where(and(eq(memberships.userId, userId), gte(memberships.startsOn, from)))
  await db
    .update(memberships)
    .set({ endsOn: addDays(from, -1) })
    .where(and(eq(memberships.userId, userId), lt(memberships.startsOn, from), or(isNull(memberships.endsOn), gte(memberships.endsOn, from))))
}

/** Solo las tarifas activas se pueden asignar */
export async function isActivePlan(db: Db, planId: string) {
  const [plan] = await db.select({ id: plans.id }).from(plans).where(and(eq(plans.id, planId), eq(plans.isActive, true)))
  return Boolean(plan)
}

export type AssignResult = "saved" | "plan_not_found"

/**
 * Asigna una tarifa activa desde `startsOn`, sin fecha de fin; `planId` null quita la tarifa desde ese día.
 * Quien llama comprueba que el cliente existe y usa una transacción.
 */
export async function assignPlan(db: Db, userId: string, planId: string | null, startsOn: string): Promise<AssignResult> {
  if (planId && !(await isActivePlan(db, planId))) return "plan_not_found"
  await endMembershipsFrom(db, userId, startsOn)
  if (planId) await db.insert(memberships).values({ userId, planId, startsOn })
  return "saved"
}

/** Primer y último día (excluido) del periodo que contiene `day`: semana de lunes a domingo o mes natural */
export function periodBounds(period: Exclude<PlanPeriod, "unlimited">, day: string): { from: string; to: string } {
  if (period === "week") {
    const from = startOfWeek(day)
    return { from, to: addDays(from, 7) }
  }
  const [year, month] = day.split("-").map(Number)
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`
  return { from: `${day.slice(0, 7)}-01`, to: next }
}

const tz = sql`coalesce((select timezone from gym_settings where id = 1), ${GYM_TIME_ZONE})`
const startOfDay = (day: string) => sql`(${day}::date::timestamp at time zone ${tz}::text)`

/**
 * Clases que gastan cupo en el periodo de `day` (ARCHITECTURE §3): reservas confirmadas, anulaciones tardías
 * que el administrador decidió descontar y faltas sin avisar, de sesiones que empiezan dentro del periodo.
 */
export async function countUsedClasses(db: Db, userId: string, period: Exclude<PlanPeriod, "unlimited">, day: string) {
  const { from, to } = periodBounds(period, day)
  const [row] = await db
    .select({ n: count() })
    .from(bookings)
    .innerJoin(sessions, eq(sessions.id, bookings.sessionId))
    .where(
      and(
        eq(bookings.userId, userId),
        gte(sessions.startsAt, startOfDay(from)),
        lt(sessions.startsAt, startOfDay(to)),
        or(
          eq(bookings.status, "confirmed"),
          and(eq(bookings.status, "late_cancelled"), eq(bookings.lateCancelCharged, true)),
          eq(bookings.attendance, "no_show"),
        ),
      ),
    )
  return row?.n ?? 0
}

export type PlanSummary = {
  /** Tarifa de hoy; `remaining` es null en las ilimitadas */
  current: { planName: string; period: PlanPeriod; classesPerPeriod: number | null; remaining: number | null } | null
  /** Cambio programado para más adelante, si lo hay */
  next: { planName: string; startsOn: string } | null
}

/** Lo que ve el cliente: su tarifa de hoy, cuántas clases le quedan en el periodo y el próximo cambio */
export async function getPlanSummary(db: Db, userId: string, today: string): Promise<PlanSummary> {
  const [current, [next]] = await Promise.all([
    getMembershipOn(db, userId, today),
    db
      .select({ planName: plans.name, startsOn: memberships.startsOn })
      .from(memberships)
      .innerJoin(plans, eq(plans.id, memberships.planId))
      .where(and(eq(memberships.userId, userId), gt(memberships.startsOn, today)))
      .orderBy(asc(memberships.startsOn))
      .limit(1),
  ])
  if (!current) return { current: null, next: next ?? null }
  const remaining =
    current.period === "unlimited" || current.classesPerPeriod == null
      ? null
      : Math.max(current.classesPerPeriod - (await countUsedClasses(db, userId, current.period, today)), 0)
  const { planName, period, classesPerPeriod } = current
  return { current: { planName, period, classesPerPeriod, remaining }, next: next ?? null }
}
