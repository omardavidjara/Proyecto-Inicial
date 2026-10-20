import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  signUpEmail: vi.fn(),
  verifyEmail: vi.fn(),
  sendVerificationOtp: vi.fn(),
  isRateLimited: vi.fn(),
  noteAttempt: vi.fn(),
  saveSignUpProfile: vi.fn(),
  captureException: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))
vi.mock('@/lib/auth', () => ({
  getAuth: () => ({
    signUp: { email: mocks.signUpEmail },
    emailOtp: { verifyEmail: mocks.verifyEmail, sendVerificationOtp: mocks.sendVerificationOtp },
  }),
}))
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { social: vi.fn() } } }))
vi.mock('@/lib/dal', () => ({
  isLoginRateLimited: vi.fn(),
  noteLoginFailure: vi.fn(),
  noteLoginSuccess: vi.fn(),
  isRateLimited: mocks.isRateLimited,
  noteAttempt: mocks.noteAttempt,
  saveSignUpProfile: mocks.saveSignUpProfile,
}))
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException, captureMessage: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { resendEmailCode, signUpWithEmail, verifyEmailCode } from '../app/(auth)/actions'
import ConfirmEmailPage from '../app/(auth)/confirmar-correo/page'
import RegisterPage from '../app/(auth)/registro/page'

const USER_ID = '0b4f2c1e-8a8e-4f7b-9a51-2f0f6d1c3a77'
const CONFIRM = 'NEXT_REDIRECT /confirmar-correo?correo=ana%40example.test'
const valid = { fullName: 'Ana Prueba', email: 'Ana@Example.test', phone: '600 11 22 33', password: 'una-clave-larga', minAge: 'on' }
const form = (values: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.isRateLimited.mockResolvedValue(false)
  mocks.saveSignUpProfile.mockResolvedValue(undefined)
})

