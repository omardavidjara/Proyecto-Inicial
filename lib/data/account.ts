import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm"

import { bookings, profiles, pushDevices, sessions } from "@/db/schema"

import type { Db } from "./db"

// "Eliminar mi cuenta" (SPEC F1, ARCHITECTURE §2). El perfil no se borra: se anonimiza para conservar el
// historial de reservas sin datos personales. El acceso (usuario de Neon Auth) se borra aparte (lib/neon-admin.ts).

export const DELETED_NAME = "Usuario eliminado"

/**
 * Anonimiza el perfil, anula sus reservas futuras (sin descontar) y borra sus dispositivos de notificaciones, todo
 * o nada. Devuelve la foto que tenía (para borrar el archivo) o `undefined` si ya estaba anonimizado.
 * Pendiente para F5: promover la lista de espera de las sesiones afectadas.
 */
export async function anonymizeAccount(db: Db, userId: string): Promise<{ avatarUrl: string | null } | undefined> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ avatarUrl: profiles.avatarUrl })
      .from(profiles)
      .where(and(eq(profiles.userId, userId), isNull(profiles.deletedAt)))
      .for("update")
    if (!current) return undefined

    await tx
      .update(profiles)
      .set({
        fullName: DELETED_NAME,
        phone: null,
        avatarUrl: null,
        status: "inactive",
        deactivatedAt: sql`coalesce(${profiles.deactivatedAt}, now())`,
        deletedAt: sql`now()`,
      })
      .where(eq(profiles.userId, userId))

    const future = tx.select({ id: sessions.id }).from(sessions).where(gt(sessions.startsAt, sql`now()`))
    await tx
      .update(bookings)
      .set({ status: "cancelled", cancelledAt: sql`now()` })
      .where(and(eq(bookings.userId, userId), inArray(bookings.status, ["confirmed", "waitlisted"]), inArray(bookings.sessionId, future)))

    await tx.delete(pushDevices).where(eq(pushDevices.userId, userId))
    return { avatarUrl: current.avatarUrl }
  })
}
