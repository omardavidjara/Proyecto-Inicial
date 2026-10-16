import { and, asc, eq, ilike, isNull } from "drizzle-orm"
import { z } from "zod"

import { bookings, classTypes, profiles, sessions } from "@/db/schema"
import type { IndividualSessionInput } from "@/lib/validation/schedule"

import { checkMember, getBookingSettings, type MemberCheck } from "./bookings"
import type { Db } from "./db"
import { isAssignableCoach, sessionTimes } from "./schedule"

// Sesión individual del entrenador (SPEC F7): la crea con él mismo como entrenador y apunta a un cliente.
// Se salta la ventana de reserva (y el aforo es 1), pero gasta una clase de la tarifa: la reserva confirmada
// cuenta en `countUsedClasses`, y si no le quedan clases no se crea. Solo se llama desde la DAL tras
// `requireArea("coach")`, con `coachId` de la sesión verificada.

export type IndividualClassType = { id: string; name: string; durationMinutes: number }

/** Tipos individuales activos, por nombre */
export function listIndividualClassTypes(db: Db): Promise<IndividualClassType[]> {
  return db
    .select({ id: classTypes.id, name: classTypes.name, durationMinutes: classTypes.durationMinutes })
    .from(classTypes)
    .where(and(eq(classTypes.kind, "individual"), eq(classTypes.isActive, true)))
    .orderBy(asc(classTypes.name), asc(classTypes.id))
}

const CLIENT_SEARCH_LIMIT = 10
const searchSchema = z.string().trim().min(2).max(60)

/** Clientes activos cuyo nombre contiene `query` (sin distinguir mayúsculas; índice trigram) */
export async function searchActiveClients(db: Db, query: unknown) {
  const q = searchSchema.safeParse(query)
  if (!q.success) return []
  const pattern = `%${q.data.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  return db
    .select({ userId: profiles.userId, fullName: profiles.fullName })
    .from(profiles)
    .where(and(eq(profiles.role, "client"), eq(profiles.status, "active"), isNull(profiles.deletedAt), ilike(profiles.fullName, pattern)))
    .orderBy(asc(profiles.fullName), asc(profiles.userId))
    .limit(CLIENT_SEARCH_LIMIT)
}

export type IndividualSessionResult =
  | { status: "created"; sessionId: string }
  | { status: "invalid_class_type" | "invalid_coach" | "past" | "client_not_active" | Exclude<MemberCheck, "ok" | "not_active"> }

/** Crea la sesión (aforo 1, sin franja) y la reserva confirmada del cliente, en una transacción */
export async function createIndividualSession(
  db: Db,
  coachId: string,
  input: IndividualSessionInput,
  now = new Date(),
): Promise<IndividualSessionResult> {
  const settings = await getBookingSettings(db)
  return db.transaction(async (tx) => {
    const [type] = await tx
      .select({ durationMinutes: classTypes.durationMinutes })
      .from(classTypes)
      .where(and(eq(classTypes.id, input.classTypeId), eq(classTypes.kind, "individual"), eq(classTypes.isActive, true)))
    if (!type) return { status: "invalid_class_type" as const }
    if (!(await isAssignableCoach(tx, coachId))) return { status: "invalid_coach" as const }
    const times = await sessionTimes(tx, { ...input, durationMinutes: type.durationMinutes })
    if (times.startsAt <= now) return { status: "past" as const }
    const [client] = await tx
      .select({ userId: profiles.userId })
      .from(profiles)
      .where(and(eq(profiles.userId, input.clientId), eq(profiles.role, "client")))
    if (!client) return { status: "client_not_active" as const }
    const member = await checkMember(tx, client.userId, times.startsAt, settings.timeZone)
    if (member === "not_active") return { status: "client_not_active" as const }
    if (member !== "ok") return { status: member }
    const [session] = await tx
      .insert(sessions)
      .values({ classTypeId: input.classTypeId, ...times, capacity: 1, coachId })
      .returning({ id: sessions.id })
    await tx.insert(bookings).values({ sessionId: session.id, userId: client.userId, createdBy: coachId, status: "confirmed" })
    return { status: "created" as const, sessionId: session.id }
  })
}
