import { beforeEach, describe, expect, test, vi } from 'vitest'

import { avatarFolder, blobStoreHost, isOwnAvatarUrl } from '@/lib/avatar'
import { centerSquare } from '@/lib/image-resize'

const USER = '0b4f2c1e-8a8e-4f7b-9a51-2f0f6d1c3a77'
const OTHER = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f'
const TOKEN = 'vercel_blob_rw_AbC123xyz_secreto'
const HOST = 'abc123xyz.public.blob.vercel-storage.com'

const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  setMyAvatar: vi.fn(),
  del: vi.fn(),
  captureException: vi.fn(),
  isRateLimited: vi.fn(),
  handleUpload: vi.fn(),
}))
vi.mock('@vercel/blob', () => ({ del: mocks.del }))
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException }))
vi.mock('@/lib/auth', () => ({ getAuth: () => ({ getSession: async () => ({ data: { user: { id: USER, name: 'Ana', email: 'ana@example.test' } } }) }) }))
vi.mock('@/lib/data/profiles', () => ({
  ensureProfile: async () => mocks.viewer,
  setMyAvatar: mocks.setMyAvatar,
  createSignUpProfile: vi.fn(),
  getMyProfile: vi.fn(),
  updateMyProfile: vi.fn(),
}))
vi.mock('@/db', () => ({ getDb: () => 'db', getTxDb: () => 'tx' }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: vi.fn((u: string) => { throw new Error(`NEXT_REDIRECT ${u}`) }), unstable_rethrow: vi.fn() }))

import { removeMyAvatar, saveMyAvatar } from '@/lib/dal'

describe('qué foto se acepta', () => {
  test('el dominio del almacén sale del token', () => {
    expect(blobStoreHost(TOKEN)).toBe(HOST)
    expect(blobStoreHost(undefined)).toBeNull()
    expect(blobStoreHost('otro-token')).toBeNull()
  })

  test('solo nuestro almacén, por https, en la carpeta del usuario y sin parámetros', () => {
    expect(isOwnAvatarUrl(`https://${HOST}/${avatarFolder(USER)}foto-x1y2.webp`, USER, TOKEN)).toBe(true)
    expect(isOwnAvatarUrl(`https://${HOST}/${avatarFolder(OTHER)}foto.webp`, USER, TOKEN)).toBe(false)
    expect(isOwnAvatarUrl(`https://otro.public.blob.vercel-storage.com/${avatarFolder(USER)}foto.webp`, USER, TOKEN)).toBe(false)
    expect(isOwnAvatarUrl(`http://${HOST}/${avatarFolder(USER)}foto.webp`, USER, TOKEN)).toBe(false)
    expect(isOwnAvatarUrl(`https://${HOST}/${avatarFolder(USER)}foto.webp?x=1`, USER, TOKEN)).toBe(false)
    expect(isOwnAvatarUrl('javascript:alert(1)', USER, TOKEN)).toBe(false)
    expect(isOwnAvatarUrl(42, USER, TOKEN)).toBe(false)
    expect(isOwnAvatarUrl(`https://${HOST}/${avatarFolder(USER)}foto.webp`, USER, undefined)).toBe(false)
  })

  test('recorte cuadrado centrado del lado menor', () => {
    expect(centerSquare(4000, 3000)).toEqual({ sx: 500, sy: 0, side: 3000 })
    expect(centerSquare(1080, 1920)).toEqual({ sx: 0, sy: 420, side: 1080 })
    expect(centerSquare(512, 512)).toEqual({ sx: 0, sy: 0, side: 512 })
  })
})

describe('guardar y quitar la foto (DAL)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', TOKEN)
    mocks.viewer = { userId: USER, fullName: 'Ana', role: 'client', isCoach: false, status: 'active' }
    mocks.del.mockResolvedValue(undefined)
  })

  test('una URL propia se guarda y la foto anterior se borra de Blob', async () => {
    const url = `https://${HOST}/${avatarFolder(USER)}nueva.webp`
    mocks.setMyAvatar.mockResolvedValue(`https://${HOST}/${avatarFolder(USER)}vieja.webp`)
    expect(await saveMyAvatar(url)).toBe(true)
    expect(mocks.setMyAvatar).toHaveBeenCalledWith('db', mocks.viewer, url)
    expect(mocks.del).toHaveBeenCalledWith(`https://${HOST}/${avatarFolder(USER)}vieja.webp`)
  })

  test('la URL de otra persona o de otro sitio ni se guarda', async () => {
    expect(await saveMyAvatar(`https://${HOST}/${avatarFolder(OTHER)}foto.webp`)).toBe(false)
    expect(await saveMyAvatar('https://evil.example/foto.webp')).toBe(false)
    expect(mocks.setMyAvatar).not.toHaveBeenCalled()
  })

  test('quitar la foto la borra; si Blob falla, se avisa a Sentry sin romper', async () => {
    mocks.setMyAvatar.mockResolvedValue(`https://${HOST}/${avatarFolder(USER)}foto.webp`)
    mocks.del.mockImplementation(async () => {
      throw new Error('Blob no responde')
    })
    await removeMyAvatar()
    expect(mocks.setMyAvatar).toHaveBeenCalledWith('db', mocks.viewer, null)
    expect(mocks.captureException).toHaveBeenCalled()
  })
})
