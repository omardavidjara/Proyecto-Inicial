import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Ficha del cliente (F8): solo administración, id validado y la página con sus secciones
const CLIENT_ID = '0b4f2c1e-8a8e-4f7b-9a51-2f0f6d1c3a77'
const SESSION_ID = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f'

const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  getClient: vi.fn(),
  getAuthEmail: vi.fn(),
  summarizeClientActivity: vi.fn(),
  getPlanSummary: vi.fn(),
  listMemberships: vi.fn(),
  listUpcomingBookings: vi.fn(),
  listBookingHistory: vi.fn(),
  listPlans: vi.fn(),
  listClientIncidents: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))

vi.mock('@/lib/auth', () => ({ getAuth: () => ({ getSession: async () => ({ data: { user: { id: CLIENT_ID, name: 'X', email: 'x@example.test' } } }) }) }))
vi.mock('@/lib/data/profiles', () => ({ ensureProfile: async () => mocks.viewer, createSignUpProfile: vi.fn(), getMyProfile: vi.fn(), updateMyProfile: vi.fn() }))
vi.mock('@/lib/data/clients', () => ({
  getClient: mocks.getClient,
  getAuthEmail: mocks.getAuthEmail,
  summarizeClientActivity: mocks.summarizeClientActivity,
  CLIENT_PAGE_SIZE: 50,
  CLIENT_MAX_LIMIT: 500,
}))
vi.mock('@/lib/data/memberships', () => ({ getPlanSummary: mocks.getPlanSummary, listMemberships: mocks.listMemberships }))
vi.mock('@/lib/data/my-bookings', () => ({ listUpcomingBookings: mocks.listUpcomingBookings, listBookingHistory: mocks.listBookingHistory }))
vi.mock('@/lib/data/bookings', () => ({ getBookingSettings: async () => ({ timeZone: 'Europe/Madrid', bookingWindowDays: 7, cancelDeadlineMinutes: 120 }) }))
vi.mock('@/lib/data/plans', () => ({ listPlans: mocks.listPlans }))
vi.mock('@/lib/data/incidents', () => ({ listClientIncidents: mocks.listClientIncidents }))
vi.mock('@/db', () => ({ getDb: () => 'http-db', getTxDb: () => 'tx-db' }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  unstable_rethrow: vi.fn(),
  usePathname: () => '/admin/clientes',
}))
vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('next/cache', () => ({ refresh: vi.fn() }))

import { loadClientHistoryAction } from '../app/admin/clientes/[userId]/actions'
import AdminClientPage from '../app/admin/clientes/[userId]/page'

const as = (role: string) => {
  mocks.viewer = { userId: 'admin-1', fullName: 'Admin Prueba', role, isCoach: false, status: 'active', phone: '600000000' }
}
const page = (userId: string) => AdminClientPage({ params: Promise.resolve({ userId }) } as never)
const booking = (extra = {}) => ({
  id: 'b-1',
  sessionId: SESSION_ID,
  status: 'confirmed',
  attendance: 'pending',
  lateCancelCharged: null,
  startsAt: new Date(Date.now() + 86_400_000),
  endsAt: new Date(Date.now() + 90_000_000),
  sessionStatus: 'scheduled',
  className: 'Funcional',
  color: 'orange',
  coachName: 'Laura',
  capacity: 10,
  booked: 3,
  ...extra,
})

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  as('admin')
  mocks.getClient.mockResolvedValue({
    userId: CLIENT_ID,
    fullName: 'Ana Prueba',
    phone: '600112233',
    status: 'active',
    createdAt: new Date('2026-10-01T10:00:00Z'),
    approvedAt: new Date('2026-10-02T10:00:00Z'),
    deactivatedAt: null,
    planName: 'Bono 8',
  })
  mocks.getAuthEmail.mockResolvedValue('ana@example.test')
  mocks.getPlanSummary.mockResolvedValue({ current: { planName: 'Bono 8', period: 'month', classesPerPeriod: 8, remaining: 5 }, next: null })
  mocks.listMemberships.mockResolvedValue(
    new Map([[CLIENT_ID, [{ id: 'm-1', planId: 'p-1', planName: 'Bono 8', period: 'month', classesPerPeriod: 8, startsOn: '2026-10-02', endsOn: null }]]]),
  )
  mocks.listUpcomingBookings.mockResolvedValue([booking()])
  mocks.listBookingHistory.mockResolvedValue({
    items: [booking({ id: 'b-2', startsAt: new Date(Date.now() - 86_400_000 * 3), attendance: 'no_show' })],
    nextCursor: null,
  })
  mocks.summarizeClientActivity.mockResolvedValue({ attended: 4, noShow: 1, unmarked: 2, lateCancelled: 0, cancelled: 3 })
  mocks.listPlans.mockResolvedValue([])
  mocks.listClientIncidents.mockResolvedValue([])
})

