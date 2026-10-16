import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const CLIENT_ID = '0b4f2c1e-8a8e-4f7b-9a51-2f0f6d1c3a77'
const PLAN_ID = '9d1c2b3a-4e5f-4a6b-8c7d-0e1f2a3b4c5d'

const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  approveClient: vi.fn(),
  rejectClient: vi.fn(),
  deactivateClient: vi.fn(),
  reactivateClient: vi.fn(),
  listClients: vi.fn(),
  countPendingClients: vi.fn(),
  countClientsByStatus: vi.fn(),
  changeClientPlan: vi.fn(),
  listPlans: vi.fn(),
  listMemberships: vi.fn(),
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
  countClientsByStatus: mocks.countClientsByStatus,
  CLIENT_PAGE_SIZE: 50,
  CLIENT_MAX_LIMIT: 500,
  changeClientPlan: mocks.changeClientPlan,
}))
vi.mock('@/lib/data/plans', () => ({ listPlans: mocks.listPlans }))
vi.mock('@/lib/data/memberships', () => ({ listMemberships: mocks.listMemberships }))
vi.mock('@/db', () => ({ getDb: () => 'http-db', getTxDb: () => 'tx-db' }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, unstable_rethrow: vi.fn(), usePathname: () => '/admin/clientes' }))
vi.mock('next/cache', () => ({ refresh: mocks.refresh }))

import { changeClientPlanAction, decideClientAction } from '../app/admin/clientes/actions'
import ClientesPage from '../app/admin/clientes/page'

const as = (role: string, status = 'active') => {
  mocks.viewer = { userId: 'admin-1', fullName: 'Admin Prueba', role, isCoach: role === 'coach', status, phone: '600000000' }
}
const row = (status: string, extra = {}) => ({
  userId: CLIENT_ID,
  fullName: 'Ana Prueba',
  phone: '600112233',
  status,
  createdAt: new Date('2026-10-05T10:00:00Z'),
  approvedAt: null,
  deactivatedAt: null,
  planName: null,
  ...extra,
})

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  as('admin')
  mocks.listPlans.mockResolvedValue([
    { id: PLAN_ID, name: 'Bono 8', period: 'month', classesPerPeriod: 8, isActive: true, clients: 0 },
    { id: 'old', name: 'Antigua', period: 'week', classesPerPeriod: 2, isActive: false, clients: 0 },
  ])
  mocks.listMemberships.mockResolvedValue(new Map())
  mocks.countClientsByStatus.mockResolvedValue({ pending: 1, active: 1, inactive: 0 })
})

describe('acción de altas y bajas', () => {
  test.each([
    ['approve', 'approveClient', 'done', ['tx-db', CLIENT_ID, null], 'Alta aprobada'],
    ['reject', 'rejectClient', true, ['http-db', CLIENT_ID], 'Alta rechazada'],
    ['reactivate', 'reactivateClient', 'done', ['tx-db', CLIENT_ID, null], 'Cliente reactivado'],
    ['deactivate', 'deactivateClient', true, ['tx-db', CLIENT_ID], 'dado de baja'],
  ] as const)('%s: llama a la capa de datos y refresca', async (decision, fn, resolved, args, message) => {
    mocks[fn].mockResolvedValue(resolved)
    const result = await decideClientAction(decision, CLIENT_ID)
    expect(result.ok).toBe(true)
    expect(result.message).toContain(message)
    expect(mocks[fn]).toHaveBeenCalledWith(...args)
    expect(mocks.refresh).toHaveBeenCalled()
  })

  test('si el estado ya no encaja, lo dice y no refresca', async () => {
    mocks.approveClient.mockResolvedValue('conflict')
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
    mocks.approveClient.mockResolvedValue('done')
    expect((await decideClientAction('approve', CLIENT_ID)).ok).toBe(true)
  })
})

