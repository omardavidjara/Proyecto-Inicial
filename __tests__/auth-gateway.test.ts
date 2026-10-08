import { beforeEach, describe, expect, test, vi } from 'vitest'
import { isAllowedAuthPath } from '@/lib/auth-gateway'

const upstream = vi.hoisted(() => ({
  GET: vi.fn(async () => new Response('get', { status: 200 })),
  POST: vi.fn(async () => new Response('post', { status: 200 })),
}))
vi.mock('@/lib/auth', () => ({ getAuth: () => ({ handler: () => upstream }) }))

const context = (path: string) => ({ params: Promise.resolve({ path: path.split('/') }) })
const request = (method: string, path: string) => new Request(`http://localhost/api/auth/${path}`, { method })

describe('pasarela /api/auth: solo lo que usa el navegador', () => {
  test('deja pasar el inicio con Google y la consulta de sesión', () => {
    expect(isAllowedAuthPath('POST', ['sign-in', 'social'])).toBe(true)
    expect(isAllowedAuthPath('GET', ['get-session'])).toBe(true)
  })

  test.each([
    ['POST', 'sign-up/email'],
    ['POST', 'sign-in/email'],
    ['POST', 'delete-user'],
    ['POST', 'change-email'],
    ['POST', 'change-password'],
    ['POST', 'update-user'],
    ['POST', 'request-password-reset'],
    ['GET', 'list-sessions'],
    ['GET', 'sign-in/social'],
    ['POST', 'get-session'],
    ['POST', 'sign-in/social/../../sign-up/email'],
  ] as const)('bloquea %s %s', (method, path) => {
    expect(isAllowedAuthPath(method, path.split('/'))).toBe(false)
  })
})

describe('route.ts', () => {
  beforeEach(() => {
    upstream.GET.mockClear()
    upstream.POST.mockClear()
  })

  test('una ruta no permitida responde 404 sin llegar a Neon Auth', async () => {
    const { POST } = await import('../app/api/auth/[...path]/route')
    const response = await POST(request('POST', 'sign-up/email'), context('sign-up/email'))
    expect(response.status).toBe(404)
    expect(upstream.POST).not.toHaveBeenCalled()
  })

  test('una ruta permitida llega a Neon Auth', async () => {
    const { GET, POST } = await import('../app/api/auth/[...path]/route')
    expect((await POST(request('POST', 'sign-in/social'), context('sign-in/social'))).status).toBe(200)
    expect((await GET(request('GET', 'get-session'), context('get-session'))).status).toBe(200)
    expect(upstream.POST).toHaveBeenCalledOnce()
    expect(upstream.GET).toHaveBeenCalledOnce()
  })
})
