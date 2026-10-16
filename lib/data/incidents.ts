import { and, asc, count, desc, eq, ilike, isNull, sql, type SQL } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { z } from "zod"

import { bookings, classTypes, incidents, profiles, sessions } from "@/db/schema"
import {
  INCIDENT_MAX_LIMIT,
  INCIDENT_PAGE_SIZE,
  type IncidentInput,
  type IncidentStatus,
  type NewIncidentInput,
} from "@/lib/validation/incidents"

import type { Db } from "./db"

// Incidencias (SPEC F9). Quien llama (lib/dal.ts) ya ha comprobado el rol. `createdBy` limita a las que abrió
// esa persona (el entrenador solo ve las suyas): una ajena es inexistente.

const CLIENT_INCIDENTS_LIMIT = 20
const CLIENT_SEARCH_LIMIT = 10

const client = alias(profiles, "incident_client")
const author = alias(profiles, "incident_author")

const incidentColumns = {
  id: incidents.id,
  title: incidents.title,
  description: incidents.description,
  priority: incidents.priority,
  status: incidents.status,
  createdAt: incidents.createdAt,
  updatedAt: incidents.updatedAt,
  closedAt: incidents.closedAt,
  clientId: incidents.userId,
  clientName: client.fullName,
  sessionId: incidents.sessionId,
  sessionStartsAt: sessions.startsAt,
  sessionClassName: classTypes.name,
  createdById: incidents.createdBy,
  createdByName: author.fullName,
} as const

export type IncidentRow = {
  id: string
  title: string
  description: string
  priority: "low" | "medium" | "high"
  status: IncidentStatus
  createdAt: Date
  updatedAt: Date
  closedAt: Date | null
  clientId: string | null
  clientName: string | null
  sessionId: string | null
  sessionStartsAt: Date | null
  sessionClassName: string | null
  createdById: string
  createdByName: string
}

export type IncidentScope = { createdBy?: string }

function selectIncidents(db: Db) {
  return db
    .select(incidentColumns)
    .from(incidents)
    .innerJoin(author, eq(author.userId, incidents.createdBy))
    .leftJoin(client, eq(client.userId, incidents.userId))
    .leftJoin(sessions, eq(sessions.id, incidents.sessionId))
    .leftJoin(classTypes, eq(classTypes.id, sessions.classTypeId))
}

const scopeFilter = ({ createdBy }: IncidentScope): SQL | undefined => (createdBy ? eq(incidents.createdBy, createdBy) : undefined)

/** Incidencias en un estado, la más reciente primero (índice `(status, created_at desc)`) */
export async function listIncidents(
  db: Db,
  status: IncidentStatus,
  { limit = INCIDENT_PAGE_SIZE, ...scope }: IncidentScope & { limit?: number } = {},
): Promise<IncidentRow[]> {
  return selectIncidents(db)
    .where(and(eq(incidents.status, status), scopeFilter(scope)))
    .orderBy(desc(incidents.createdAt), asc(incidents.id))
    .limit(Math.min(Math.max(limit, 1), INCIDENT_MAX_LIMIT))
}

/** Cuántas hay en cada estado, para las pestañas */
export async function countIncidentsByStatus(db: Db, scope: IncidentScope = {}): Promise<Record<IncidentStatus, number>> {
  const rows = await db.select({ status: incidents.status, n: count() }).from(incidents).where(scopeFilter(scope)).groupBy(incidents.status)
  const counts: Record<IncidentStatus, number> = { open: 0, in_progress: 0, closed: 0 }
  for (const row of rows) counts[row.status] = row.n
  return counts
}

const idSchema = z.uuid()

/** Una incidencia, o `null` si el id no es válido, no existe o no entra en `scope` */
export async function getIncident(db: Db, id: unknown, scope: IncidentScope = {}): Promise<IncidentRow | null> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return null
  const [row] = await selectIncidents(db)
    .where(and(eq(incidents.id, parsed.data), scopeFilter(scope)))
    .limit(1)
  return row ?? null
}

