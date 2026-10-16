import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  profile: null as unknown,
  deletion: 'available' as string,
  saveMyProfile: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))
vi.mock('@/lib/dal', () => ({ getMyProfile: async () => mocks.profile, getViewer: async () => (mocks.profile as { viewer: unknown } | null)?.viewer ?? null, saveMyProfile: mocks.saveMyProfile, accountDeletion: async () => mocks.deletion }))
vi.mock('next/navigation', () => ({ usePathname: () => '/perfil', redirect: mocks.redirect }))
vi.mock('next/cache', () => ({ refresh: mocks.refresh }))
vi.mock('../app/(auth)/actions', () => ({ signOut: vi.fn() }))
vi.mock('@vercel/blob/client', () => ({ upload: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getAuth: vi.fn() }))

import { completeProfile, updateProfile } from '../app/(cuenta)/perfil/actions'
import CompleteProfilePage from '../app/(auth)/completar-perfil/page'
import PerfilPage from '../app/(cuenta)/perfil/page'
import PendingPage from '../app/(auth)/pendiente/page'

type Status = 'pending' | 'active' | 'inactive'
const setProfile = (status: Status, role = 'client', phone: string | null = '600112233') => {
  mocks.profile = {
    viewer: { userId: 'u1', fullName: 'Ana Prueba', role, isCoach: role === 'coach', status, phone },
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
  test('con los datos completos: enlace al perfil', async () => {
    setProfile('pending')
    render(await PendingPage())
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

describe('eliminar mi cuenta en el perfil', () => {
  test('disponible: botón para eliminar', async () => {
    setProfile('active')
    mocks.deletion = 'available'
    render(await PerfilPage())
    expect(screen.getByRole('heading', { name: 'Eliminar mi cuenta' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Eliminar mi cuenta' })).toBeDefined()
  })

  test('cuenta pendiente: también puede eliminarla', async () => {
    setProfile('pending')
    mocks.deletion = 'available'
    render(await PerfilPage())
    expect(screen.getByRole('button', { name: 'Eliminar mi cuenta' })).toBeDefined()
  })

  test('desarrollador: sin botón y con la explicación', async () => {
    setProfile('active', 'developer')
    mocks.deletion = 'developer'
    render(await PerfilPage())
    expect(screen.queryByRole('button', { name: 'Eliminar mi cuenta' })).toBeNull()
    expect(screen.getByText(/desarrollador no se puede eliminar/)).toBeDefined()
  })
})

describe('primera entrada: completar los datos (/completar-perfil)', () => {
  test('sin teléfono: pide nombre y apellidos y teléfono, con el nombre de Google relleno', async () => {
    setProfile('pending', 'client', null)
    render(await CompleteProfilePage())
    expect(screen.getByRole('heading', { level: 1, name: 'Completa tus datos' })).toBeDefined()
    expect((screen.getByLabelText('Nombre y apellidos') as HTMLInputElement).value).toBe('Ana Prueba')
    expect((screen.getByLabelText('Teléfono') as HTMLInputElement).value).toBe('')
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDefined()
  })

  test('con los datos completos no se queda aquí: sigue a su pantalla', async () => {
    setProfile('pending')
    await expect(CompleteProfilePage()).rejects.toThrow('NEXT_REDIRECT /pendiente')
  })

  test('/pendiente sin teléfono manda primero a completar los datos', async () => {
    setProfile('pending', 'client', null)
    await expect(PendingPage()).rejects.toThrow('NEXT_REDIRECT /completar-perfil')
  })

  test('al guardar, sigue a /pendiente (cuenta nueva) o a su inicio (cuenta activa)', async () => {
    setProfile('pending', 'client', null)
    await expect(completeProfile({}, form({ fullName: 'Ana López', phone: '600112233' }))).rejects.toThrow('NEXT_REDIRECT /pendiente')
    expect(mocks.saveMyProfile).toHaveBeenCalledWith({ fullName: 'Ana López', phone: '600112233' })
    setProfile('active', 'client', null)
    await expect(completeProfile({}, form({ fullName: 'Ana López', phone: '600112233' }))).rejects.toThrow('NEXT_REDIRECT /inicio')
  })

  test('sin apellidos o sin teléfono no guarda ni sigue', async () => {
    setProfile('pending', 'client', null)
    const state = await completeProfile({}, form({ fullName: 'Ana', phone: '' }))
    expect(state.fieldErrors?.fullName).toBe('Escribe tu nombre y apellidos')
    expect(state.fieldErrors?.phone).toBeTruthy()
    expect(mocks.saveMyProfile).not.toHaveBeenCalled()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})
