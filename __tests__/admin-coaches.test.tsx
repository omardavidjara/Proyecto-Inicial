import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  listSessionsBetween: vi.fn(),
  listCoachSessionsBetween: vi.fn(),
  listCoaches: vi.fn(),
  getCoach: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))

// DAL real: sesión y perfil simulados, para comprobar los permisos y qué se pide a la base de datos
vi.mock('@/lib/auth', () => ({ getAuth: () => ({ getSession: async () => ({ data: { user: { id: '5b0e3f0a-6f0c-4d8e-9c1a-0d7e2a4b9c11', name: 'X', email: 'x@example.test' } } }) }) }))
vi.mock('@/lib/data/profiles', () => ({ ensureProfile: async () => mocks.viewer, createSignUpProfile: vi.fn(), getMyProfile: vi.fn(), updateMyProfile: vi.fn() }))
vi.mock('@/lib/data/agenda', () => ({ listSessionsBetween: mocks.listSessionsBetween, listCoachSessionsBetween: mocks.listCoachSessionsBetween }))
vi.mock('@/lib/data/schedule', () => ({ listCoaches: mocks.listCoaches, getCoach: mocks.getCoach }))
vi.mock('@/db', () => ({ getDb: () => 'http-db', getTxDb: () => 'tx-db' }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }), unstable_rethrow: vi.fn(), usePathname: () => '/admin/entrenadores' }))
vi.mock('next/server', () => ({ connection: async () => {} }))

import CoachesPage from '../app/admin/entrenadores/page'
import AdminCoachPage from '../app/admin/entrenadores/[coachId]/page'

const LAURA = '0f6b9a52-3c1d-4e8f-9a7b-2d5c8e1f4a63'
const PABLO = '7c2e4d81-9b3a-4f6e-8d1c-5a7b9e2f3c04'

const as = (role: string, isCoach = false) => {
  mocks.viewer = { userId: 'admin-1', fullName: 'Admin Prueba', role, isCoach, status: 'active', phone: '600000000' }
}
const overview = (params: Record<string, string> = {}) => CoachesPage({ searchParams: Promise.resolve(params) } as never)
const detail = (coachId: string, params: Record<string, string> = {}) =>
  AdminCoachPage({ params: Promise.resolve({ coachId }), searchParams: Promise.resolve(params) } as never)

const session = (extra = {}) => ({
  id: crypto.randomUUID(),
  className: 'CrossTraining',
  color: 'orange',
  startsAt: new Date('2026-03-24T17:30:00Z'),
  endsAt: new Date('2026-03-24T18:30:00Z'),
  capacity: 12,
  booked: 8,
  waitlisted: 0,
  attended: 6,
  coachId: LAURA,
  coachName: 'Laura',
  status: 'scheduled',
  ...extra,
})

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  as('admin')
  mocks.listCoaches.mockResolvedValue([
    { userId: LAURA, fullName: 'Laura' },
    { userId: PABLO, fullName: 'Pablo' },
  ])
  mocks.listSessionsBetween.mockResolvedValue([])
  mocks.listCoachSessionsBetween.mockResolvedValue([])
  mocks.getCoach.mockImplementation(async (_db: unknown, id: string) => (id === LAURA ? { userId: LAURA, fullName: 'Laura' } : null))
})

describe('Entrenadores (administración)', () => {
  test('un entrenador o un cliente no llegan a los datos', async () => {
    as('coach', true)
    await expect(overview()).rejects.toThrow('NEXT_REDIRECT')
    await expect(detail(LAURA)).rejects.toThrow('NEXT_REDIRECT')
    as('client')
    await expect(overview()).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.listSessionsBetween).not.toHaveBeenCalled()
    expect(mocks.listCoachSessionsBetween).not.toHaveBeenCalled()
  })

  test('tabla por entrenador con impartidas, programadas y canceladas de la semana', async () => {
    mocks.listSessionsBetween.mockResolvedValue([
      session(),
      session({ startsAt: new Date('2030-01-01T08:00:00Z'), endsAt: new Date('2030-01-01T09:00:00Z'), status: 'cancelled' }),
    ])
    render(await overview({ semana: '2026-03-25' }))
    expect(mocks.listSessionsBetween).toHaveBeenCalledWith('http-db', '2026-03-23', '2026-03-29', expect.any(Date))

    const laura = screen.getByRole('link', { name: 'Laura' })
    expect(laura.getAttribute('href')).toBe(`/admin/entrenadores/${LAURA}?semana=2026-03-25`)
    const row = laura.closest('tr')!
    expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Laura', '1', '0', '0'])
    // Sin clases, ceros
    const pablo = screen.getByRole('link', { name: 'Pablo' }).closest('tr')!
    expect(within(pablo).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Pablo', '0', '0', '0'])
    expect(screen.getByRole('link', { name: 'Semana siguiente' }).getAttribute('href')).toBe('/admin/entrenadores?semana=2026-03-30')
  })

  test('el mes consulta solo sus días', async () => {
    render(await overview({ vista: 'mes', fecha: '2026-03-10' }))
    expect(mocks.listSessionsBetween).toHaveBeenCalledWith('http-db', '2026-03-01', '2026-03-31', expect.any(Date))
    expect(screen.getByRole('link', { name: 'Laura' }).getAttribute('href')).toBe(`/admin/entrenadores/${LAURA}?vista=mes&fecha=2026-03-10`)
  })

  test('el calendario de un entrenador: sus sesiones, días a la agenda y clases a su detalle', async () => {
    const given = session()
    mocks.listCoachSessionsBetween.mockResolvedValue([given])
    render(await detail(LAURA, { semana: '2026-03-25' }))
    expect(mocks.listCoachSessionsBetween).toHaveBeenCalledWith('http-db', LAURA, '2026-03-23', '2026-03-29')
    expect(screen.getByRole('heading', { name: 'Laura' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /24/ }).getAttribute('href')).toBe('/admin/agenda?vista=dia&fecha=2026-03-24')
    expect(screen.getByRole('link', { name: 'CrossTraining' }).getAttribute('href')).toBe(`/admin/sesiones/${given.id}`)
    expect(screen.getByRole('link', { name: 'Semana siguiente' }).getAttribute('href')).toBe(`/admin/entrenadores/${LAURA}?semana=2026-03-30`)
    expect(screen.getByRole('link', { name: 'Volver' }).getAttribute('href')).toBe('/admin/entrenadores?semana=2026-03-25')
  })

  test('un id que no es de un entrenador activo o no es válido da 404', async () => {
    await expect(detail(PABLO)).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(detail('no-es-un-id')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.getCoach).toHaveBeenCalledTimes(1)
    expect(mocks.listCoachSessionsBetween).not.toHaveBeenCalled()
  })
})
