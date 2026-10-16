import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Incidencias de administración (F9): permisos, validación de las acciones y las páginas
const INCIDENT_ID = '3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d'
const CLIENT_ID = '0b4f2c1e-8a8e-4f7b-9a51-2f0f6d1c3a77'

const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  listIncidents: vi.fn(),
  countIncidentsByStatus: vi.fn(),
  getIncident: vi.fn(),
  createIncident: vi.fn(),
  updateIncident: vi.fn(),
  setIncidentStatus: vi.fn(),
  searchClientsForIncident: vi.fn(),
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
  updateIncident: mocks.updateIncident,
  setIncidentStatus: mocks.setIncidentStatus,
  searchClientsForIncident: mocks.searchClientsForIncident,
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
  usePathname: () => '/admin/incidencias',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('next/cache', () => ({ refresh: mocks.refresh }))

import { saveIncidentAction, searchIncidentClientsAction, setIncidentStatusAction } from '../app/admin/incidencias/actions'
import AdminIncidentPage from '../app/admin/incidencias/[incidentId]/page'
import IncidenciasPage from '../app/admin/incidencias/page'

const as = (role: string) => {
  mocks.viewer = { userId: 'admin-1', fullName: 'Admin Prueba', role, isCoach: role === 'coach', status: 'active', phone: '600000000' }
}
function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}
const valid = { title: 'Taquilla rota', description: 'La 12 no cierra', priority: 'high' }
const incident = (extra = {}) => ({
  id: INCIDENT_ID,
  title: 'Taquilla rota',
  description: 'La 12 no cierra\nRevisar la llave',
  priority: 'high',
  status: 'open',
  createdAt: new Date('2026-10-10T10:00:00Z'),
  updatedAt: new Date('2026-10-10T10:00:00Z'),
  closedAt: null,
  clientId: CLIENT_ID,
  clientName: 'Ana Prueba',
  sessionId: null,
  sessionStartsAt: null,
  sessionClassName: null,
  createdById: 'admin-1',
  createdByName: 'Admin Uno',
  ...extra,
})
const listPage = (searchParams: Record<string, string> = {}) => IncidenciasPage({ searchParams: Promise.resolve(searchParams) } as never)
const detailPage = (incidentId: string) => AdminIncidentPage({ params: Promise.resolve({ incidentId }) } as never)

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  as('admin')
  mocks.listIncidents.mockResolvedValue([incident()])
  mocks.countIncidentsByStatus.mockResolvedValue({ open: 1, in_progress: 0, closed: 4 })
  mocks.getIncident.mockResolvedValue(incident())
  mocks.createIncident.mockResolvedValue({ status: 'created', id: INCIDENT_ID })
  mocks.updateIncident.mockResolvedValue(true)
  mocks.setIncidentStatus.mockResolvedValue(true)
  mocks.searchClientsForIncident.mockResolvedValue([])
})

describe('permisos', () => {
  test.each(['client', 'coach'])('%s no llega a las incidencias de administración', async (role) => {
    as(role)
    await expect(listPage()).rejects.toThrow(/NEXT_REDIRECT/)
    await expect(detailPage(INCIDENT_ID)).rejects.toThrow(/NEXT_REDIRECT/)
    await expect(saveIncidentAction({}, form(valid))).rejects.toThrow(/NEXT_REDIRECT/)
    await expect(setIncidentStatusAction(INCIDENT_ID, 'closed')).rejects.toThrow(/NEXT_REDIRECT/)
    await expect(searchIncidentClientsAction('ana')).rejects.toThrow(/NEXT_REDIRECT/)
    for (const fn of Object.values(mocks)) if (typeof fn === 'function' && fn !== mocks.redirect) expect(fn).not.toHaveBeenCalled()
  })
})

