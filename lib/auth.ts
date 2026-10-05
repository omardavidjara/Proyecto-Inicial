// Neon Auth en el servidor (ARCHITECTURE §6). Solo servidor: guarda el secreto de las cookies.
import "server-only"

import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server"

let instance: NeonAuth | undefined

/** Se crea al primer uso: así `next build` no exige las variables si una página no las necesita. */
export function getAuth() {
  if (!instance) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL
    const secret = process.env.NEON_AUTH_COOKIE_SECRET
    if (!baseUrl || !secret) throw new Error("Faltan NEON_AUTH_BASE_URL o NEON_AUTH_COOKIE_SECRET (ver .env.example)")
    instance = createNeonAuth({
      baseUrl,
      cookies: { secret, sameSite: "lax" },
      logLevel: "warn",
    })
  }
  return instance
}
