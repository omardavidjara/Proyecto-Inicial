import { profileSchema } from "@/lib/validation/auth"

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
/** Primera entrada: nombre y apellidos y teléfono obligatorios antes de seguir */
export const COMPLETE_PROFILE_PATH = "/completar-perfil"

/** Datos de contacto del perfil */
export type ContactProfile = { fullName: string; phone: string | null }

/** ¿Tiene nombre y apellidos y un teléfono válidos? (quien entra con Google no da teléfono) */
export function isProfileComplete(profile: ContactProfile) {
  return profileSchema.safeParse({ fullName: profile.fullName, phone: profile.phone ?? "" }).success
}

/**
 * ¿Debe completar sus datos antes de seguir? Todos menos las cuentas de baja, que solo ven /pendiente.
 * Vale también para las cuentas ya existentes a las que les falte algo.
 */
export function mustCompleteProfile(profile: Pick<AccessProfile, "status"> & ContactProfile) {
  return profile.status !== "inactive" && !isProfileComplete(profile)
}

/** Página donde se escribe el código que llega por correo (registro e inicio de sesión sin confirmar, F1) */
export const confirmEmailPath = (email: string) => `/confirmar-correo?correo=${encodeURIComponent(email)}`

/** Páginas que se abren sin sesión (ARCHITECTURE §5). El resto exige sesión (proxy.ts) */
export const PUBLIC_PATHS = [LOGIN_PATH, "/registro", "/confirmar-correo", "/privacidad", "/aviso-legal", "/offline", "/instalar"] as const

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
export function homePathFor(profile: (AccessProfile & Partial<ContactProfile>) | null) {
  if (!profile) return LOGIN_PATH
  // Sin datos de contacto (fullName/phone) no se comprueba: lo deciden los permisos solos
  if (profile.fullName !== undefined && profile.phone !== undefined && mustCompleteProfile({ status: profile.status, fullName: profile.fullName, phone: profile.phone })) {
    return COMPLETE_PROFILE_PATH
  }
  if (profile.status !== "active") return PENDING_PATH
  if (isStaff(profile)) return AREA_HOME.admin
  if (profile.role === "coach") return AREA_HOME.coach
  return AREA_HOME.client
}
