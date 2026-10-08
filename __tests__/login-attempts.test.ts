// @vitest-environment node
// Límite de intentos de inicio de sesión sobre Postgres real (PGlite) con las migraciones.
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { loginAttempts } from '@/db/schema'
import { clearLoginFailures, isLoginBlocked, LOGIN_LIMIT, recordLoginFailure } from '@/lib/data/login-attempts'
import { clientIp, loginLimitKeys } from '@/lib/login-limit'

import { createTestDb, type TestDb } from './helpers/test-db'

let db: TestDb
let close: () => Promise<void>

const SECRET = 'secreto-de-prueba-de-al-menos-32-caracteres'
const ana = loginLimitKeys('ana@example.test', '203.0.113.1', SECRET)
const sameIpOtherEmail = (n: number) => loginLimitKeys(`otra${n}@example.test`, '203.0.113.1', SECRET)

const fail = async (keys = ana, times = 1) => {
  for (let i = 0; i < times; i++) await recordLoginFailure(db, keys)
}
const ageWindow = (key: string, interval: string) =>
  db.update(loginAttempts).set({ windowStartedAt: sql`now() - ${interval}::interval` }).where(eq(loginAttempts.key, key))

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
}, 60_000)

beforeEach(async () => {
  await db.delete(loginAttempts)
})

afterAll(async () => {
  await close()
})

describe('límite por correo', () => {
  test(`bloquea a partir de ${LOGIN_LIMIT.perEmail} fallos en la ventana`, async () => {
    await fail(ana, LOGIN_LIMIT.perEmail - 1)
    expect(await isLoginBlocked(db, ana)).toBe(false)
    await fail(ana)
    expect(await isLoginBlocked(db, ana)).toBe(true)
  })

  test('otro correo desde otra IP no se ve afectado', async () => {
    await fail(ana, LOGIN_LIMIT.perEmail)
    expect(await isLoginBlocked(db, loginLimitKeys('bruno@example.test', '198.51.100.7', SECRET))).toBe(false)
  })

  test('pasada la ventana, vuelve a dejar entrar y el siguiente fallo empieza de cero', async () => {
    await fail(ana, LOGIN_LIMIT.perEmail)
    await ageWindow(ana.email, `${LOGIN_LIMIT.windowMinutes + 1} minutes`)
    expect(await isLoginBlocked(db, ana)).toBe(false)

    await fail(ana)
    const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, ana.email))
    expect(row.failures).toBe(1)
  })

  test('entrar bien borra los fallos del correo, no los de la IP', async () => {
    await fail(ana, LOGIN_LIMIT.perEmail)
    await clearLoginFailures(db, ana)
    expect(await isLoginBlocked(db, ana)).toBe(false)
    const [ipRow] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, ana.ip))
    expect(ipRow.failures).toBe(LOGIN_LIMIT.perEmail)
  })
})

describe('límite por IP', () => {
  test(`bloquea la IP tras ${LOGIN_LIMIT.perIp} fallos aunque sean de correos distintos`, async () => {
    for (let n = 0; n < LOGIN_LIMIT.perIp; n++) await fail(sameIpOtherEmail(n))
    // Correo sin fallos, pero desde la misma IP
    expect(await isLoginBlocked(db, ana)).toBe(true)
  })
})

describe('privacidad', () => {
  test('no se guarda ni el correo ni la IP', async () => {
    await fail(ana)
    const stored = JSON.stringify(await db.select().from(loginAttempts))
    expect(stored).not.toContain('ana@example.test')
    expect(stored).not.toContain('203.0.113.1')
  })

  test(`las filas de más de ${LOGIN_LIMIT.retentionHours} h se borran`, async () => {
    const old = loginLimitKeys('vieja@example.test', '192.0.2.9', SECRET)
    await fail(old)
    await ageWindow(old.email, `${LOGIN_LIMIT.retentionHours + 1} hours`)
    await ageWindow(old.ip, `${LOGIN_LIMIT.retentionHours + 1} hours`)
    await fail(ana)
    const keys = (await db.select({ key: loginAttempts.key }).from(loginAttempts)).map((r) => r.key)
    expect(keys).not.toContain(old.email)
    expect(keys).not.toContain(old.ip)
    expect(keys).toEqual(expect.arrayContaining([ana.email, ana.ip]))
  })
})

describe('claves e IP', () => {
  test('el correo se normaliza: mayúsculas y espacios cuentan como el mismo', () => {
    expect(loginLimitKeys(' Ana@Example.TEST ', '203.0.113.1', SECRET).email).toBe(ana.email)
  })

  test('correo e IP nunca comparten clave, y cambian con el secreto', () => {
    expect(loginLimitKeys('x', 'x', SECRET).email).not.toBe(loginLimitKeys('x', 'x', SECRET).ip)
    expect(loginLimitKeys('ana@example.test', '203.0.113.1', 'otro-secreto-de-al-menos-32-caracteres').email).not.toBe(ana.email)
  })

  test.each([
    [{ 'x-forwarded-for': '203.0.113.1, 10.0.0.1' }, '203.0.113.1'],
    [{ 'x-real-ip': '198.51.100.7' }, '198.51.100.7'],
    [{}, 'unknown'],
  ])('IP de %o → %s', (headers, ip) => {
    expect(clientIp(new Headers(headers))).toBe(ip)
  })
})
