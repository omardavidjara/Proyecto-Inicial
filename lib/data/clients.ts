import { and, asc, count, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm"
import type { PgUpdateSetSource } from "drizzle-orm/pg-core"

import { bookings, profiles, sessions } from "@/db/schema"
import type { ProfileStatus } from "@/lib/roles"

import type { Db } from "./db"

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
} as const

export type ClientRow = {
  userId: string
  fullName: string
  phone: string | null
  status: ProfileStatus
  createdAt: Date
  approvedAt: Date | null
  deactivatedAt: Date | null
}

/** Clientes por estado. Pendientes: el más antiguo primero (cola de altas); el resto, el más reciente primero */
export async function listClients(db: Db, status: ProfileStatus, limit = 100): Promise<ClientRow[]> {
  return db
    .select(clientColumns)
    .from(profiles)
    .where(and(eq(profiles.role, "client"), eq(profiles.status, status), isNull(profiles.deletedAt)))
    .orderBy(status === "pending" ? asc(profiles.createdAt) : desc(profiles.createdAt), asc(profiles.userId))
    .limit(Math.min(Math.max(limit, 1), 200))
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

/** Aprobar el alta: pendiente → activo */
export function approveClient(db: Db, userId: string) {
  return transition(db, userId, "pending", { status: "active", approvedAt: sql`now()`, deactivatedAt: null })
}

/** Rechazar el alta: pendiente → baja. No se borra, para no permitir registros repetidos sin control (SPEC F1) */
export function rejectClient(db: Db, userId: string) {
  return transition(db, userId, "pending", { status: "inactive", deactivatedAt: sql`now()` })
}

/** Reactivar: baja → activo (salvo cuentas eliminadas) */
export function reactivateClient(db: Db, userId: string) {
  return transition(db, userId, "inactive", {
    status: "active",
    approvedAt: sql`coalesce(${profiles.approvedAt}, now())`,
    deactivatedAt: null,
  })
}

/**
 * Dar de baja: activo → baja y se anulan sus reservas futuras, sin descontar (ARCHITECTURE §4). Todo o nada.
 * Pendiente para F5: al liberar una plaza, promover la lista de espera de cada sesión afectada.
 */
export async function deactivateClient(db: Db, userId: string) {
  return db.transaction(async (tx) => {
    const changed = await transition(tx, userId, "active", { status: "inactive", deactivatedAt: sql`now()` })
    if (!changed) return false
    const future = tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(gt(sessions.startsAt, sql`now()`))
    await tx
      .update(bookings)
      .set({ status: "cancelled", cancelledAt: sql`now()` })
      .where(and(eq(bookings.userId, userId), inArray(bookings.status, ["confirmed", "waitlisted"]), inArray(bookings.sessionId, future)))
    return true
  })
}
