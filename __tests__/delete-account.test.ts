// @vitest-environment node
// "Eliminar mi cuenta" (F1): anonimización sobre PGlite y llamada a la API de Neon Auth.
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest'

import { bookings, classTypes, profiles, pushDevices, sessions } from '@/db/schema'
import { anonymizeAccount, DELETED_NAME } from '@/lib/data/account'
import { canDeleteAuthUsers, deleteAuthUser } from '@/lib/neon-admin'

import { createTestDb, type TestDb } from './helpers/test-db'

let db: TestDb
let close: () => Promise<void>
let classTypeId: string

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
  const [type] = await db.insert(classTypes).values({ name: 'Funcional', durationMinutes: 60, defaultCapacity: 10, color: 'orange' }).returning()
  classTypeId = type.id
}, 60_000)

afterAll(async () => {
  await close()
})

async function person(overrides: Partial<typeof profiles.$inferInsert> = {}) {
  const userId = randomUUID()
  await db.insert(profiles).values({ userId, fullName: 'Ana Prueba', phone: '600112233', avatarUrl: 'https://x/avatars/a/foto.webp', status: 'active', ...overrides })
  return userId
}
async function booking(userId: string, startsInHours: number) {
  const startsAt = new Date(Date.now() + startsInHours * 3_600_000)
  const [session] = await db.insert(sessions).values({ classTypeId, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000), capacity: 10 }).returning()
  const [row] = await db.insert(bookings).values({ sessionId: session.id, userId, createdBy: userId, status: 'confirmed' }).returning()
  return row.id
}
const statusOf = async (id: string) => (await db.select().from(bookings).where(eq(bookings.id, id)))[0].status

describe('anonimizar la cuenta', () => {
  test('borra los datos personales, anula reservas futuras y dispositivos; conserva el historial', async () => {
    const userId = await person()
    const other = await person()
    const future = await booking(userId, 48)
    const past = await booking(userId, -48)
    const othersFuture = await booking(other, 48)
    await db.insert(pushDevices).values({ userId, platform: 'web', token: `t-${userId}`, p256dh: 'p', auth: 'a' })

    expect(await anonymizeAccount(db, userId)).toEqual({ avatarUrl: 'https://x/avatars/a/foto.webp' })

    const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId))
    expect(row).toMatchObject({ fullName: DELETED_NAME, phone: null, avatarUrl: null, status: 'inactive' })
    expect(row.deletedAt).toBeInstanceOf(Date)
    expect(await statusOf(future)).toBe('cancelled')
    expect(await statusOf(past)).toBe('confirmed')
    expect(await statusOf(othersFuture)).toBe('confirmed')
    expect(await db.select().from(pushDevices).where(eq(pushDevices.userId, userId))).toHaveLength(0)
  })

  test('repetible: la segunda vez no toca nada y lo dice', async () => {
    const userId = await person()
    await anonymizeAccount(db, userId)
    expect(await anonymizeAccount(db, userId)).toBeUndefined()
  })
})

describe('borrar el acceso en Neon Auth', () => {
  const fetchMock = vi.fn()
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })
  const configure = () => {
    vi.stubEnv('NEON_API_KEY', 'napi_prueba')
    vi.stubEnv('NEON_PROJECT_ID', 'spring-rice-07538675')
    vi.stubEnv('NEON_AUTH_BRANCH_ID', 'br-cold-bar-b2uccmh0')
    vi.stubGlobal('fetch', fetchMock)
  }

  test('sin configurar (previews, tests) no se puede y no llama a nadie', async () => {
    vi.stubEnv('NEON_API_KEY', '')
    vi.stubGlobal('fetch', fetchMock)
    expect(canDeleteAuthUsers()).toBe(false)
    await expect(deleteAuthUser('u1')).rejects.toThrow(/no está configurado/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('llama a la rama de producción con la clave, y un usuario que ya no existe cuenta como borrado', async () => {
    configure()
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))
    await deleteAuthUser('0b4f2c1e-8a8e-4f7b-9a51-2f0f6d1c3a77')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://console.neon.tech/api/v2/projects/spring-rice-07538675/branches/br-cold-bar-b2uccmh0/auth/users/0b4f2c1e-8a8e-4f7b-9a51-2f0f6d1c3a77')
    expect(init).toMatchObject({ method: 'DELETE', headers: { Authorization: 'Bearer napi_prueba' } })
  })

  test('otro error de Neon: falla (sin mostrar la clave)', async () => {
    configure()
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))
    await expect(deleteAuthUser('u1')).rejects.toThrow('HTTP 500')
    await expect(deleteAuthUser('u1')).rejects.not.toThrow(/napi_/)
  })
})
