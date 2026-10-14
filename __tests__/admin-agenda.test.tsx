import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { agendaRange, daysBetween, parseAgendaParams } from '@/lib/agenda'

const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  listSessionsBetween: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))

// DAL real: sesión y perfil simulados, para comprobar que solo administración llega a los datos
vi.mock('@/lib/auth', () => ({ getAuth: () => ({ getSession: async () => ({ data: { user: { id: '5b0e3f0a-6f0c-4d8e-9c1a-0d7e2a4b9c11', name: 'X', email: 'x@example.test' } } }) }) }))
vi.mock('@/lib/data/profiles', () => ({ ensureProfile: async () => mocks.viewer, createSignUpProfile: vi.fn(), getMyProfile: vi.fn(), updateMyProfile: vi.fn() }))
vi.mock('@/lib/data/agenda', () => ({ listSessionsBetween: mocks.listSessionsBetween }))
vi.mock('@/db', () => ({ getDb: () => 'http-db', getTxDb: () => 'tx-db' }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, unstable_rethrow: vi.fn(), usePathname: () => '/admin/agenda' }))
vi.mock('next/server', () => ({ connection: async () => {} }))

import AgendaPage from '../app/admin/agenda/page'

const as = (role: string, status = 'active') => {
  mocks.viewer = { userId: 'admin-1', fullName: 'Admin', role, isCoach: role === 'coach', status }
}
const page = (params: Record<string, string> = {}) => AgendaPage({ searchParams: Promise.resolve(params) } as never)

const session = (extra = {}) => ({
  id: crypto.randomUUID(),
  className: 'CrossTraining',
  color: 'orange',
  startsAt: new Date('2030-03-26T17:30:00Z'),
  endsAt: new Date('2030-03-26T18:30:00Z'),
  capacity: 12,
  booked: 8,
  waitlisted: 0,
  coachName: 'Laura Coach',
  status: 'scheduled',
  ...extra,
})

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  as('admin')
  mocks.listSessionsBetween.mockResolvedValue([])
})

describe('parámetros de la agenda', () => {
  const today = '2026-10-14'
  test('vista y fecha válidas', () => {
    expect(parseAgendaParams({ vista: 'mes', fecha: '2030-03-26' }, today)).toEqual({ view: 'mes', date: '2030-03-26' })
  })
  test('si faltan o no valen: vista Día de hoy', () => {
    expect(parseAgendaParams({}, today)).toEqual({ view: 'dia', date: today })
    expect(parseAgendaParams({ vista: 'año', fecha: '2026-02-30' }, today)).toEqual({ view: 'dia', date: today })
    expect(parseAgendaParams({ vista: ['mes'], fecha: ['2030-03-26'] }, today)).toEqual({ view: 'dia', date: today })
    expect(parseAgendaParams({ vista: 'semana', fecha: '9999-12-31' }, today)).toEqual({ view: 'semana', date: today })
  })
})

describe('rango de cada vista', () => {
  test('día: ese día, y ‹ › de un día en un día', () => {
    expect(agendaRange('dia', '2026-12-31')).toMatchObject({ from: '2026-12-31', to: '2026-12-31', prev: '2026-12-30', next: '2027-01-01' })
  })
  test('semana: de lunes a domingo, aunque cruce de mes', () => {
    expect(agendaRange('semana', '2026-10-01')).toMatchObject({ from: '2026-09-28', to: '2026-10-04', prev: '2026-09-21', next: '2026-10-05', title: '28 sept – 4 oct' })
  })
  test('mes: la cuadrícula entera de lunes a domingo, y ‹ › al día 1', () => {
    const october = agendaRange('mes', '2026-10-14')
    expect(october).toMatchObject({ from: '2026-09-28', to: '2026-11-01', prev: '2026-09-01', next: '2026-11-01', title: 'octubre de 2026' })
    expect(daysBetween(october.from, october.to)).toHaveLength(35)
    // Marzo de 2027 empieza en lunes; diciembre → enero cambia de año
    expect(agendaRange('mes', '2027-03-31')).toMatchObject({ from: '2027-03-01', to: '2027-04-04' })
    expect(agendaRange('mes', '2026-12-05')).toMatchObject({ prev: '2026-11-01', next: '2027-01-01' })
    expect(agendaRange('mes', '2027-01-31')).toMatchObject({ prev: '2026-12-01', next: '2027-02-01' })
  })
})