/** Las incidencias de una sesión (su detalle), con el mismo orden que las del cliente */
export async function listSessionIncidents(db: Db, sessionId: string, scope: IncidentScope = {}): Promise<IncidentRow[]> {
  return selectIncidents(db)
    .where(and(eq(incidents.sessionId, sessionId), scopeFilter(scope)))
    .orderBy(sql`${incidents.status} = 'closed'`, desc(incidents.createdAt), asc(incidents.id))
    .limit(CLIENT_INCIDENTS_LIMIT)
}

/** Las incidencias de un cliente (ficha F8): las abiertas y en curso primero, después las más recientes */
export async function listClientIncidents(db: Db, userId: string): Promise<IncidentRow[]> {
  return selectIncidents(db)
    .where(eq(incidents.userId, userId))
    .orderBy(sql`${incidents.status} = 'closed'`, desc(incidents.createdAt), asc(incidents.id))
    .limit(CLIENT_INCIDENTS_LIMIT)
}

const searchSchema = z.string().trim().min(2).max(60)

/** Buscador del formulario: clientes por nombre, de cualquier estado (una baja también puede tener incidencias) */
export async function searchClientsForIncident(db: Db, query: unknown) {
  const q = searchSchema.safeParse(query)
  if (!q.success) return []
  const pattern = `%${q.data.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  return db
    .select({ userId: profiles.userId, fullName: profiles.fullName })
    .from(profiles)
    .where(and(eq(profiles.role, "client"), isNull(profiles.deletedAt), ilike(profiles.fullName, pattern)))
    .orderBy(asc(profiles.fullName), asc(profiles.userId))
    .limit(CLIENT_SEARCH_LIMIT)
}

export type CreateIncidentResult = { status: "created"; id: string } | { status: "client_not_found" | "session_not_found" }

/**
 * Crea la incidencia abierta. El cliente debe ser un cliente no eliminado; la sesión, existir. Con `coachId`
 * (entrenador, SPEC F9): la sesión debe ser suya y el cliente, alguien apuntado a esa sesión (con cualquier estado)
 */
export async function createIncident(
  db: Db,
  createdBy: string,
  input: NewIncidentInput,
  { coachId }: { coachId?: string } = {},
): Promise<CreateIncidentResult> {
  if (coachId) {
    if (input.sessionId) {
      const [own] = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(and(eq(sessions.id, input.sessionId), eq(sessions.coachId, coachId)))
      if (!own) return { status: "session_not_found" }
    }
    if (input.clientId) {
      if (!input.sessionId) return { status: "client_not_found" }
      const [booked] = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.sessionId, input.sessionId), eq(bookings.userId, input.clientId)))
        .limit(1)
      if (!booked) return { status: "client_not_found" }
    }
  }
  if (input.clientId) {
    const [found] = await db
      .select({ userId: profiles.userId })
      .from(profiles)
      .where(and(eq(profiles.userId, input.clientId), eq(profiles.role, "client"), isNull(profiles.deletedAt)))
    if (!found) return { status: "client_not_found" }
  }
  if (input.sessionId) {
    const [found] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, input.sessionId))
    if (!found) return { status: "session_not_found" }
  }
  const [row] = await db
    .insert(incidents)
    .values({
      title: input.title,
      description: input.description,
      priority: input.priority,
      userId: input.clientId,
      sessionId: input.sessionId,
      createdBy,
    })
    .returning({ id: incidents.id })
  return { status: "created", id: row.id }
}

/** Editar título, descripción y prioridad. `false` si no existe */
export async function updateIncident(db: Db, id: unknown, input: IncidentInput): Promise<boolean> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return false
  const changed = await db
    .update(incidents)
    .set({ title: input.title, description: input.description, priority: input.priority })
    .where(eq(incidents.id, parsed.data))
    .returning({ id: incidents.id })
  return changed.length > 0
}

/** Cambiar de estado. Al cerrar se guarda la fecha (`closed_at`); al reabrir o pasar a «en curso», se borra */
export async function setIncidentStatus(db: Db, id: unknown, status: IncidentStatus): Promise<boolean> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return false
  const changed = await db
    .update(incidents)
    .set({ status, closedAt: status === "closed" ? sql`coalesce(${incidents.closedAt}, now())` : null })
    .where(eq(incidents.id, parsed.data))
    .returning({ id: incidents.id })
  return changed.length > 0
}
