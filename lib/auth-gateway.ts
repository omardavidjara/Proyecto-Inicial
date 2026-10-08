// Qué deja pasar la pasarela /api/auth hacia Neon Auth (app/api/auth/[...path]/route.ts).
// Solo lo que usa el navegador. El resto (registro, cambiar correo o contraseña, borrar cuenta…) responde 404:
// esas acciones irán por Server Actions que validan con Zod y llaman a Neon Auth desde el servidor
// (lib/auth.ts), sin pasar por la pasarela. Al añadir una llamada de `authClient`, añadir aquí su ruta.

/** Rutas de Neon Auth (Better Auth) que puede pedir el navegador, por método */
export const ALLOWED_AUTH_PATHS = {
  GET: ["get-session"],
  // Botón "Continuar con Google" (login-form.tsx). El regreso lo completa proxy.ts contra Neon Auth.
  POST: ["sign-in/social"],
} as const satisfies Record<"GET" | "POST", readonly string[]>

export function isAllowedAuthPath(method: keyof typeof ALLOWED_AUTH_PATHS, path: readonly string[]) {
  return (ALLOWED_AUTH_PATHS[method] as readonly string[]).includes(path.join("/"))
}
