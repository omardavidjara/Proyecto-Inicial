import { beforeEach, expect, test, vi } from 'vitest'

const USER = '0b4f2c1e-8a8e-4f7b-9a51-2f0f6d1c3a77'
const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  isRateLimited: vi.fn(),
  noteAttempt: vi.fn(),
  pathname: '',
}))
vi.mock('@/lib/dal', () => ({
  getViewer: async () => mocks.viewer,
  isRateLimited: mocks.isRateLimited,
  noteAttempt: mocks.noteAttempt,
}))
// handleUpload real no se llama (necesita Blob): se simula pasando por onBeforeGenerateToken como haría él
vi.mock('@vercel/blob/client', () => ({
  handleUpload: async ({ onBeforeGenerateToken }: { onBeforeGenerateToken: (p: string, c: null, m: boolean) => Promise<unknown> }) => ({
    type: 'blob.generate-client-token',
    options: await onBeforeGenerateToken(mocks.pathname, null, false),
  }),
}))

import { POST } from '../app/api/avatar/upload/route'

const request = (body: unknown) => new Request('http://localhost/api/avatar/upload', { method: 'POST', body: JSON.stringify(body) })
const tokenRequest = (pathname: string) => {
  mocks.pathname = pathname
  return request({ type: 'blob.generate-client-token', payload: { pathname, clientPayload: null, multipart: false } })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.viewer = { userId: USER, fullName: 'Ana', role: 'client', isCoach: false, status: 'pending' }
  mocks.isRateLimited.mockResolvedValue(false)
})

test('con sesión y en su carpeta: firma solo WebP/JPEG pequeños con nombre aleatorio', async () => {
  const response = await POST(tokenRequest(`avatars/${USER}/foto.webp`))
  expect(response.status).toBe(200)
  const { options } = await response.json()
  expect(options).toMatchObject({ allowedContentTypes: ['image/webp', 'image/jpeg'], maximumSizeInBytes: 300000, addRandomSuffix: true })
  expect(mocks.noteAttempt).toHaveBeenCalledWith('avatar', USER)
})

test('sin sesión: 401', async () => {
  mocks.viewer = null
  expect((await POST(tokenRequest(`avatars/${USER}/foto.webp`))).status).toBe(401)
})

test.each([`avatars/9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f/foto.webp`, 'otra/foto.webp', `avatars/${USER}/../x/foto.webp`])(
  'fuera de su carpeta (%s): 403',
  async (pathname) => {
    expect((await POST(tokenRequest(pathname))).status).toBe(403)
  },
)

test('demasiadas subidas seguidas: 429', async () => {
  mocks.isRateLimited.mockResolvedValue(true)
  expect((await POST(tokenRequest(`avatars/${USER}/foto.webp`))).status).toBe(429)
})

test('los avisos de "subida terminada" y los cuerpos raros no se aceptan', async () => {
  expect((await POST(request({ type: 'blob.upload-completed', payload: {} }))).status).toBe(400)
  expect((await POST(new Request('http://localhost/api/avatar/upload', { method: 'POST', body: 'no-json' }))).status).toBe(400)
})
