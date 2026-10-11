import { beforeEach, describe, expect, test, vi } from 'vitest'

const USER = '0b4f2c1e-8a8e-4f7b-9a51-2f0f6d1c3a77'
const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  configured: true,
  anonymizeAccount: vi.fn(),
  deleteAuthUser: vi.fn(),
  del: vi.fn(),
  signOut: vi.fn(),
  captureException: vi.fn(),
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
vi.mock('@/lib/data/account', () => ({ anonymizeAccount: mocks.anonymizeAccount }))
vi.mock('@/lib/neon-admin', () => ({ canDeleteAuthUsers: () => mocks.configured, deleteAuthUser: mocks.deleteAuthUser }))
vi.mock('@vercel/blob', () => ({ del: mocks.del }))
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException }))
vi.mock('@/db', () => ({ getDb: () => 'http-db', getTxDb: () => 'tx-db' }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, unstable_rethrow: vi.fn() }))
vi.mock('next/cache', () => ({ refresh: vi.fn() }))

import { deleteAccount } from '../app/(cuenta)/perfil/actions'

const confirm = (value: string) => {
  const data = new FormData()
  data.set('confirmation', value)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.configured = true
  mocks.viewer = { userId: USER, fullName: 'Ana', role: 'client', isCoach: false, status: 'active' }
  mocks.anonymizeAccount.mockResolvedValue({ avatarUrl: 'https://x/avatars/a/foto.webp' })
  mocks.deleteAuthUser.mockResolvedValue(undefined)
  mocks.del.mockResolvedValue(undefined)
  mocks.signOut.mockResolvedValue({})
})

describe('eliminar mi cuenta', () => {
  test.each(['', 'BORRAR', 'eliminar mi cuenta'])('sin escribir ELIMINAR ("%s") no toca nada', async (value) => {
    const state = await deleteAccount({}, confirm(value))
    expect(state.error).toMatch(/Escribe ELIMINAR/)
    expect(mocks.anonymizeAccount).not.toHaveBeenCalled()
  })

  test('confirmado (da igual mayúsculas o espacios): anonimiza, borra la foto y el acceso, cierra sesión y avisa', async () => {
    await expect(deleteAccount({}, confirm('  eliminar '))).rejects.toThrow('NEXT_REDIRECT /login?cuenta=eliminada')
    expect(mocks.anonymizeAccount).toHaveBeenCalledWith('tx-db', USER)
    expect(mocks.del).toHaveBeenCalledWith('https://x/avatars/a/foto.webp')
    expect(mocks.deleteAuthUser).toHaveBeenCalledWith(USER)
    expect(mocks.signOut).toHaveBeenCalled()
  })

  test('un administrador o entrenador también puede', async () => {
    mocks.viewer = { userId: USER, fullName: 'Ana', role: 'coach', isCoach: true, status: 'active' }
    await expect(deleteAccount({}, confirm('ELIMINAR'))).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.deleteAuthUser).toHaveBeenCalled()
  })

  test('el desarrollador no puede eliminarse desde la app', async () => {
    mocks.viewer = { userId: USER, fullName: 'Dev', role: 'developer', isCoach: false, status: 'active' }
    const state = await deleteAccount({}, confirm('ELIMINAR'))
    expect(state.error).toMatch(/desarrollador/)
    expect(mocks.anonymizeAccount).not.toHaveBeenCalled()
  })

  test('sin configurar (previews): no borra nada', async () => {
    mocks.configured = false
    const state = await deleteAccount({}, confirm('ELIMINAR'))
    expect(state.error).toMatch(/no está disponible/)
    expect(mocks.anonymizeAccount).not.toHaveBeenCalled()
  })

  test('si Neon Auth falla: los datos ya están anonimizados, se avisa a Sentry y se puede reintentar', async () => {
    mocks.deleteAuthUser.mockImplementation(async () => {
      throw new Error('Neon Auth no ha borrado el usuario (HTTP 500)')
    })
    const state = await deleteAccount({}, confirm('ELIMINAR'))
    expect(state.error).toMatch(/Vuelve a intentarlo/)
    expect(mocks.anonymizeAccount).toHaveBeenCalled()
    expect(mocks.captureException).toHaveBeenCalled()
    expect(mocks.signOut).not.toHaveBeenCalled()
  })
})