describe('formulario de registro', () => {
  test('pide nombre, correo, teléfono, contraseña y la edad mínima', () => {
    render(<RegisterPage />)
    for (const label of ['Nombre y apellidos', 'Correo electrónico', 'Teléfono', 'Contraseña']) {
      expect(screen.getByLabelText(label)).toBeDefined()
    }
    expect(screen.getByRole('checkbox', { name: /14 años o más/ })).toBeDefined()
  })

  test('la información de protección de datos se ve antes del botón de enviar (LOPDGDD art. 11)', () => {
    render(<RegisterPage />)
    const summary = screen.getByRole('heading', { name: /protección de datos/i })
    const submit = screen.getByRole('button', { name: 'Crear cuenta' })
    expect(summary.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('ofrece también Google y enlaza el inicio de sesión', () => {
    render(<RegisterPage />)
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Inicia sesión' }).getAttribute('href')).toBe('/login')
  })
})

describe('acción de registro', () => {
  test('registra en Neon Auth, guarda el perfil pendiente con el teléfono y lleva a escribir el código', async () => {
    mocks.signUpEmail.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    await expect(signUpWithEmail({}, form(valid))).rejects.toThrow(CONFIRM)
    expect(mocks.signUpEmail).toHaveBeenCalledWith({ name: 'Ana Prueba', email: 'ana@example.test', password: 'una-clave-larga' })
    expect(mocks.saveSignUpProfile).toHaveBeenCalledWith({ userId: USER_ID, fullName: 'Ana Prueba', phone: '600112233' })
    expect(mocks.noteAttempt).toHaveBeenCalledWith('signup', 'ana@example.test')
  })

  test.each([
    ['sin la edad mínima', { minAge: '' }, 'minAge'],
    ['teléfono no válido', { phone: '123' }, 'phone'],
    ['contraseña corta', { password: 'corta' }, 'password'],
    ['nombre vacío', { fullName: ' ' }, 'fullName'],
    ['correo no válido', { email: 'no-es-correo' }, 'email'],
  ])('%s: no llama a Neon Auth y marca el campo', async (_name, change, field) => {
    const state = await signUpWithEmail({}, form({ ...valid, ...change }))
    expect(state.fieldErrors?.[field as keyof typeof state.fieldErrors]).toBeTruthy()
    expect(state.values).not.toHaveProperty('password')
    expect(mocks.signUpEmail).not.toHaveBeenCalled()
  })

  test('correo ya registrado: lleva al mismo sitio que un registro nuevo y no toca ningún perfil', async () => {
    mocks.signUpEmail.mockResolvedValue({ data: null, error: { status: 422, code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' } })
    await expect(signUpWithEmail({}, form(valid))).rejects.toThrow(CONFIRM)
    expect(mocks.saveSignUpProfile).not.toHaveBeenCalled()
  })

  test('con demasiados intentos no llama a Neon Auth', async () => {
    mocks.isRateLimited.mockResolvedValue(true)
    const state = await signUpWithEmail({}, form(valid))
    expect(state.error).toMatch(/Demasiados intentos/)
    expect(mocks.signUpEmail).not.toHaveBeenCalled()
  })

  test('si falla guardar el perfil, la cuenta ya existe: sigue adelante y avisa a Sentry', async () => {
    mocks.signUpEmail.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mocks.saveSignUpProfile.mockRejectedValue(new Error('Neon no responde'))
    await expect(signUpWithEmail({}, form(valid))).rejects.toThrow(CONFIRM)
    expect(mocks.captureException).toHaveBeenCalled()
  })

  test('otro error de Neon Auth: mensaje genérico y conserva lo escrito (menos la contraseña)', async () => {
    mocks.signUpEmail.mockResolvedValue({ data: null, error: { status: 500 } })
    const state = await signUpWithEmail({}, form(valid))
    expect(state.error).toMatch(/No se ha podido crear la cuenta/)
    expect(state.values).toEqual({ fullName: 'Ana Prueba', email: 'Ana@Example.test', phone: '600 11 22 33' })
  })
})

describe('confirmar el correo con el código', () => {
  test('la página rellena el correo de la dirección y pide el código', async () => {
    render(await ConfirmEmailPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ correo: 'ana@example.test' }) }))
    expect((screen.getByLabelText('Correo electrónico') as HTMLInputElement).value).toBe('ana@example.test')
    expect(screen.getByLabelText('Código de 6 cifras')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Enviar otro código' })).toBeDefined()
  })

  test('código correcto: Neon Auth inicia la sesión y "/" lleva a su sitio (alta pendiente)', async () => {
    mocks.verifyEmail.mockResolvedValue({ data: { status: true }, error: null })
    await expect(verifyEmailCode({}, form({ email: 'Ana@Example.test', otp: ' 123456 ' }))).rejects.toThrow('NEXT_REDIRECT /')
    expect(mocks.verifyEmail).toHaveBeenCalledWith({ email: 'ana@example.test', otp: '123456' })
  })

  test('código incorrecto: cuenta para el límite y lo dice', async () => {
    mocks.verifyEmail.mockResolvedValue({ data: null, error: { status: 400, code: 'INVALID_OTP' } })
    const state = await verifyEmailCode({}, form({ email: 'ana@example.test', otp: '000000' }))
    expect(state.error).toMatch(/Código incorrecto o caducado/)
    expect(mocks.noteAttempt).toHaveBeenCalledWith('verify', 'ana@example.test')
  })

  test.each(['12345', 'abcdef', '1234567'])('"%s" no es un código: ni llama a Neon Auth', async (otp) => {
    const state = await verifyEmailCode({}, form({ email: 'ana@example.test', otp }))
    expect(state.fieldErrors?.otp).toBeTruthy()
    expect(mocks.verifyEmail).not.toHaveBeenCalled()
  })

  test('con demasiados intentos no comprueba el código', async () => {
    mocks.isRateLimited.mockResolvedValue(true)
    const state = await verifyEmailCode({}, form({ email: 'ana@example.test', otp: '123456' }))
    expect(state.error).toMatch(/Demasiados intentos/)
    expect(mocks.verifyEmail).not.toHaveBeenCalled()
  })

  test('reenviar: misma respuesta exista o no la cuenta, y cuenta para el límite', async () => {
    mocks.sendVerificationOtp.mockResolvedValue({ data: null, error: { status: 400 } })
    const state = await resendEmailCode({}, form({ email: 'nadie@example.test' }))
    expect(state.notice).toMatch(/Si el correo tiene una cuenta sin confirmar/)
    expect(mocks.sendVerificationOtp).toHaveBeenCalledWith({ email: 'nadie@example.test', type: 'email-verification' })
    expect(mocks.noteAttempt).toHaveBeenCalledWith('verify', 'nadie@example.test')
  })
})
