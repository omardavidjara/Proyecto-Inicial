import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const CLIENT_ID = '0b4f2c1e-8a8e-4f7b-9a51-2f0f6d1c3a77'

const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  approveClient: vi.fn(),
  rejectClient: vi.fn(),
  deactivateClient: vi.fn(),
  reactivateClient: vi.fn(),
  listClients: vi.fn(),
  countPendingClients: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))

// DAL real: sesión y perfil simulados, para comprobar que solo administración llega a los datos
vi.mock('@/lib/auth', () => ({ getAuth: () => ({ getSession: async () => ({ data: { user: { id: CLIENT_ID, name: 'X', email: 'x@example.test' } } }) }) }))
vi.mock('@/lib/data/profiles', () => ({ ensureProfile: async () => mocks.viewer, createSignUpProfile: vi.fn(), getMyProfile: vi.fn(), updateMyProfile: vi.fn() }))
vi.mock('@/lib/data/clients', () => ({
  approveClient: mocks.approveClient,
  rejectClient: mocks.rejectClient,
  deactivateClient: mocks.deactivateClient,
  reactivateClient: mocks.reactivateClient,
  listClients: mocks.listClients,
  countPendingClients: mocks.countPendingClients,
}))
vi.mock('@/db', () => ({ getDb: () => 'http-db', getTxDb: () => 'tx-db' }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, unstable_rethrow: vi.fn(), usePathname: () => '/admin/clientes' }))
vi.mock('next/cache', () => ({ refresh: mocks.refresh }))

import { decideClientAction } from '../app/admin/clientes/actions'
import ClientesPage from '../app/admin/clientes/page'

const as = (role: string, status = 'active') => {
  mocks.viewer = { userId: 'admin-1', fullName: 'Admin', role, isCoach: role === 'coach', status }
}
const row = (status: string, extra = {}) => ({
  userId: CLIENT_ID,
  fullName: 'Ana Prueba',
  phone: '600112233',
  status,
  createdAt: new Date('2026-10-05T10:00:00Z'),
  approvedAt: null,
  deactivatedAt: null,
  ...extra,
})

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  as('admin')
})

describe('acción de altas y bajas', () => {
  test.each([
    ['approve', 'approveClient', 'http-db', 'Alta aprobada'],
    ['reject', 'rejectClient', 'http-db', 'Alta rechazada'],
    ['reactivate', 'reactivateClient', 'http-db', 'Cliente reactivado'],
    ['deactivate', 'deactivateClient', 'tx-db', 'dado de baja'],
  ] as const)('%s: llama a la capa de datos y refresca', async (decision, fn, db, message) => {
    mocks[fn].mockResolvedValue(true)
    const result = await decideClientAction(decision, CLIENT_ID)
    expect(result.ok).toBe(true)
    expect(result.message).toContain(message)
    expect(mocks[fn]).toHaveBeenCalledWith(db, CLIENT_ID)
    expect(mocks.refresh).toHaveBeenCalled()
  })

  test('si el estado ya no encaja, lo dice y no refresca', async () => {
    mocks.approveClient.mockResolvedValue(false)
    const result = await decideClientAction('approve', CLIENT_ID)
    expect(result.ok).toBe(false)
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  test.each([
    ['decisión desconocida', 'delete', CLIENT_ID],
    ['id que no es un uuid', 'approve', "' or 1=1 --"],
  ])('%s: no toca nada', async (_name, decision, id) => {
    const result = await decideClientAction(decision, id)
    expect(result.ok).toBe(false)
    expect(mocks.approveClient).not.toHaveBeenCalled()
  })

  test.each([
    ['un cliente', 'client', 'active'],
    ['un entrenador', 'coach', 'active'],
    ['un administrador pendiente', 'admin', 'pending'],
  ])('%s no puede, aunque llame a la acción directamente', async (_name, role, status) => {
    as(role, status)
    await expect(decideClientAction('deactivate', CLIENT_ID)).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.deactivateClient).not.toHaveBeenCalled()
  })

  test('el desarrollador también puede', async () => {
    as('developer')
    mocks.approveClient.mockResolvedValue(true)
    expect((await decideClientAction('approve', CLIENT_ID)).ok).toBe(true)
  })
})

describe('/admin/clientes', () => {
  test('por defecto, pendientes: pestaña marcada y botones de aprobar y rechazar', async () => {
    mocks.listClients.mockResolvedValue([row('pending')])
    render(await ClientesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }))
    expect(mocks.listClients).toHaveBeenCalledWith('http-db', 'pending')
    const tabs = screen.getByRole('navigation', { name: 'Estado de los clientes' })
    expect(within(tabs).getByRole('link', { name: 'Pendientes' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByText('Ana Prueba')).toBeDefined()
    expect(screen.getByRole('link', { name: '600112233' }).getAttribute('href')).toBe('tel:600112233')
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeDefined()
  })

  test('activos: dar de baja', async () => {
    mocks.listClients.mockResolvedValue([row('active', { approvedAt: new Date('2026-10-06T10:00:00Z') })])
    render(await ClientesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ estado: 'activo' }) }))
    expect(mocks.listClients).toHaveBeenCalledWith('http-db', 'active')
    expect(screen.getByRole('button', { name: 'Dar de baja' })).toBeDefined()
  })

  test('baja vacía: estado vacío', async () => {
    mocks.listClients.mockResolvedValue([])
    render(await ClientesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ estado: 'baja' }) }))
    expect(screen.getByText('No hay clientes de baja')).toBeDefined()
  })

  test('un estado inventado en la URL cae en pendientes', async () => {
    mocks.listClients.mockResolvedValue([])
    render(await ClientesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ estado: 'todos' }) }))
    expect(mocks.listClients).toHaveBeenCalledWith('http-db', 'pending')
  })
})
