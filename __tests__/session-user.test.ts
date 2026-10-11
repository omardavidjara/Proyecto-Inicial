import { expect, test, vi } from 'vitest'

// Una sesión que ya no vale no debe romper /login (pantalla de error): cuenta como "sin sesión"
const mocks = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getAuth: () => ({ getSession: mocks.getSession }) }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn() }))
vi.mock('@/db', () => ({ getDb: vi.fn() }))

import { getSessionUser } from '@/lib/dal'

test('el SDK no puede borrar las cookies de una sesión caducada desde una página: sin sesión, sin error', async () => {
  mocks.getSession.mockImplementation(async () => {
    throw new Error('Cookies can only be modified in a Server Action or Route Handler.')
  })
  expect(await getSessionUser()).toBeNull()
})

test('una sesión válida sigue funcionando', async () => {
  const user = { id: '0b4f2c1e-8a8e-4f7b-9a51-2f0f6d1c3a77', name: 'Ana', email: 'ana@example.test' }
  mocks.getSession.mockImplementation(async () => ({ data: { user } }))
  expect(await getSessionUser()).toEqual(user)
})

test('las señales internas de Next no se tragan', async () => {
  const redirectSignal = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/login;307;' })
  mocks.getSession.mockImplementation(async () => {
    throw redirectSignal
  })
  let caught: unknown
  try {
    await getSessionUser()
  } catch (error) {
    caught = error
  }
  expect(caught).toBe(redirectSignal)
})
