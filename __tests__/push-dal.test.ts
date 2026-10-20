// Avisos push en la DAL (F10): alta aprobada → aviso, alta/baja de dispositivos con el usuario de la sesión
// y quitar el dispositivo al cerrar sesión.
import { beforeEach, describe, expect, test, vi } from 'vitest'

const USER = '0b4f2c1e-8a8e-4f7b-9a51-2f0f6d1c3a77'
const CLIENT = '5d1c6a8e-2b9f-4c1d-8e3a-7f6b5a4c3d21'
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc'
const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  publicKey: 'clave-publica' as string | null,
  approveClient: vi.fn(),
  savePushDevice: vi.fn(),
  removePushDevice: vi.fn(),
  sendNotices: vi.fn(),
  signOut: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))
vi.mock('@/lib/auth', () => ({
  getAuth: () => ({
    getSession: async () => ({ data: { user: { id: USER, name: 'Ana', email: 'ana@example.test' } } }),
    signOut: mocks.signOut,
  }),
}))
vi.mock('@/lib/data/profiles', () => ({ ensureProfile: async () => mocks.viewer, createSignUpProfile: vi.fn(), getMyProfile: vi.fn(), updateMyProfile: vi.fn(), setMyAvatar: vi.fn() }))
vi.mock('@/lib/data/clients', async (importOriginal) => ({ ...(await importOriginal<object>()), approveClient: mocks.approveClient }))
vi.mock('@/lib/data/push', () => ({ savePushDevice: mocks.savePushDevice, removePushDevice: mocks.removePushDevice, sendNotices: mocks.sendNotices }))
vi.mock('@/lib/push', () => ({ pushPublicKey: () => mocks.publicKey, webPushSender: 'sender' }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/db', () => ({ getDb: () => 'http-db', getTxDb: () => 'tx-db' }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, unstable_rethrow: vi.fn() }))
vi.mock('next/server', () => ({ after: (callback: () => unknown) => callback() }))

import { signOut } from '../app/(auth)/actions'
import { decideClient, saveMyPushDevice } from '@/lib/dal'

const subscription = { endpoint: ENDPOINT, keys: { p256dh: 'BNc', auth: 'k9' } }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.publicKey = 'clave-publica'
  mocks.viewer = { userId: USER, fullName: 'Ana Prueba', role: 'admin', isCoach: false, status: 'active', phone: '600112233' }
  mocks.sendNotices.mockResolvedValue(1)
  mocks.signOut.mockResolvedValue({})
})

describe('alta aprobada', () => {
  test('al aprobar se envía el aviso al cliente', async () => {
    mocks.approveClient.mockResolvedValue('done')
    expect(await decideClient('approve', CLIENT)).toBe('done')
    expect(mocks.sendNotices).toHaveBeenCalledWith('http-db', 'sender', [
      expect.objectContaining({ userId: CLIENT, kind: 'account_approved', refId: null, message: expect.objectContaining({ url: '/calendario' }) }),
    ])
  })

  test('si no se aprueba (otra persona ya lo cambió) no hay aviso', async () => {
    mocks.approveClient.mockResolvedValue('conflict')
    await decideClient('approve', CLIENT)
    expect(mocks.sendNotices).not.toHaveBeenCalled()
  })

  test('sin claves VAPID en este entorno no se intenta enviar', async () => {
    mocks.publicKey = null
    mocks.approveClient.mockResolvedValue('done')
    await decideClient('approve', CLIENT)
    expect(mocks.sendNotices).not.toHaveBeenCalled()
  })
})

describe('dispositivos', () => {
  test('se guardan con el usuario de la sesión, también si la cuenta está pendiente', async () => {
    mocks.viewer = { userId: USER, fullName: 'Ana', role: 'client', isCoach: false, status: 'pending', phone: null }
    expect(await saveMyPushDevice(subscription)).toBe(true)
    expect(mocks.savePushDevice).toHaveBeenCalledWith('http-db', USER, subscription)
  })

  test('una dirección que no es de un servicio de push se rechaza sin guardar', async () => {
    expect(await saveMyPushDevice({ ...subscription, endpoint: 'https://169.254.169.254/latest' })).toBe(false)
    expect(mocks.savePushDevice).not.toHaveBeenCalled()
  })

  test('al cerrar sesión se quita el dispositivo de este navegador', async () => {
    const form = new FormData()
    form.set('pushEndpoint', ENDPOINT)
    await expect(signOut(form)).rejects.toThrow('NEXT_REDIRECT /login')
    expect(mocks.removePushDevice).toHaveBeenCalledWith('http-db', USER, ENDPOINT)
    expect(mocks.signOut).toHaveBeenCalled()
  })

  test('cerrar sesión sin avisos activados no toca los dispositivos', async () => {
    await expect(signOut(new FormData())).rejects.toThrow('NEXT_REDIRECT /login')
    expect(mocks.removePushDevice).not.toHaveBeenCalled()
  })
})
