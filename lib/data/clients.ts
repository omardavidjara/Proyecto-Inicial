import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm"
import type { PgUpdateSetSource } from "drizzle-orm/pg-core"

import { memberships, plans, profiles } from "@/db/schema"
import { addDays, toDateKey } from "@/lib/dates"
import type { ProfileStatus } from "@/lib/roles"

import { cancelFutureBookingsOf, lockFutureSessionsOf } from "./bookings"
import type { Db } from "./db"
import { assignPlan, endMembershipsFrom, isActivePlan } from "./memberships"

// Altas y bajas de clientes (SPEC F1). Solo administración: quien llama (lib/dal.ts) ya ha comprobado el rol.
// Cada cambio de estado exige el estado de partida en el WHERE: si no encaja (otra persona ya lo cambió, o no es
// un cliente), no toca nada y devuelve false. Los perfiles eliminados (anonimizados) nunca se reactivan.

const clientColumns = {
  userId: profiles.userId,
  fullName: profiles.fullName,
  phone: profiles.phone,
  status: profiles.status,
  createdAt: profiles.createdAt,
  approvedAt: profiles.approvedAt,
  deactivatedAt: profiles.deactivatedAt,
  planName: plans.name,
} as const

export type ClientRow = {
  userId: string
  fullName: string
  phone: string | null
  status: ProfileStatus
  createdAt: Date
  approvedAt: Date | null
  deactivatedAt: Date | null
  /** Tarifa vigente hoy, si tiene */
  planName: string | null
}

export const CLIENT_PAGE_SIZE = 50
export const CLIENT_MAX_LIMIT = 500

export type ClientListOptions = {
  /** Parte del nombre, sin distinguir mayúsculas (índice trigram de `full_name`). Vacía = todos */
  query?: string
  limit?: number
}

const isListedClient = and(eq(profiles.role, "client"), isNull(profiles.deletedAt))

