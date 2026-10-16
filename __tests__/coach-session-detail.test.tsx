import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  listSessionIncidents: vi.fn(),
  getSessionDetail: vi.fn(),
  setAttendance: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

// DAL real: sesión y perfil simulados, para comprobar que el entrenador solo llega a sus sesiones
vi.mock('@/lib/auth', () => ({ getAuth: () => ({ getSession: async () => ({ data: { user: { id: '5b0e3f0a-6f0c-4d8e-9c1a-0d7e2a4b9c11', name: 'X', email: 'x@example.test' } } }) }) }))
vi.mock('@/lib/data/profiles', () => ({ ensureProfile: async () => mocks.viewer, createSignUpProfile: vi.fn(), getMyProfile: vi.fn(), updateMyProfile: vi.fn() }))
vi.mock('@/lib/data/session-detail', () => ({ getSessionDetail: mocks.getSessionDetail, setAttendance: mocks.setAttendance }))
vi.mock('@/lib/data/incidents', () => ({ listSessionIncidents: mocks.listSessionIncidents }))
vi.mock('@/db', () => ({ getDb: () => 'http-db', getTxDb: () => 'tx-db' }))
vi.mock('next/cache', () => ({ refresh: mocks.refresh }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound, unstable_rethrow: vi.fn(), usePathname: () => '/entrenador' }))
vi.mock('next/server', () => ({ connection: async () => {} }))

import CoachSessionPage from '../app/entrenador/sesiones/[sessionId]/page'
import { setCoachAttendanceAction } from '../app/entrenador/sesiones/[sessionId]/actions'

const SESSION_ID = '0d4b7f6e-2a1c-4e5f-8b9a-1c2d3e4f5a6b'
const as = (role: string, isCoach: boolean, status = 'active') => {
  mocks.viewer = { userId: 'coach-1', fullName: 'Laura', role, isCoach, status }
}
const page = () => CoachSessionPage({ params: Promise.resolve({ sessionId: SESSION_ID }) } as never)

const HOUR = 3_600_000
const detail = (extra = {}) => ({
  id: SESSION_ID,
  className: 'CrossTraining',
  color: 'orange',
  startsAt: new Date(Date.now() - HOUR / 2),
  endsAt: new Date(Date.now() + HOUR / 2),
  capacity: 12,
  coachName: 'Laura',
  status: 'scheduled',
  cancelReason: null,
  attendees: [
    { bookingId: 'b1', userId: 'c1', fullName: 'Ana', attendance: 'attended', addedByStaff: false },
    { bookingId: 'b2', userId: 'c2', fullName: 'Bea', attendance: 'no_show', addedByStaff: false },
    { bookingId: 'b3', userId: 'c3', fullName: 'Carlos', attendance: 'pending', addedByStaff: false },
  ],
  waitlist: [],
  lateCancellations: [{ bookingId: 'l1', fullName: 'Dani Tardío', cancelledAt: new Date(), charged: null }],
  ...extra,
})

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.listSessionIncidents.mockResolvedValue([])
  as('coach', true)
  mocks.getSessionDetail.mockResolvedValue(detail())
  mocks.setAttendance.mockResolvedValue(true)
})

describe('detalle de sesión del entrenador', () => {
  test('sin ser entrenador no se llega a los datos', async () => {
    as('client', false)
    await expect(page()).rejects.toThrow('NEXT_REDIRECT')
    as('admin', false)
    await expect(page()).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.getSessionDetail).not.toHaveBeenCalled()
  })

  test('pide solo sus sesiones; una ajena o inexistente da «no encontrada»', async () => {
    mocks.getSessionDetail.mockResolvedValue(null)
    await expect(page()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.getSessionDetail).toHaveBeenCalledWith('http-db', SESSION_ID, expect.any(Date), 'coach-1')
  })

  test('asistentes con el resumen; sin quitar, sin añadir y sin anulaciones tardías', async () => {
    render(await page())
    expect(screen.getByText('Asistieron 1 · Faltaron 1 · Sin marcar 1')).toBeDefined()
    expect(screen.getByRole('group', { name: 'Asistencia de Carlos' })).toBeDefined()
    expect(screen.queryByRole('button', { name: /Quitar a/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Añadir cliente/ })).toBeNull()
    expect(screen.queryByText('Dani Tardío')).toBeNull()
    expect(screen.getByRole('link', { name: /Volver|Atrás/ }).getAttribute('href')).toMatch(/^\/entrenador\/dia\//)
  })

  test('antes de empezar no se marca; la lista de espera solo se ve', async () => {
    mocks.getSessionDetail.mockResolvedValue(
      detail({ startsAt: new Date(Date.now() + HOUR), waitlist: [{ bookingId: 'w1', userId: 'u1', fullName: 'Eva Espera' }] }),
    )
    render(await page())
    expect(screen.getByText('Podrás marcar la asistencia cuando empiece la sesión')).toBeDefined()
    expect(screen.queryByRole('group', { name: /Asistencia de/ })).toBeNull()
    expect(screen.getByText('Eva Espera')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Confirmar plaza' })).toBeNull()
  })

  test('incidencias: solo las suyas de la sesión, con «Nueva incidencia»', async () => {
    mocks.listSessionIncidents.mockResolvedValue([
      {
        id: 'i-1',
        title: 'Esterilla rota',
        description: 'x',
        priority: 'low',
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
        closedAt: null,
        clientId: null,
        clientName: null,
        sessionId: SESSION_ID,
        sessionStartsAt: new Date(),
        sessionClassName: 'CrossTraining',
        createdById: 'coach-1',
        createdByName: 'Laura',
      },
    ])
    render(await page())
    expect(mocks.listSessionIncidents).toHaveBeenCalledWith('http-db', SESSION_ID, { createdBy: 'coach-1' })
    expect(screen.getByRole('link', { name: /Esterilla rota/ }).getAttribute('href')).toBe('/entrenador/incidencias/i-1')
    expect(screen.getByRole('button', { name: 'Nueva incidencia' })).toBeTruthy()
  })
})

describe('acción de asistencia del entrenador', () => {
  test('se limita a sus sesiones y valida el valor', async () => {
    expect(await setCoachAttendanceAction('b1', 'no_show')).toEqual({ ok: true, message: 'Asistencia guardada' })
    expect(mocks.setAttendance).toHaveBeenCalledWith('http-db', 'b1', 'no_show', expect.any(Date), 'coach-1')
    expect(await setCoachAttendanceAction('b1', 'borrar')).toMatchObject({ ok: false })
    mocks.setAttendance.mockResolvedValue(false)
    expect(await setCoachAttendanceAction('ajena', 'attended')).toMatchObject({ ok: false })
  })

  test('sin ser entrenador no se guarda nada', async () => {
    as('client', false)
    await expect(setCoachAttendanceAction('b1', 'attended')).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.setAttendance).not.toHaveBeenCalled()
  })
})
