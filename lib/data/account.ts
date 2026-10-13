import { and, eq, isNull, sql } from "drizzle-orm"

import { profiles, pushDevices } from "@/db/schema"

import { cancelFutureBookingsOf, lockFutureSessionsOf } from "./bookings"
import type { Db } from "./db"

// "Eliminar mi cuenta" (SPEC F1, ARCHITECTURE §2). El perfil no se borra: se anonimiza para conservar el
// historial de reservas sin datos personales. El acceso (usuario de Neon Auth) se borra aparte (lib/neon-admin.ts).

export const DELETED_NAME = "Usuario eliminado"

/**
 * Anonimiza el perfil, anula sus reservas futuras (sin descontar, promoviendo la lista de espera) y borra sus
 * dispositivos de notificaciones, todo o nada. Devuelve la foto que tenía (para borrar el archivo) o `undefined`
 * si ya estaba anonimizado.
 */
export async function anonymizeAccount(db: Db, userId: string, now = new Date()): Promise<{ avatarUrl: string | null } | undefined> {
  return db.transaction(async (tx) => {
    // Las sesiones antes que el perfil, como al reservar (lib/data/bookings.ts)
    const locked = await lockFutureSessionsOf(tx, userId, now)
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

    await cancelFutureBookingsOf(tx, userId, locked, now)

    await tx.delete(pushDevices).where(eq(pushDevices.userId, userId))
    return { avatarUrl: current.avatarUrl }
  })
}
