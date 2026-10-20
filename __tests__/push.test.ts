// @vitest-environment node
// Dispositivos y envío de avisos push (F10) sobre Postgres real (PGlite) con las migraciones.
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import { notifications, profiles, pushDevices } from '@/db/schema'
import { removePushDevice, savePushDevice, sendNotices, type Notice, type PushSender } from '@/lib/data/push'

import { createTestDb, type TestDb } from './helpers/test-db'

let db: TestDb
let close: () => Promise<void>

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
}, 60_000)

afterAll(async () => {
  await close()
})

async function user() {
  const userId = randomUUID()
  await db.insert(profiles).values({ userId, fullName: `Usuario ${userId.slice(0, 4)}`, status: 'active' })
  return userId
}

const subscription = (id = randomUUID()) => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
  keys: { p256dh: `p256-${id}`, auth: `auth-${id}` },
})

const devicesOf = (userId: string) => db.select().from(pushDevices).where(eq(pushDevices.userId, userId))
const message = { title: 'Hola', body: 'Aviso', url: '/calendario' }

describe('dispositivos', () => {
  test('guardar dos veces el mismo navegador no lo duplica y actualiza las claves', async () => {
    const userId = await user()
    const sub = subscription()
    await savePushDevice(db, userId, sub)
    await savePushDevice(db, userId, { ...sub, keys: { p256dh: 'nueva', auth: 'otra' } })
    const rows = await devicesOf(userId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ platform: 'web', token: sub.endpoint, p256dh: 'nueva', auth: 'otra' })
  })

  test('si otra cuenta entra en el mismo navegador, el dispositivo pasa a ser suyo', async () => {
    const [ana, luis] = [await user(), await user()]
    const sub = subscription()
    await savePushDevice(db, ana, sub)
    await savePushDevice(db, luis, sub)
    expect(await devicesOf(ana)).toHaveLength(0)
    expect(await devicesOf(luis)).toHaveLength(1)
  })

  test('nadie quita el dispositivo de otro usuario', async () => {
    const [ana, luis] = [await user(), await user()]
    const sub = subscription()
    await savePushDevice(db, ana, sub)
    await removePushDevice(db, luis, sub.endpoint)
    expect(await devicesOf(ana)).toHaveLength(1)
    await removePushDevice(db, ana, sub.endpoint)
    expect(await devicesOf(ana)).toHaveLength(0)
  })

  test('un dispositivo web exige sus claves de cifrado', async () => {
    const userId = await user()
    await expect(db.insert(pushDevices).values({ userId, platform: 'web', token: `t-${randomUUID()}` })).rejects.toThrow()
  })
})

describe('sendNotices', () => {
  const sender = (result: Awaited<ReturnType<PushSender>> = 'sent') => vi.fn<PushSender>(async () => result)

  test('envía a todos los dispositivos del usuario y solo una vez por aviso', async () => {
    const userId = await user()
    await savePushDevice(db, userId, subscription())
    await savePushDevice(db, userId, subscription())
    const send = sender()
    const notice: Notice = { userId, kind: 'account_approved', refId: null, message }

    expect(await sendNotices(db, send, [notice])).toBe(1)
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0][1]).toEqual(message)

    // Repetido (otra aprobación, un cron que corre dos veces): no se envía de nuevo
    expect(await sendNotices(db, send, [notice])).toBe(0)
    expect(send).toHaveBeenCalledTimes(2)
  })

  test('quien no tiene dispositivos no recibe nada ni gasta fila en el registro', async () => {
    const userId = await user()
    const send = sender()
    expect(await sendNotices(db, send, [{ userId, kind: 'account_approved', refId: null, message }])).toBe(0)
    expect(send).not.toHaveBeenCalled()
    expect(await db.select().from(notifications).where(eq(notifications.userId, userId))).toHaveLength(0)
  })

  test('cada aviso va solo a los dispositivos de su usuario', async () => {
    const [ana, luis] = [await user(), await user()]
    const anaSub = subscription()
    await savePushDevice(db, ana, anaSub)
    await savePushDevice(db, luis, subscription())
    const send = sender()
    await sendNotices(db, send, [{ userId: ana, kind: 'account_approved', refId: null, message }])
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toEqual({ token: anaSub.endpoint, ...anaSub.keys })
  })

  test('borra los dispositivos cuya suscripción ya no existe', async () => {
    const userId = await user()
    await savePushDevice(db, userId, subscription())
    await sendNotices(db, sender('gone'), [{ userId, kind: 'account_approved', refId: null, message }])
    expect(await devicesOf(userId)).toHaveLength(0)
  })

  test('un fallo de envío no borra el dispositivo', async () => {
    const userId = await user()
    await savePushDevice(db, userId, subscription())
    await sendNotices(db, sender('failed'), [{ userId, kind: 'account_approved', refId: null, message }])
    expect(await devicesOf(userId)).toHaveLength(1)
  })
})