describe('página de la agenda', () => {
  test('solo administración: los demás roles no llegan a los datos', async () => {
    for (const role of ['client', 'coach']) {
      as(role)
      await expect(page()).rejects.toThrow('NEXT_REDIRECT')
    }
    as('admin', 'inactive')
    await expect(page()).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.listSessionsBetween).not.toHaveBeenCalled()
  })

  test('día: ocupación, lista de espera y canceladas', async () => {
    mocks.listSessionsBetween.mockResolvedValue([
      session({ waitlisted: 3 }),
      session({ className: 'Pilates', status: 'cancelled', coachName: null }),
    ])
    render(await page({ vista: 'dia', fecha: '2030-03-26' }))
    expect(mocks.listSessionsBetween).toHaveBeenCalledWith('http-db', '2030-03-26', '2030-03-26')
    expect(screen.getByRole('heading', { level: 2, name: 'martes, 26 de marzo' })).toBeDefined()
    expect(screen.getByLabelText('8 de 12 plazas')).toBeDefined()
    expect(screen.getByLabelText('3 en lista de espera').textContent).toBe('+3')
    expect(screen.getByText('Cancelada')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Pilates' }).getAttribute('href')).toMatch(/^\/admin\/sesiones\//)
    expect(screen.getByRole('link', { name: 'Anterior' }).getAttribute('href')).toBe('/admin/agenda?vista=dia&fecha=2030-03-25')
    expect(screen.getByRole('link', { name: 'Semana' }).getAttribute('href')).toBe('/admin/agenda?vista=semana&fecha=2030-03-26')
  })

  test('semana: siete días, cada uno enlaza a su vista Día', async () => {
    mocks.listSessionsBetween.mockResolvedValue([session()])
    render(await page({ vista: 'semana', fecha: '2030-03-26' }))
    expect(mocks.listSessionsBetween).toHaveBeenCalledWith('http-db', '2030-03-25', '2030-03-31')
    expect(screen.getByRole('link', { name: 'Semana' }).getAttribute('aria-current')).toBe('page')
    const tuesday = screen.getByRole('region', { name: 'martes, 26 de marzo' })
    expect(within(tuesday).getByText('CrossTraining')).toBeDefined()
    expect(within(tuesday).getAllByRole('link')[0].getAttribute('href')).toBe('/admin/agenda?vista=dia&fecha=2030-03-26')
    expect(within(tuesday).getByRole('link', { name: /CrossTraining/ }).getAttribute('href')).toMatch(/^\/admin\/sesiones\//)
    expect(screen.getAllByText('Sin sesiones')).toHaveLength(6)
  })

  test('mes: cuántas sesiones tiene cada día, sin contar las canceladas', async () => {
    mocks.listSessionsBetween.mockResolvedValue([session(), session({ color: 'teal' }), session({ status: 'cancelled' })])
    render(await page({ vista: 'mes', fecha: '2030-03-26' }))
    expect(mocks.listSessionsBetween).toHaveBeenCalledWith('http-db', '2030-02-25', '2030-03-31')
    expect(screen.getByRole('link', { name: 'martes, 26 de marzo: 2 sesiones' }).getAttribute('href')).toBe('/admin/agenda?vista=dia&fecha=2030-03-26')
    expect(screen.getByRole('link', { name: 'miércoles, 27 de marzo: 0 sesiones' })).toBeDefined()
  })

  test('sin sesiones', async () => {
    render(await page({ vista: 'dia', fecha: '2030-03-26' }))
    expect(screen.getByText('Este día no hay sesiones.')).toBeDefined()
  })
})