describe('/admin/clientes', () => {
  test('por defecto, pendientes: pestaña marcada y botones de aprobar y rechazar', async () => {
    mocks.listClients.mockResolvedValue([row('pending')])
    render(await ClientesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }))
    expect(mocks.listClients).toHaveBeenCalledWith('http-db', 'pending', { query: '', limit: 50 })
    const tabs = screen.getByRole('navigation', { name: 'Estado de los clientes' })
    expect(within(tabs).getByRole('link', { name: /^Pendientes/ }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByText('Ana Prueba')).toBeDefined()
    expect(screen.getByRole('link', { name: '600112233' }).getAttribute('href')).toBe('tel:600112233')
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeDefined()
  })

  test('activos: dar de baja', async () => {
    mocks.listClients.mockResolvedValue([row('active', { approvedAt: new Date('2026-10-06T10:00:00Z') })])
    render(await ClientesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ estado: 'activo' }) }))
    expect(mocks.listClients).toHaveBeenCalledWith('http-db', 'active', { query: '', limit: 50 })
    expect(screen.getByRole('button', { name: 'Dar de baja' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Ana Prueba' }).getAttribute('href')).toBe(`/admin/clientes/${CLIENT_ID}`)
  })

  test('baja vacía: estado vacío', async () => {
    mocks.listClients.mockResolvedValue([])
    render(await ClientesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ estado: 'baja' }) }))
    expect(screen.getByText('No hay clientes de baja')).toBeDefined()
  })

  test('un estado inventado en la URL cae en pendientes', async () => {
    mocks.listClients.mockResolvedValue([])
    render(await ClientesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ estado: 'todos' }) }))
    expect(mocks.listClients).toHaveBeenCalledWith('http-db', 'pending', { query: '', limit: 50 })
  })
  test('pestañas con su recuento; buscar conserva la pestaña y la pestaña conserva la búsqueda', async () => {
    mocks.listClients.mockResolvedValue([row('active')])
    mocks.countClientsByStatus.mockResolvedValue({ pending: 2, active: 1, inactive: 4 })
    render(await ClientesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ estado: 'activo', q: '  ana ' }) }))
    expect(mocks.listClients).toHaveBeenCalledWith('http-db', 'active', { query: 'ana', limit: 50 })
    expect(mocks.countClientsByStatus).toHaveBeenCalledWith('http-db', 'ana')
    const tabs = screen.getByRole('navigation', { name: 'Estado de los clientes' })
    expect(within(tabs).getByRole('link', { name: 'Baja 4' }).getAttribute('href')).toBe('/admin/clientes?estado=baja&q=ana')
    const search = screen.getByRole('search')
    expect((within(search).getByLabelText('Buscar por nombre') as HTMLInputElement).value).toBe('ana')
    expect((search.querySelector('input[name=estado]') as HTMLInputElement).value).toBe('activo')
    expect(screen.queryByRole('link', { name: /Ver más/ })).toBeNull()
  })

  test('sin resultados de la búsqueda: lo dice', async () => {
    mocks.listClients.mockResolvedValue([])
    render(await ClientesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ estado: 'baja', q: 'zz' }) }))
    expect(screen.getByText('Ningún cliente coincide con «zz»')).toBeTruthy()
  })

  test('«Ver más» pide 50 más y la URL no deja pasar límites raros', async () => {
    mocks.listClients.mockResolvedValue(Array.from({ length: 50 }, (_, i) => row('pending', { userId: `u${i}` })))
    mocks.countClientsByStatus.mockResolvedValue({ pending: 120, active: 0, inactive: 0 })
    render(await ClientesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ limite: '99999' }) }))
    expect(mocks.listClients).toHaveBeenCalledWith('http-db', 'pending', { query: '', limit: 50 })
    expect(screen.getByRole('link', { name: 'Ver más (50 de 120)' }).getAttribute('href')).toBe('/admin/clientes?estado=pendiente&limite=100')
    cleanup()
    render(await ClientesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ limite: '100' }) }))
    expect(mocks.listClients).toHaveBeenLastCalledWith('http-db', 'pending', { query: '', limit: 100 })
  })

  test('solo administración ve la lista', async () => {
    as('coach')
    await expect(ClientesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.listClients).not.toHaveBeenCalled()
    expect(mocks.countClientsByStatus).not.toHaveBeenCalled()
  })
})