describe('acciones', () => {
  test('crear: valida y abre la incidencia a nombre de quien la crea, con el cliente opcional', async () => {
    expect(await saveIncidentAction({}, form({ ...valid, clientId: CLIENT_ID, sessionId: '' }))).toEqual({ saved: true })
    expect(mocks.createIncident).toHaveBeenCalledWith('http-db', 'admin-1', {
      title: 'Taquilla rota',
      description: 'La 12 no cierra',
      priority: 'high',
      clientId: CLIENT_ID,
      sessionId: null,
    })
    expect(mocks.refresh).toHaveBeenCalled()
  })

  test('datos no válidos: errores por campo y nada guardado', async () => {
    const state = await saveIncidentAction({}, form({ title: ' ', description: '', priority: 'urgente', clientId: 'x' }))
    expect(state.fieldErrors).toMatchObject({
      title: 'Escribe un título',
      description: 'Describe la incidencia',
      priority: 'Elige la prioridad',
      clientId: 'Elige de la lista',
    })
    expect(mocks.createIncident).not.toHaveBeenCalled()
  })

  test('cliente que ya no existe: error en su campo', async () => {
    mocks.createIncident.mockResolvedValue({ status: 'client_not_found' })
    const state = await saveIncidentAction({}, form({ ...valid, clientId: CLIENT_ID }))
    expect(state.fieldErrors?.clientId).toMatch(/ya no existe/)
  })

  test('editar con `id`: solo título, descripción y prioridad', async () => {
    expect(await saveIncidentAction({}, form({ ...valid, id: INCIDENT_ID, clientId: CLIENT_ID }))).toEqual({ saved: true })
    expect(mocks.updateIncident).toHaveBeenCalledWith('http-db', INCIDENT_ID, valid)
    expect(mocks.createIncident).not.toHaveBeenCalled()
    mocks.updateIncident.mockResolvedValue(false)
    expect((await saveIncidentAction({}, form({ ...valid, id: INCIDENT_ID }))).error).toMatch(/ya no existe/)
  })

  test('cambiar de estado: solo estados válidos', async () => {
    expect(await setIncidentStatusAction(INCIDENT_ID, 'closed')).toEqual({ ok: true, message: 'Incidencia: cerrada' })
    expect(mocks.setIncidentStatus).toHaveBeenCalledWith('http-db', INCIDENT_ID, 'closed')
    expect((await setIncidentStatusAction(INCIDENT_ID, 'borrada')).ok).toBe(false)
    expect(mocks.setIncidentStatus).toHaveBeenCalledTimes(1)
  })
})

describe('páginas', () => {
  test('lista: pestañas con recuento, abiertas por defecto y enlace al detalle', async () => {
    render(await listPage())
    expect(mocks.listIncidents).toHaveBeenCalledWith('http-db', 'open', { limit: 20 })
    const tabs = screen.getByRole('navigation', { name: 'Estado de las incidencias' })
    expect(within(tabs).getByRole('link', { name: /Abiertas/ }).getAttribute('aria-current')).toBe('page')
    expect(within(tabs).getByRole('link', { name: /Cerradas/ }).textContent).toContain('4')
    expect(screen.getByRole('link', { name: /Taquilla rota/ }).getAttribute('href')).toBe(`/admin/incidencias/${INCIDENT_ID}`)
    expect(screen.getByText(/Ana Prueba · por Admin Uno/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Nueva incidencia' })).toBeTruthy()
  })

  test('lista: pestaña y límite desde la URL, con «Ver más» si quedan', async () => {
    mocks.listIncidents.mockResolvedValue([incident({ status: 'closed' })])
    render(await listPage({ estado: 'cerrada', limite: '9999' }))
    expect(mocks.listIncidents).toHaveBeenCalledWith('http-db', 'closed', { limit: 20 })
    expect(screen.getByRole('link', { name: /Ver más \(1 de 4\)/ }).getAttribute('href')).toBe('/admin/incidencias?estado=cerrada&limite=21')
  })

  test('detalle: datos, cliente enlazado y botones de estado', async () => {
    render(await detailPage(INCIDENT_ID))
    expect(screen.getByRole('heading', { name: 'Taquilla rota', level: 1 })).toBeTruthy()
    expect(screen.getByText('Prioridad alta')).toBeTruthy()
    expect(screen.getByText(/Abierta por Admin Uno/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ana Prueba' }).getAttribute('href')).toBe(`/admin/clientes/${CLIENT_ID}`)
    expect(screen.getByRole('button', { name: 'Marcar en curso' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Volver' }).getAttribute('href')).toBe('/admin/incidencias?estado=abierta')
  })

  test('detalle cerrado: fecha de cierre y «Reabrir»', async () => {
    mocks.getIncident.mockResolvedValue(incident({ status: 'closed', closedAt: new Date('2026-10-12T10:00:00Z'), clientId: null, clientName: null }))
    render(await detailPage(INCIDENT_ID))
    expect(screen.getByText(/Cerrada el/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reabrir' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Asociada a' })).toBeNull()
  })

  test('detalle inexistente: 404', async () => {
    mocks.getIncident.mockResolvedValue(null)
    await expect(detailPage(INCIDENT_ID)).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
