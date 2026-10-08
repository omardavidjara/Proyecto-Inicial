import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  isLoginRateLimited: vi.fn(),
  noteLoginFailure: vi.fn(),
  noteLoginSuccess: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
vi.mock('@/lib/auth', () => ({ getAuth: () => ({ signIn: { email: mocks.signInEmail } }) }))
vi.mock('@/lib/dal', () => ({
  isLoginRateLimited: mocks.isLoginRateLimited,
  noteLoginFailure: mocks.noteLoginFailure,
  noteLoginSuccess: mocks.noteLoginSuccess,
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { signInWithEmail } from '../app/(auth)/actions'

const form = (email: string, password: string) => {
  const data = new FormData()
  data.set('email', email)
  data.set('password', password)
  return data
}

describe('inicio de sesión con correo: límite de intentos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isLoginRateLimited.mockResolvedValue(false)
  })

  test('con demasiados intentos, ni siquiera llama a Neon Auth', async () => {
    mocks.isLoginRateLimited.mockResolvedValue(true)
    const state = await signInWithEmail({}, form('ana@example.test', 'clave'))
    expect(state.error).toMatch(/Demasiados intentos/)
    expect(mocks.signInEmail).not.toHaveBeenCalled()
    expect(mocks.noteLoginFailure).not.toHaveBeenCalled()
  })

  test('contraseña incorrecta: cuenta como fallo', async () => {
    mocks.signInEmail.mockResolvedValue({ error: { status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' } })
    const state = await signInWithEmail({}, form('Ana@Example.test', 'mala'))
    expect(state.error).toBe('Correo o contraseña incorrectos.')
    expect(mocks.noteLoginFailure).toHaveBeenCalledWith('ana@example.test')
  })

  test.each([
    ['correo sin confirmar', { status: 403, code: 'EMAIL_NOT_VERIFIED' }],
    ['límite de Neon Auth', { status: 429 }],
    ['error del servicio', { status: 502 }],
  ])('%s: no cuenta como fallo', async (_name, error) => {
    mocks.signInEmail.mockResolvedValue({ error })
    await signInWithEmail({}, form('ana@example.test', 'clave'))
    expect(mocks.noteLoginFailure).not.toHaveBeenCalled()
  })

  test('formulario inválido: no consulta el límite ni Neon Auth', async () => {
    await signInWithEmail({}, form('no-es-un-correo', ''))
    expect(mocks.isLoginRateLimited).not.toHaveBeenCalled()
    expect(mocks.signInEmail).not.toHaveBeenCalled()
  })

  test('entrar bien: borra los fallos del correo y redirige', async () => {
    mocks.signInEmail.mockResolvedValue({ error: null })
    await expect(signInWithEmail({}, form('ana@example.test', 'buena'))).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.noteLoginSuccess).toHaveBeenCalledWith('ana@example.test')
    expect(mocks.redirect).toHaveBeenCalledWith('/')
  })
})
