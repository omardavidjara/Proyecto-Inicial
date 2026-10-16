import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Incidencias del entrenador (F9): solo las suyas, crear limitado a sus sesiones y detalle de solo lectura
const INCIDENT_ID = '3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d'
const SESSION_ID = '0d4b7f6e-2a1c-4e5f-8b9a-1c2d3e4f5a6b'
const CLIENT_ID = '0b4f2c1e-8a8e-4f7b-9a51-2f0f6d1c3a77'

const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  listIncidents: vi.fn(),
  countIncidentsByStatus: vi.fn(),
  getIncident: vi.fn(),
  createIncident: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))

vi.mock('@/lib/auth', () => ({ getAuth: () => ({ getSession: async () => ({ data: { user: { id: CLIENT_ID, name: 'X', email: 'x@example.test' } } }) }) }))
vi.mock('@/lib/data/profiles', () => ({ ensureProfile: async () => mocks.viewer, createSignUpProfile: vi.fn(), getMyProfile: vi.fn(), updateMyProfile: vi.fn() }))
vi.mock('@/lib/data/incidents', () => ({
  listIncidents: mocks.listIncidents,
  countIncidentsByStatus: mocks.countIncidentsByStatus,
  getIncident: mocks.getIncident,
  createIncident: mocks.createIncident,
}))
vi.mock('@/lib/data/bookings', () => ({ getBookingSettings: async () => ({ timeZone: 'Europe/Madrid' }) }))
vi.mock('@/db', () => ({ getDb: () => 'http-db', getTxDb: () => 'tx-db' }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  unstable_rethrow: vi.fn(),
  usePathname: () => '/entrenador/incidencias',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('next/cache', () => ({ refresh: mocks.refresh }))

import { createCoachIncidentAction } from '../app/entrenador/incidencias/actions'
import CoachIncidentPage from '../app/entrenador/incidencias/[incidentId]/page'
import CoachIncidenciasPage from '../app/entrenador/incidencias/page'

const as = (role: string, isCoach = role === 'coach') => {
  mocks.viewer = { userId: 'coach-1', fullName: 'Laura', role, isCoach, status: 'active' }
}
function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}
const valid = { title: 'Esterilla rota', description: 'En la sala 2', priority: 'low' }
const incident = (extra = {}) => ({
  id: INCIDENT_ID,
  title: 'Esterilla rota',
  description: 'En la sala 2',
  priority: 'low',
  status: 'in_progress',
  createdAt: new Date('2026-10-10T10:00:00Z'),
  updatedAt: new Date('2026-10-10T10:00:00Z'),
  closedAt: null,
  clientId: CLIENT_ID,
  clientName: 'Ana Prueba',
  sessionId: SESSION_ID,
  sessionStartsAt: new Date('2026-10-10T09:00:00Z'),
  sessionClassName: 'CrossTraining',
  createdById: 'coach-1',
  createdByName: 'Laura',
  ...extra,
})
const listPage = (searchParams: Record<string, string> = {}) => CoachIncidenciasPage({ searchParams: Promise.resolve(searchParams) })
const detailPage = () => CoachIncidentPage({ params: Promise.resolve({ incidentId: INCIDENT_ID }) })

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  as('coach')
  mocks.listIncidents.mockResolvedValue([incident()])
  mocks.countIncidentsByStatus.mockResolvedValue({ open: 0, in_progress: 1, closed: 0 })
  mocks.getIncident.mockResolvedValue(incident())
  mocks.createIncident.mockResolvedValue({ status: 'created', id: INCIDENT_ID })
})

describe('permisos', () => {
  test('sin ser entrenador no se llega a nada', async () => {
    for (const [role, isCoach] of [['client', false], ['admin', false]] as const) {
      as(role, isCoach)
      await expect(listPage()).rejects.toThrow(/NEXT_REDIRECT/)
      await expect(detailPage()).rejects.toThrow(/NEXT_REDIRECT/)
      await expect(createCoachIncidentAction({}, form(valid))).rejects.toThrow(/NEXT_REDIRECT/)
    }
    expect(mocks.listIncidents).not.toHaveBeenCalled()
    expect(mocks.getIncident).not.toHaveBeenCalled()
    expect(mocks.createIncident).not.toHaveBeenCalled()
  })

  test('lista y recuentos limitados a las suyas', async () => {
    render(await listPage({ estado: 'en-curso' }))
    expect(mocks.listIncidents).toHaveBeenCalledWith('http-db', 'in_progress', { limit: 20, createdBy: 'coach-1' })
    expect(mocks.countIncidentsByStatus).toHaveBeenCalledWith('http-db', { createdBy: 'coach-1' })
    expect(screen.getByRole('link', { name: /Esterilla rota/ }).getAttribute('href')).toBe(`/entrenador/incidencias/${INCIDENT_ID}`)
    expect(screen.getByRole('button', { name: 'Nueva incidencia' })).toBeTruthy()
  })

  test('detalle: solo las suyas; una ajena no existe', async () => {
    mocks.getIncident.mockResolvedValue(null)
    await expect(detailPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.getIncident).toHaveBeenCalledWith('http-db', INCIDENT_ID, { createdBy: 'coach-1' })
  })
})

describe('crear', () => {
  test('a su nombre y con la comprobación de entrenador en la capa de datos', async () => {
    expect(await createCoachIncidentAction({}, form({ ...valid, sessionId: SESSION_ID, clientId: CLIENT_ID }))).toEqual({ saved: true })
    expect(mocks.createIncident).toHaveBeenCalledWith(
      'http-db',
      'coach-1',
      { ...valid, sessionId: SESSION_ID, clientId: CLIENT_ID },
      { coachId: 'coach-1' },
    )
  })

  test('sesión ajena o cliente no apuntado: error y nada más', async () => {
    mocks.createIncident.mockResolvedValue({ status: 'session_not_found' })
    expect((await createCoachIncidentAction({}, form({ ...valid, sessionId: SESSION_ID }))).error).toMatch(/sesión ya no existe/)
    mocks.createIncident.mockResolvedValue({ status: 'client_not_found' })
    expect((await createCoachIncidentAction({}, form({ ...valid, sessionId: SESSION_ID, clientId: CLIENT_ID }))).fieldErrors?.clientId).toBeTruthy()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})

describe('detalle', () => {
  test('solo lectura: sin botones de estado ni editar, cliente sin enlace y sesión a su detalle', async () => {
    render(await detailPage())
    expect(screen.getByRole('heading', { name: 'Esterilla rota', level: 1 })).toBeTruthy()
    expect(screen.getByText('En curso')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Ana Prueba' })).toBeNull()
    expect(screen.getByText('Ana Prueba')).toBeTruthy()
    expect(screen.getByRole('link', { name: /CrossTraining/ }).getAttribute('href')).toBe(`/entrenador/sesiones/${SESSION_ID}`)
    expect(screen.getByRole('link', { name: 'Volver' }).getAttribute('href')).toBe('/entrenador/incidencias?estado=en-curso')
  })
})
