import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  profile: null as unknown,
  saveMyProfile: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))
vi.mock('@/lib/dal', () => ({ getMyProfile: async () => mocks.profile, saveMyProfile: mocks.saveMyProfile }))
vi.mock('next/navigation', () => ({ usePathname: () => '/perfil', redirect: mocks.redirect }))
vi.mock('next/cache', () => ({ refresh: mocks.refresh }))
vi.mock('../app/(auth)/actions', () => ({ signOut: vi.fn() }))
vi.mock('@vercel/blob/client', () => ({ upload: vi.fn() }))

import { updateProfile } from '../app/(cuenta)/perfil/actions'
import PerfilPage from '../app/(cuenta)/perfil/page'
import PendingPage from '../app/(auth)/pendiente/page'

type Status = 'pending' | 'active' | 'inactive'
const setProfile = (status: Status, role = 'client', phone: string | null = '600112233') => {
  mocks.profile = {
    viewer: { userId: 'u1', fullName: 'Ana Prueba', role, isCoach: role === 'coach', status },
    email: 'ana@example.test',
    fullName: 'Ana Prueba',
    phone,
    avatarUrl: null,
  }
}
const form = (values: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

describe('/perfil según el estado de la cuenta', () => {
  test('cliente activo: con la navegación del cliente y sus datos rellenos', async () => {
    setProfile('active')
    render(await PerfilPage())
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeDefined()
    expect((screen.getByLabelText('Nombre y apellidos') as HTMLInputElement).value).toBe('Ana Prueba')
    expect((screen.getByLabelText('Teléfono') as HTMLInputElement).value).toBe('600112233')
    expect((screen.getByLabelText('Correo electrónico') as HTMLInputElement).readOnly).toBe(true)
    expect(screen.getByRole('button', { name: 'Añadir foto' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Quitar foto' })).toBeNull()
  })

  test.each(['pending', 'inactive'] as const)('cuenta %s: también puede abrirlo, sin navegación y con vuelta a /pendiente', async (status) => {
    setProfile(status)
    render(await PerfilPage())
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Volver' }).getAttribute('href')).toBe('/pendiente')
    expect(screen.getByLabelText('Nombre y apellidos')).toBeDefined()
  })

  test('entrenador activo: a su perfil con su navegación', async () => {
    setProfile('active', 'coach')
    await expect(PerfilPage()).rejects.toThrow('NEXT_REDIRECT /entrenador/perfil')
  })
})

describe('/pendiente', () => {
  test('sin teléfono (registro con Google): pide completarlo y enlaza el perfil', async () => {
    setProfile('pending', 'client', null)
    render(await PendingPage())
    expect(screen.getByText(/Añade tu teléfono/)).toBeDefined()
    expect(screen.getByRole('link', { name: 'Completar mi perfil' }).getAttribute('href')).toBe('/perfil')
  })

  test('con teléfono: solo el enlace al perfil', async () => {
    setProfile('pending')
    render(await PendingPage())
    expect(screen.queryByText(/Añade tu teléfono/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Mi perfil' }).getAttribute('href')).toBe('/perfil')
  })
})

describe('guardar el perfil', () => {
  test('valida, guarda nombre y teléfono normalizado y refresca la página', async () => {
    expect(await updateProfile({}, form({ fullName: '  Ana López ', phone: '+34 600-11-22-33' }))).toEqual({ saved: true })
    expect(mocks.saveMyProfile).toHaveBeenCalledWith({ fullName: 'Ana López', phone: '+34600112233' })
    expect(mocks.refresh).toHaveBeenCalled()
  })

  test('datos no válidos: no guarda y marca los campos', async () => {
    const state = await updateProfile({}, form({ fullName: 'A', phone: '12' }))
    expect(state.fieldErrors?.fullName).toBeTruthy()
    expect(state.fieldErrors?.phone).toBeTruthy()
    expect(mocks.saveMyProfile).not.toHaveBeenCalled()
  })
})