describe('permisos', () => {
  test.each(['client', 'coach'])('%s no llega a los datos de la ficha', async (role) => {
    as(role)
    await expect(page(CLIENT_ID)).rejects.toThrow(/NEXT_REDIRECT/)
    await expect(loadClientHistoryAction(CLIENT_ID, null)).rejects.toThrow(/NEXT_REDIRECT/)
    expect(mocks.getClient).not.toHaveBeenCalled()
    expect(mocks.listBookingHistory).not.toHaveBeenCalled()
  })

  test('id no válido o que no es un cliente: 404 y sin consultas de sus reservas', async () => {
    await expect(page('no-es-un-uuid')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.getClient).not.toHaveBeenCalled()
    mocks.getClient.mockResolvedValue(null)
    await expect(page(CLIENT_ID)).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.listUpcomingBookings).not.toHaveBeenCalled()
  })

  test('«Ver más» de otro id: vacío, sin leer reservas', async () => {
    mocks.getClient.mockResolvedValue(null)
    expect(await loadClientHistoryAction(CLIENT_ID, null)).toEqual({ items: [], nextCursor: null })
    expect(await loadClientHistoryAction('x', null)).toEqual({ items: [], nextCursor: null })
    expect(mocks.listBookingHistory).not.toHaveBeenCalled()
  })
})

describe('página', () => {
  test('datos, tarifa con clases restantes, resumen, próximas e historial enlazados a la administración', async () => {
    render(await page(CLIENT_ID))
    expect(screen.getByRole('heading', { name: 'Ana Prueba', level: 1 })).toBeTruthy()
    expect(screen.getByRole('link', { name: /ana@example\.test/ }).getAttribute('href')).toBe('mailto:ana@example.test')
    expect(screen.getByText('Activo')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Volver' }).getAttribute('href')).toBe('/admin/clientes?estado=activo')

    const plan = screen.getByRole('region', { name: 'Tarifa' })
    expect(within(plan).getByText(/Le quedan/).textContent).toContain('5 de 8 este mes')
    expect(within(plan).getByRole('list', { name: 'Historial de tarifas' })).toBeTruthy()

    const activity = screen.getByRole('region', { name: 'Últimos 30 días' })
    expect(within(activity).getByText('Asistidas').nextSibling?.textContent).toBe('4')
    expect(within(activity).getByText('Anuladas a tiempo').nextSibling?.textContent).toBe('3')
    expect(within(activity).getByText(/2 clases confirmadas sin asistencia/)).toBeTruthy()

    const upcoming = screen.getByRole('region', { name: 'Próximas reservas' })
    expect(within(upcoming).getByRole('link').getAttribute('href')).toBe(`/admin/sesiones/${SESSION_ID}`)
    const history = screen.getByRole('region', { name: 'Historial' })
    expect(within(history).getByText('Falta sin avisar')).toBeTruthy()
    expect(within(history).getByRole('link').getAttribute('href')).toBe(`/admin/sesiones/${SESSION_ID}`)
    expect(within(screen.getByRole('region', { name: 'Incidencias' })).getByText('Sin incidencias')).toBeTruthy()
  })

  test('incidencias del cliente: estado, prioridad y enlace a su detalle', async () => {
    mocks.listClientIncidents.mockResolvedValue([
      {
        id: 'i-1',
        title: 'Taquilla rota',
        description: 'No cierra',
        priority: 'high',
        status: 'in_progress',
        createdAt: new Date('2026-10-10T10:00:00Z'),
        updatedAt: new Date('2026-10-10T10:00:00Z'),
        closedAt: null,
        clientId: CLIENT_ID,
        clientName: 'Ana Prueba',
        sessionId: null,
        sessionStartsAt: null,
        sessionClassName: null,
        createdById: 'admin-1',
        createdByName: 'Admin',
      },
    ])
    render(await page(CLIENT_ID))
    expect(mocks.listClientIncidents).toHaveBeenCalledWith('http-db', CLIENT_ID)
    const section = screen.getByRole('region', { name: 'Incidencias' })
    const link = within(section).getByRole('link', { name: /Taquilla rota/ })
    expect(link.getAttribute('href')).toBe('/admin/incidencias/i-1')
    expect(within(link).getByText('En curso')).toBeTruthy()
    expect(within(link).getByText('Prioridad alta')).toBeTruthy()
    expect(within(section).getByRole('button', { name: 'Nueva incidencia' })).toBeTruthy()
  })

  test('sin correo ni tarifa: lo dice sin fallar', async () => {
    mocks.getAuthEmail.mockResolvedValue(null)
    mocks.getPlanSummary.mockResolvedValue({ current: null, next: null })
    mocks.listMemberships.mockResolvedValue(new Map())
    mocks.listUpcomingBookings.mockResolvedValue([])
    render(await page(CLIENT_ID))
    expect(screen.queryByRole('link', { name: /@/ })).toBeNull()
    expect(screen.getByText('Sin tarifa')).toBeTruthy()
    expect(screen.getByText('Sin reservas próximas')).toBeTruthy()
  })
})
