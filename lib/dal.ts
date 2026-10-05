// Capa de acceso a datos (ARCHITECTURE §6): la que de verdad protege. Verifica la sesión de Neon Auth,
// carga el perfil y aplica rol y estado. Las páginas, layouts y Server Actions llaman a estas funciones;
// nunca leen la base de datos ni la sesión por su cuenta.
import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { getDb } from "@/db"
import { getAuth } from "@/lib/auth"
import { listMyBookings } from "@/lib/data/bookings"
import { ensureProfile, type Viewer } from "@/lib/data/profiles"
import { canAccessArea, homePathFor, LOGIN_PATH, PENDING_PATH, type Area } from "@/lib/roles"
import { sessionUserSchema, type SessionUser } from "@/lib/validation/auth"

/** Usuario de la sesión verificada, o `null`. Una sola comprobación por render (`cache`). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Marca la página como dinámica antes de llamar al SDK, que capturaría esa señal de Next y la
  // registraría como error durante el build
  await cookies()
  const { data } = await getAuth().getSession()
  const parsed = sessionUserSchema.safeParse(data?.user)
  return parsed.success ? parsed.data : null
})

/** Perfil de quien consulta (se crea en su primer inicio de sesión), o `null` sin sesión. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getSessionUser()
  if (!user) return null
  return ensureProfile(getDb(), user)
})

/** Exige sesión; sin ella, a /login. Admite perfiles pendientes o de baja (para /pendiente). */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer) redirect(LOGIN_PATH)
  return viewer
}

/**
 * Exige sesión, perfil activo y permiso para la zona. Si falta algo, lleva a donde corresponde:
 * sin sesión → /login; pendiente o de baja → /pendiente; otra zona → su inicio.
 */
export async function requireArea(area: Area): Promise<Viewer> {
  const viewer = await requireViewer()
  if (viewer.status !== "active") redirect(PENDING_PATH)
  if (!canAccessArea(viewer, area)) redirect(homePathFor(viewer))
  return viewer
}

/** Mis reservas (solo las del usuario de la sesión) */
export async function getMyBookings() {
  const viewer = await requireArea("client")
  return listMyBookings(getDb(), viewer)
}
