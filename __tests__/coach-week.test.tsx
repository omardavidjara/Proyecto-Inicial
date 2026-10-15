import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  listCoachSessionsBetween: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))

// DAL real: sesión y perfil simulados, para comprobar que el entrenador solo pide sus propias sesiones
vi.mock('@/lib/auth', () => ({ getAuth: () => ({ getSession: async () => ({ data: { user: { id: '5b0e3f0a-6f0c-4d8e-9c1a-0d7e2a4b9c11', name: 'X', email: 'x@example.test' } } }) }) }))
vi.mock('@/lib/data/profiles', () => ({ ensureProfile: async () => mocks.viewer, createSignUpProfile: vi.fn(), getMyProfile: vi.fn(), updateMyProfile: vi.fn() }))
vi.mock('@/lib/data/agenda', () => ({ listCoachSessionsBetween: mocks.listCoachSessionsBetween }))
vi.mock('@/lib/data/individual-sessions', () => ({ listIndividualClassTypes: async () => [] }))
vi.mock('@/db', () => ({ getDb: () => 'http-db', getTxDb: () => 'tx-db' }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }), unstable_rethrow: vi.fn(), usePathname: () => '/entrenador' }))
vi.mock('next/server', () => ({ connection: async () => {} }))

import CoachWeekPage from '../app/entrenador/page'
import CoachDayPage from '../app/entrenador/dia/[date]/page'

const as = (role: string, isCoach: boolean, status = 'active') => {
  mocks.viewer = { userId: 'coach-1', fullName: 'Laura', role, isCoach, status }
}
const week = (params: Record<string, string> = {}) => CoachWeekPage({ searchParams: Promise.resolve(params) } as never)
const day = (date: string) => CoachDayPage({ params: Promise.resolve({ date }) } as never)

const session = (extra = {}) => ({
  id: crypto.randomUUID(),
  className: 'CrossTraining',
  color: 'orange',
  startsAt: new Date('2030-03-26T17:30:00Z'),
  endsAt: new Date('2030-03-26T18:30:00Z'),
  capacity: 12,
  booked: 8,
  waitlisted: 0,
  coachName: 'Laura',
  status: 'scheduled',
  ...extra,
})

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  as('coach', true)
  mocks.listCoachSessionsBetween.mockResolvedValue([])
})

describe('Mi semana', () => {
  test('sin ser entrenador no se llega a los datos', async () => {
    as('client', false)
    await expect(week()).rejects.toThrow('NEXT_REDIRECT')
    as('admin', false)
    await expect(week()).rejects.toThrow('NEXT_REDIRECT')
    as('coach', true, 'inactive')
    await expect(week()).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.listCoachSessionsBetween).not.toHaveBeenCalled()
  })

  test('un administrador que también entrena ve su semana', async () => {
    as('admin', true)
    render(await week({ semana: '2030-03-27' }))
    expect(mocks.listCoachSessionsBetween).toHaveBeenCalledWith('http-db', 'coach-1', '2030-03-25', '2030-03-31')
  })

  test('de lunes a domingo con sus clases; las canceladas no cuentan', async () => {
    mocks.listCoachSessionsBetween.mockResolvedValue([
      session(),
      session({ className: 'Pilates', startsAt: new Date('2030-03-28T08:00:00Z'), status: 'cancelled' }),
    ])
    render(await week({ semana: '2030-03-27' }))
    // El id del entrenador sale de la sesión, nunca del navegador
    expect(mocks.listCoachSessionsBetween).toHaveBeenCalledWith('http-db', 'coach-1', '2030-03-25', '2030-03-31')
    expect(screen.getByText('1 clase')).toBeDefined()
    expect(screen.getByText('18:30')).toBeDefined()
    expect(screen.getByText('CrossTraining')).toBeDefined()
    expect(screen.getByText('Pilates').closest('li')?.className).toContain('line-through')
    expect(screen.getAllByText('Sin clases')).toHaveLength(5)
    expect(screen.getByRole('link', { name: /26/ }).getAttribute('href')).toBe('/entrenador/dia/2030-03-26')
    expect(screen.getByRole('link', { name: 'Semana siguiente' }).getAttribute('href')).toBe('/entrenador?semana=2030-04-01')
  })

  test('una semana no válida muestra la de hoy', async () => {
    render(await week({ semana: '2030-02-30' }))
    const [, , from, to] = mocks.listCoachSessionsBetween.mock.calls[0]
    expect(from <= to).toBe(true)
    expect(screen.queryByText('Volver a esta semana')).toBeNull()
  })
})

describe('Mis clases del día', () => {
  test('ocupación y lista de espera de cada clase, enlazada a su detalle', async () => {
    mocks.listCoachSessionsBetween.mockResolvedValue([session({ waitlisted: 2 })])
    render(await day('2030-03-26'))
    expect(mocks.listCoachSessionsBetween).toHaveBeenCalledWith('http-db', 'coach-1', '2030-03-26', '2030-03-26')
    expect(screen.getByText('8/12 asistentes · 2 en espera')).toBeDefined()
    expect(screen.getByRole('link', { name: /CrossTraining/ }).getAttribute('href')).toMatch(/^\/entrenador\/sesiones\//)
  })

  test('sin clases y fecha no válida', async () => {
    render(await day('2030-03-26'))
    expect(screen.getByText('No tienes clases este día')).toBeDefined()
    await expect(day('2030-13-01')).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
