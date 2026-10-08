import { and, gt, inArray, lt, sql } from "drizzle-orm"

import { loginAttempts } from "@/db/schema"

import type { Db } from "./db"

// Límite de intentos de inicio de sesión (auditoría, punto 2). Neon Auth no ve la IP de quien entra (el SDK
// no la reenvía desde el servidor), así que su propio límite no distingue personas: este sí.
// Las claves llegan ya cifradas (lib/login-limit.ts): aquí no hay correos ni IP.

export const LOGIN_LIMIT = {
  windowMinutes: 15,
  /** Fallos por correo en la ventana: frena a quien prueba contraseñas contra una cuenta */
  perEmail: 5,
  /** Fallos por IP: frena a quien prueba muchas cuentas. Holgado por el Wi-Fi compartido del gimnasio */
  perIp: 20,
  /** Las filas se borran pasado este tiempo (/privacidad §4) */
  retentionHours: 24,
} as const

export type LoginLimitKeys = { email: string; ip: string }

const windowStart = sql`now() - make_interval(mins => ${LOGIN_LIMIT.windowMinutes})`

/** ¿Hay que rechazar el intento sin llamar a Neon Auth? */
export async function isLoginBlocked(db: Db, keys: LoginLimitKeys) {
  const rows = await db
    .select({ key: loginAttempts.key, failures: loginAttempts.failures })
    .from(loginAttempts)
    .where(and(inArray(loginAttempts.key, [keys.email, keys.ip]), gt(loginAttempts.windowStartedAt, windowStart)))
  const failures = (key: string) => rows.find((row) => row.key === key)?.failures ?? 0
  return failures(keys.email) >= LOGIN_LIMIT.perEmail || failures(keys.ip) >= LOGIN_LIMIT.perIp
}

/** Suma un fallo al correo y a la IP. Si su ventana ya pasó, empieza una nueva. Borra las filas caducadas. */
export async function recordLoginFailure(db: Db, keys: LoginLimitKeys) {
  const expired = sql`${loginAttempts.windowStartedAt} <= ${windowStart}`
  await db
    .insert(loginAttempts)
    .values([{ key: keys.email, failures: 1 }, { key: keys.ip, failures: 1 }])
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: {
        failures: sql`case when ${expired} then 1 else ${loginAttempts.failures} + 1 end`,
        windowStartedAt: sql`case when ${expired} then now() else ${loginAttempts.windowStartedAt} end`,
      },
    })
  await db
    .delete(loginAttempts)
    .where(lt(loginAttempts.windowStartedAt, sql`now() - make_interval(hours => ${LOGIN_LIMIT.retentionHours})`))
}

/** Tras entrar bien, el correo vuelve a empezar de cero (la IP no: puede estar probando otras cuentas) */
export async function clearLoginFailures(db: Db, keys: LoginLimitKeys) {
  await db.delete(loginAttempts).where(inArray(loginAttempts.key, [keys.email]))
}
