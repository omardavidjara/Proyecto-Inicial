// Claves del límite de intentos (lib/data/login-attempts.ts): HMAC-SHA256 del correo y de la IP, para no
// guardar ninguno de los dos. Sin la clave secreta no se puede saber a quién corresponde una fila.
import { createHmac } from "node:crypto"

import type { LoginLimitKeys } from "@/lib/data/login-attempts"

const hmac = (secret: string, value: string) => createHmac("sha256", secret).update(value).digest("hex")

export function loginLimitKeys(email: string, ip: string, secret: string): LoginLimitKeys {
  return {
    email: hmac(secret, `login-email:${email.trim().toLowerCase()}`),
    ip: hmac(secret, `login-ip:${ip}`),
  }
}

/**
 * IP de quien hace la petición. En Vercel, `x-forwarded-for` la pone el propio Vercel (sustituye la que mande
 * el navegador), así que el primer valor es fiable. En local puede no estar: todos comparten "unknown".
 */
export function clientIp(headers: Pick<Headers, "get">) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown"
}
