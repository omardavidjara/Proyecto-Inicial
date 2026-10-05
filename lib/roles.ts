// Reglas de acceso por rol y estado (docs/ARCHITECTURE.md §5 y §6). Funciones puras: sin sesión
// ni base de datos, para poder probarlas solas. Quien las aplica es lib/dal.ts.

export const ROLES = ["developer", "admin", "coach", "client"] as const
export type Role = (typeof ROLES)[number]

export const PROFILE_STATUSES = ["pending", "active", "inactive"] as const
export type ProfileStatus = (typeof PROFILE_STATUSES)[number]

/** Lo mínimo del perfil que deciden los permisos */
export type AccessProfile = {
  role: Role
  isCoach: boolean
  status: ProfileStatus
}

/** Zonas de la app con layout propio */
export type Area = "client" | "coach" | "admin"

export const LOGIN_PATH = "/login"
export const PENDING_PATH = "/pendiente"

/** Páginas que se abren sin sesión (ARCHITECTURE §5). El resto exige sesión (proxy.ts) */
export const PUBLIC_PATHS = [LOGIN_PATH, "/registro", "/privacidad", "/aviso-legal", "/offline"] as const

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

const AREA_HOME: Record<Area, string> = {
  client: "/inicio",
  coach: "/entrenador",
  admin: "/admin",
}

export function isStaff(profile: Pick<AccessProfile, "role">) {
  return profile.role === "admin" || profile.role === "developer"
}

/**
 * ¿Puede este perfil entrar en la zona?
 * - Cliente: los clientes y, como "vista cliente", administradores y desarrolladores.
 * - Entrenador: cualquier perfil con `is_coach` (también un admin que imparte clases).
 * - Administración: administradores y desarrolladores.
 * Un perfil pendiente o dado de baja no entra en ninguna (solo en /pendiente).
 */
export function canAccessArea(profile: AccessProfile, area: Area) {
  if (profile.status !== "active") return false
  switch (area) {
    case "client":
      return profile.role === "client" || isStaff(profile)
    case "coach":
      return profile.isCoach
    case "admin":
      return isStaff(profile)
  }
}

/** Adónde lleva "/" a cada usuario (ARCHITECTURE §5) */
export function homePathFor(profile: AccessProfile | null) {
  if (!profile) return LOGIN_PATH
  if (profile.status !== "active") return PENDING_PATH
  if (isStaff(profile)) return AREA_HOME.admin
  if (profile.role === "coach") return AREA_HOME.coach
  return AREA_HOME.client
}
