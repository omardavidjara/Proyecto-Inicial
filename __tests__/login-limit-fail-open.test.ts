import { beforeEach, expect, test, vi } from 'vitest'

// Si la base de datos falla, el límite deja pasar el intento (Neon Auth sigue comprobando la contraseña) y avisa a Sentry
const mocks = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException }))
vi.mock('@/lib/auth', () => ({ getAuth: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.1' }) }))
vi.mock('@/db', () => ({
  getDb: () => {
    throw new Error('Neon no responde')
  },
}))

import { isLoginRateLimited, noteLoginFailure, noteLoginSuccess } from '@/lib/dal'

beforeEach(() => {
  vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'secreto-de-prueba-de-al-menos-32-caracteres')
  mocks.captureException.mockClear()
})

test('sin base de datos, el límite no bloquea a nadie y avisa a Sentry', async () => {
  expect(await isLoginRateLimited('ana@example.test')).toBe(false)
  await expect(noteLoginFailure('ana@example.test')).resolves.toBeUndefined()
  await expect(noteLoginSuccess('ana@example.test')).resolves.toBeUndefined()
  expect(mocks.captureException).toHaveBeenCalledTimes(3)
})
