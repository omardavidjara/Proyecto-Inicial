// Avisos generales en la DAL (F10): quién puede publicar, eliminar y leer, y envío del push al publicar.
import { beforeEach, describe, expect, test, vi } from 'vitest'

const USER = '0b4f2c1e-8a8e-4f7b-9a51-2f0f6d1c3a77'
const COACH = '5d1c6a8e-2b9f-4c1d-8e3a-7f6b5a4c3d21'
const ANNOUNCEMENT = '7e2d1f30-4c5b-4a69-8f10-1a2b3c4d5e6f'
const input = { title: 'Cerrado el lunes', body: 'Festivo' }
const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  createAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
  listAnnouncements: vi.fn(),
  listAnnouncementRecipients: vi.fn(),
  markAnnouncementsSeen: vi.fn(),
  sendNotices: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))
vi.mock('@/lib/auth', () => ({
  getAuth: () => ({ getSession: async () => ({ data: { user: { id: USER, name: 'Ana', email: 'ana@example.test' } } }) }),
}))
vi.mock('@/lib/data/profiles', () => ({ ensureProfile: async () => mocks.viewer, createSignUpProfile: vi.fn(), getMyProfile: vi.fn(), updateMyProfile: vi.fn(), setMyAvatar: vi.fn() }))
vi.mock('@/lib/data/announcements', () => ({
  createAnnouncement: mocks.createAnnouncement,
  deleteAnnouncement: mocks.deleteAnnouncement,
  listAnnouncements: mocks.listAnnouncements,
  listAnnouncementRecipients: mocks.listAnnouncementRecipients,
  markAnnouncementsSeen: mocks.markAnnouncementsSeen,
}))
vi.mock('@/lib/data/push', () => ({ sendNotices: mocks.sendNotices }))
vi.mock('@/lib/push', () => ({ pushPublicKey: () => 'clave-publica', webPushSender: 'sender' }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/db', () => ({ getDb: () => 'http-db', getTxDb: () => 'tx-db' }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, unstable_rethrow: vi.fn() }))
vi.mock('next/server', () => ({ after: (callback: () => unknown) => callback() }))

import { deleteAnnouncement, listAnnouncements, markAnnouncementsSeen, publishAnnouncement } from '@/lib/dal'

const viewer = (role: string, overrides: object = {}) => ({
  userId: USER,
  fullName: 'Ana Prueba',
  role,
  isCoach: role === 'coach',
  status: 'active',
  phone: '600112233',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.viewer = viewer('admin')
  mocks.createAnnouncement.mockResolvedValue({ id: ANNOUNCEMENT, ...input, publishedAt: new Date() })
  mocks.deleteAnnouncement.mockResolvedValue(true)
  mocks.listAnnouncements.mockResolvedValue({ items: [], nextCursor: null })
  mocks.listAnnouncementRecipients.mockResolvedValue([
    { userId: USER, role: 'admin' },
    { userId: COACH, role: 'coach' },
  ])
  mocks.sendNotices.mockResolvedValue(2)
})

describe('publicar', () => {
  test('administración publica con su usuario y se envía a cada destinatario, con su pantalla', async () => {
    await publishAnnouncement(input)
    expect(mocks.createAnnouncement).toHaveBeenCalledWith('http-db', USER, input)
    const [, , notices] = mocks.sendNotices.mock.calls[0]
    expect(notices).toEqual([
      { userId: USER, kind: 'announcement', refId: ANNOUNCEMENT, message: { ...input, url: '/avisos' } },
      { userId: COACH, kind: 'announcement', refId: ANNOUNCEMENT, message: { ...input, url: '/entrenador/avisos' } },
    ])
  })

  test.each(['client', 'coach'])('%s no puede publicar', async (role) => {
    mocks.viewer = viewer(role)
    await expect(publishAnnouncement(input)).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.createAnnouncement).not.toHaveBeenCalled()
    expect(mocks.sendNotices).not.toHaveBeenCalled()
  })
})

describe('eliminar', () => {
  test.each(['client', 'coach'])('%s no puede eliminar', async (role) => {
    mocks.viewer = viewer(role)
    await expect(deleteAnnouncement(ANNOUNCEMENT)).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.deleteAnnouncement).not.toHaveBeenCalled()
  })

  test('un id que no es válido no llega a la base de datos', async () => {
    expect(await deleteAnnouncement('no-es-un-id')).toBe(false)
    expect(mocks.deleteAnnouncement).not.toHaveBeenCalled()
  })
})

describe('leer', () => {
  test.each(['client', 'coach', 'admin', 'developer'])('%s con cuenta activa puede leer', async (role) => {
    mocks.viewer = viewer(role)
    await expect(listAnnouncements()).resolves.toEqual({ items: [], nextCursor: null })
  })

  test.each(['pending', 'inactive'])('una cuenta %s va a /pendiente', async (status) => {
    mocks.viewer = viewer('client', { status })
    await expect(listAnnouncements()).rejects.toThrow('NEXT_REDIRECT /pendiente')
    expect(mocks.listAnnouncements).not.toHaveBeenCalled()
  })

  test('marcar como leídos usa el usuario de la sesión', async () => {
    await markAnnouncementsSeen()
    expect(mocks.markAnnouncementsSeen).toHaveBeenCalledWith('http-db', USER)
  })
})
