import { eq } from "drizzle-orm"

import { profiles } from "@/db/schema"
import type { SessionUser } from "@/lib/validation/auth"

import type { Db } from "./db"

/** Columnas del perfil que necesita la app para decidir permisos y mostrar el nombre */
const viewerColumns = {
  userId: profiles.userId,
  fullName: profiles.fullName,
  role: profiles.role,
  isCoach: profiles.isCoach,
  status: profiles.status,
} as const

export type Viewer = {
  userId: string
  fullName: string
  role: (typeof profiles.$inferSelect)["role"]
  isCoach: boolean
  status: (typeof profiles.$inferSelect)["status"]
}

/** Nombre inicial del perfil: el de la cuenta o, si no hay, la parte local del correo */
export function initialFullName(user: SessionUser) {
  const name = user.name?.trim()
  return name ? name : user.email.split("@")[0]
}

/**
 * Perfil del usuario de la sesión. Si es su primer inicio de sesión, lo crea como cliente pendiente
 * (ARCHITECTURE §2). Idempotente: dos peticiones simultáneas no crean dos perfiles.
 */
export async function ensureProfile(db: Db, user: SessionUser): Promise<Viewer> {
  const [existing] = await db.select(viewerColumns).from(profiles).where(eq(profiles.userId, user.id))
  if (existing) return existing

  await db
    .insert(profiles)
    .values({ userId: user.id, fullName: initialFullName(user) })
    .onConflictDoNothing({ target: profiles.userId })
  const [created] = await db.select(viewerColumns).from(profiles).where(eq(profiles.userId, user.id))
  return created
}