function nameFilter(query = "") {
  const q = query.trim()
  if (!q) return undefined
  return ilike(profiles.fullName, `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
}

/** Clientes por estado. Pendientes: el más antiguo primero (cola de altas); el resto, el más reciente primero */
export async function listClients(
  db: Db,
  status: ProfileStatus,
  { query, limit = CLIENT_PAGE_SIZE }: ClientListOptions = {},
  today = toDateKey(new Date()),
): Promise<ClientRow[]> {
  return db
    .select(clientColumns)
    .from(profiles)
    .leftJoin(
      memberships,
      and(
        eq(memberships.userId, profiles.userId),
        lte(memberships.startsOn, today),
        or(isNull(memberships.endsOn), gte(memberships.endsOn, today)),
      ),
    )
    .leftJoin(plans, eq(plans.id, memberships.planId))
    .where(and(isListedClient, eq(profiles.status, status), nameFilter(query)))
    .orderBy(status === "pending" ? asc(profiles.createdAt) : desc(profiles.createdAt), asc(profiles.userId))
    .limit(Math.min(Math.max(limit, 1), CLIENT_MAX_LIMIT))
}

/** Cuántos clientes hay en cada estado (con la misma búsqueda que la lista), para las pestañas */
export async function countClientsByStatus(db: Db, query?: string): Promise<Record<ProfileStatus, number>> {
  const rows = await db
    .select({ status: profiles.status, n: count() })
    .from(profiles)
    .where(and(isListedClient, nameFilter(query)))
    .groupBy(profiles.status)
  const counts: Record<ProfileStatus, number> = { pending: 0, active: 0, inactive: 0 }
  for (const row of rows) counts[row.status] = row.n
  return counts
}

/** Altas pendientes de aprobar ("Hoy" del administrador) */
export async function countPendingClients(db: Db) {
  const [row] = await db
    .select({ n: count() })
    .from(profiles)
    .where(and(eq(profiles.role, "client"), eq(profiles.status, "pending"), isNull(profiles.deletedAt)))
  return row?.n ?? 0
}

async function transition(db: Db, userId: string, from: ProfileStatus, set: PgUpdateSetSource<typeof profiles>) {
  const changed = await db
    .update(profiles)
    .set(set)
    .where(and(eq(profiles.userId, userId), eq(profiles.role, "client"), eq(profiles.status, from), isNull(profiles.deletedAt)))
    .returning({ userId: profiles.userId })
  return changed.length > 0
}

/**
 * Aprobar el alta: pendiente → activo y, si se elige, su tarifa desde hoy (opcional, SPEC F4). Todo o nada:
 * con una tarifa que ya no está activa no se aprueba. Transacción: necesita el Pool.
 */
export function approveClient(db: Db, userId: string, planId: string | null = null, today = toDateKey(new Date())) {
  return activate(db, userId, "pending", { status: "active", approvedAt: sql`now()`, deactivatedAt: null }, planId, today)
}

export type ActivateResult = "done" | "conflict" | "plan_not_found"

async function activate(
  db: Db,
  userId: string,
  from: ProfileStatus,
  set: PgUpdateSetSource<typeof profiles>,
  planId: string | null,
  today: string,
): Promise<ActivateResult> {
  return db.transaction(async (tx) => {
    if (planId && !(await isActivePlan(tx, planId))) return "plan_not_found"
    if (!(await transition(tx, userId, from, set))) return "conflict"
    if (planId) await assignPlan(tx, userId, planId, today)
    return "done"
  })
}

/** Rechazar el alta: pendiente → baja. No se borra, para no permitir registros repetidos sin control (SPEC F1) */
export function rejectClient(db: Db, userId: string) {
  return transition(db, userId, "pending", { status: "inactive", deactivatedAt: sql`now()` })
}

/** Reactivar: baja → activo (salvo cuentas eliminadas) y, si se elige, su tarifa desde hoy */
export function reactivateClient(db: Db, userId: string, planId: string | null = null, today = toDateKey(new Date())) {
  const set = { status: "active" as const, approvedAt: sql`coalesce(${profiles.approvedAt}, now())`, deactivatedAt: null }
  return activate(db, userId, "inactive", set, planId, today)
}

/**
 * Dar de baja: activo → baja, su tarifa termina hoy (las programadas se quitan) y se anulan sus reservas
 * futuras, sin descontar, promoviendo la lista de espera de esas sesiones (ARCHITECTURE §4). Todo o nada.
 */
export async function deactivateClient(db: Db, userId: string, today = toDateKey(new Date()), now = new Date()) {
  return db.transaction(async (tx) => {
    // Las sesiones antes que el perfil, como al reservar (lib/data/bookings.ts)
    const locked = await lockFutureSessionsOf(tx, userId, now)
    const changed = await transition(tx, userId, "active", { status: "inactive", deactivatedAt: sql`now()` })
    if (!changed) return false
    await endMembershipsFrom(tx, userId, addDays(today, 1))
    await cancelFutureBookingsOf(tx, userId, locked, now)
    return true
  })
}

export type ChangePlanResult = "saved" | "plan_not_found" | "not_found"

/** Cambiar o quitar (`planId` null) la tarifa de un cliente activo desde `startsOn` (hoy o más adelante) */
export async function changeClientPlan(db: Db, userId: string, planId: string | null, startsOn: string): Promise<ChangePlanResult> {
  return db.transaction(async (tx) => {
    // Bloquea el perfil: una baja a la vez no puede dejar una tarifa abierta
    const [client] = await tx
      .select({ userId: profiles.userId })
      .from(profiles)
      .where(and(eq(profiles.userId, userId), eq(profiles.role, "client"), eq(profiles.status, "active"), isNull(profiles.deletedAt)))
      .for("update")
    if (!client) return "not_found"
    return assignPlan(tx, userId, planId, startsOn)
  })
}