describe('tarifa al aprobar, reactivar y cambiar', () => {
  test('aprobar con tarifa la pasa a la capa de datos', async () => {
    mocks.approveClient.mockResolvedValue('done')
    expect((await decideClientAction('approve', CLIENT_ID, PLAN_ID)).ok).toBe(true)
    expect(mocks.approveClient).toHaveBeenCalledWith('tx-db', CLIENT_ID, PLAN_ID)
  })

  test('una tarifa que ya no está activa, o un id inválido, no aprueba', async () => {
    mocks.approveClient.mockResolvedValue('plan_not_found')
    const result = await decideClientAction('approve', CLIENT_ID, PLAN_ID)
    expect(result).toEqual({ ok: false, message: expect.stringContaining('ya no está activa') })
    vi.clearAllMocks()
    expect((await decideClientAction('approve', CLIENT_ID, 'nope')).ok).toBe(false)
    expect(mocks.approveClient).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  const change = (fields: Record<string, string>) => {
    const data = new FormData()
    for (const [key, value] of Object.entries({ userId: CLIENT_ID, planId: PLAN_ID, ...fields })) data.set(key, value)
    return data
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())

  test('cambiar desde hoy o quitarla («Sin tarifa» llega vacío)', async () => {
    mocks.changeClientPlan.mockResolvedValue('saved')
    expect(await changeClientPlanAction({}, change({ startsOn: today }))).toEqual({ saved: true })
    expect(mocks.changeClientPlan).toHaveBeenCalledWith('tx-db', CLIENT_ID, PLAN_ID, today)
    await changeClientPlanAction({}, change({ planId: '', startsOn: today }))
    expect(mocks.changeClientPlan).toHaveBeenLastCalledWith('tx-db', CLIENT_ID, null, today)
    expect(mocks.refresh).toHaveBeenCalledTimes(2)
  })

  test.each([
    ['una fecha pasada', { startsOn: '2020-01-01' }, 'startsOn'],
    ['una fecha que no existe', { startsOn: '2026-02-30' }, 'startsOn'],
    ['una tarifa que no es un uuid', { planId: 'x', startsOn: today }, 'planId'],
  ])('rechaza %s sin tocar la base de datos', async (_name, fields, field) => {
    const state = await changeClientPlanAction({}, change(fields))
    expect(state.fieldErrors?.[field as 'planId' | 'startsOn']).toBeDefined()
    expect(mocks.changeClientPlan).not.toHaveBeenCalled()
  })

  test('si el cliente ya no está activo, lo dice', async () => {
    mocks.changeClientPlan.mockResolvedValue('not_found')
    expect((await changeClientPlanAction({}, change({ startsOn: today }))).error).toContain('Recarga')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  test('solo administración puede cambiar tarifas', async () => {
    as('client')
    await expect(changeClientPlanAction({}, change({ startsOn: today }))).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.changeClientPlan).not.toHaveBeenCalled()
  })

  test('aprobar abre un diálogo con las tarifas activas y «Sin tarifa» por defecto', async () => {
    mocks.listClients.mockResolvedValue([row('pending')])
    render(await ClientesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }))
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }))
    const dialog = screen.getByRole('dialog')
    const select = within(dialog).getByLabelText('Tarifa') as HTMLSelectElement
    expect(select.value).toBe('')
    expect([...select.options].map((o) => o.text)).toEqual(['Sin tarifa', 'Bono 8 · 8 clases / mes'])
  })

  test('activos: tarifa vigente en la lista e historial en su diálogo', async () => {
    mocks.listClients.mockResolvedValue([row('active', { planName: 'Bono 8' }), row('active', { userId: 'b', fullName: 'Luis' })])
    mocks.listMemberships.mockResolvedValue(
      new Map([[CLIENT_ID, [{ id: 'm1', planId: PLAN_ID, planName: 'Bono 8', period: 'month', classesPerPeriod: 8, startsOn: '2026-09-01', endsOn: null }]]]),
    )
    render(await ClientesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ estado: 'activo' }) }))
    expect(mocks.listMemberships).toHaveBeenCalledWith('http-db', [CLIENT_ID])
    expect(screen.getByText('Tarifa: Bono 8')).toBeDefined()
    expect(screen.getByText('Sin tarifa')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Tarifa de Ana Prueba' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Desde el 1 sept 2026')).toBeDefined()
    expect(within(dialog).getByText('Vigente')).toBeDefined()
  })
})
