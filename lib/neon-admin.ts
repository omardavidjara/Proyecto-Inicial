// Borrar el acceso de una cuenta en Neon Auth (SPEC F1: eliminar mi cuenta). Neon no permite activar el `delete-user`
// de Better Auth, así que se usa su API con una clave limitada al proyecto (decidido el 2026-10-11).
// Solo servidor: la clave nunca sale de aquí.
//
// Las variables existen solo en Production de Vercel (y en .env.local, que apunta a producción). Las previews usan
// una copia de la base de datos con los mismos ids: si pudieran borrar, borrarían usuarios reales.
import "server-only"

const API = "https://console.neon.tech/api/v2"

export function neonAdminConfig() {
  const apiKey = process.env.NEON_API_KEY
  const projectId = process.env.NEON_PROJECT_ID
  const branchId = process.env.NEON_AUTH_BRANCH_ID
  return apiKey && projectId && branchId ? { apiKey, projectId, branchId } : null
}

/** ¿Se puede eliminar una cuenta en este entorno? (no en previews ni sin configurar) */
export const canDeleteAuthUsers = () => neonAdminConfig() !== null

/** Borra el usuario de Neon Auth (sus sesiones incluidas). Si ya no existía, también cuenta como hecho */
export async function deleteAuthUser(userId: string) {
  const config = neonAdminConfig()
  if (!config) throw new Error("Eliminar cuentas no está configurado en este entorno (NEON_API_KEY, NEON_PROJECT_ID, NEON_AUTH_BRANCH_ID)")
  const url = `${API}/projects/${config.projectId}/branches/${config.branchId}/auth/users/${encodeURIComponent(userId)}`
  const response = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" } })
  if (response.ok || response.status === 404) return
  throw new Error(`Neon Auth no ha borrado el usuario (HTTP ${response.status})`)
}
