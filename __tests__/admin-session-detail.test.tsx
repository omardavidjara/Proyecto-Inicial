import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  getSessionDetail: vi.fn(),
  setAttendance: vi.fn(),
  addClientToSession: vi.fn(),
  removeBookingFromSession: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

// DAL real: sesión y perfil simulados, para comprobar que solo administración llega a los datos
vi.mock('@/lib/auth', () => ({ getAuth: () => ({ getSession: async () => ({ data: { user: { id: '5b0e3f0a-6f0c-4d8e-9c1a-0d7e2a4b9c11', name: 'X', email: 'x@example.test' } } }) }) }))
vi.mock('@/lib/data/profiles', () => ({ ensureProfile: async () => mocks.viewer, createSignUpProfile: vi.fn(), getMyProfile: vi.fn(), updateMyProfile: vi.fn() }))
vi.mock('@/lib/data/session-detail', () => ({
  getSessionDetail: mocks.getSessionDetail,
  setAttendance: mocks.setAttendance,
  addClientToSession: mocks.addClientToSession,
  removeBookingFromSession: mocks.removeBookingFromSession,
  searchClientsForSession: vi.fn(async () => []),
}))
vi.mock('@/db', () => ({ getDb: () => 'http-db', getTxDb: () => 'tx-db' }))
vi.mock('next/cache', () => ({ refresh: mocks.refresh }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound, unstable_rethrow: vi.fn(), usePathname: () => '/admin/agenda' }))
vi.mock('next/server', () => ({ connection: async () => {} }))

import AdminSessionPage from '../app/admin/sesiones/[sessionId]/page'
import { addClientAction, removeBookingAction, setAttendanceAction } from '../app/admin/sesiones/[sessionId]/actions'

const SESSION_ID = '0d4b7f6e-2a1c-4e5f-8b9a-1c2d3e4f5a6b'
const as = (role: string, status = 'active') => {
  mocks.viewer = { userId: 'admin-1', fullName: 'Admin', role, isCoach: role === 'coach', status }
}
const page = () => AdminSessionPage({ params: Promise.resolve({ sessionId: SESSION_ID }) } as never)

const HOUR = 3_600_000
const detail = (extra = {}) => ({
  id: SESSION_ID,
  className: 'CrossTraining',
  color: 'orange',
  startsAt: new Date(Date.now() - HOUR / 2),
  endsAt: new Date(Date.now() + HOUR / 2),
  capacity: 12,
  coachName: 'Laura Coach',
  status: 'scheduled',
  cancelReason: null,
  attendees: [
    { bookingId: 'b1', fullName: 'Ana', attendance: 'attended', addedByStaff: false },
    { bookingId: 'b2', fullName: 'Bea', attendance: 'no_show', addedByStaff: true },
    { bookingId: 'b3', fullName: 'Carlos', attendance: 'pending', addedByStaff: false },
  ],
  waitlist: [],
  lateCancellations: [],
  ...extra,
})

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  as('admin')
  mocks.getSessionDetail.mockResolvedValue(detail())
})

describe('página del detalle', () => {
  test('solo administración: los demás roles no llegan a los datos', async () => {
    for (const role of ['client', 'coach']) {
      as(role)
      await expect(page()).rejects.toThrow('NEXT_REDIRECT')
    }
    expect(mocks.getSessionDetail).not.toHaveBeenCalled()
  })

  test('sesión que no existe: 404', async () => {
    mocks.getSessionDetail.mockResolvedValue(null)
    await expect(page()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.getSessionDetail).toHaveBeenCalledWith('http-db', SESSION_ID)
  })

  test('ya empezada: resumen de asistencia y botones asistió / faltó', async () => {
    render(await page())
    expect(screen.getByText('Asistieron 1 · Faltaron 1 · Sin marcar 1')).toBeDefined()
    const ana = screen.getByRole('group', { name: 'Asistencia de Ana' })
    expect(within(ana).getByRole('button', { name: 'Asistió' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(screen.getByRole('group', { name: 'Asistencia de Bea' })).getByRole('button', { name: 'Faltó' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Añadido a mano')).toBeDefined()
    expect(screen.getByText('3/12 ocupadas')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Añadir cliente' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Quitar a Carlos' })).toBeDefined()
  })

  test('futura: sin asistencia todavía, con lista de espera y anulaciones tardías', async () => {
    mocks.getSessionDetail.mockResolvedValue(
      detail({
        startsAt: new Date(Date.now() + 24 * HOUR),
        endsAt: new Date(Date.now() + 25 * HOUR),
        waitlist: [
          { bookingId: 'w1', userId: 'u1', fullName: 'Primera' },
          { bookingId: 'w2', userId: 'u2', fullName: 'Segunda' },
        ],
        lateCancellations: [
          { bookingId: 'l1', fullName: 'Pendiente', cancelledAt: new Date(), charged: null },
          { bookingId: 'l2', fullName: 'Decidida', cancelledAt: new Date(), charged: true },
        ],
      }),
    )
    render(await page())
    expect(screen.getByText('Podrás marcar la asistencia cuando empiece la sesión')).toBeDefined()
    expect(screen.queryByRole('group', { name: 'Asistencia de Ana' })).toBeNull()
    expect(screen.getByText('3/12 ocupadas · 2 en espera')).toBeDefined()
    expect(screen.getAllByRole('button', { name: 'Confirmar plaza' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Descontar' })).toBeDefined()
    expect(screen.getByText('Descontada')).toBeDefined()
  })

  test('cancelada: solo lectura, con el motivo', async () => {
    mocks.getSessionDetail.mockResolvedValue(detail({ status: 'cancelled', cancelReason: 'Avería' }))
    render(await page())
    expect(screen.getByText('Motivo: Avería')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Añadir cliente' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Quitar/ })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Asistencia de Ana' })).toBeNull()
  })
})

describe('acciones', () => {
  test('asistencia: valida el valor y pasa por la DAL', async () => {
    expect(await setAttendanceAction('b1', 'maybe')).toEqual({ ok: false, message: 'Acción no válida' })
    expect(mocks.setAttendance).not.toHaveBeenCalled()
    mocks.setAttendance.mockResolvedValue(true)
    expect((await setAttendanceAction('b1', 'no_show')).ok).toBe(true)
    expect(mocks.setAttendance).toHaveBeenCalledWith('http-db', 'b1', 'no_show')
  })

  test('añadir y quitar: queda quién lo hizo y se avisa del resultado', async () => {
    mocks.addClientToSession.mockResolvedValue('already_booked')
    expect(await addClientAction(SESSION_ID, 'u1')).toEqual({ ok: false, message: 'Ese cliente ya tiene plaza en esta sesión' })
    expect(mocks.addClientToSession).toHaveBeenCalledWith('tx-db', 'admin-1', SESSION_ID, 'u1')
    mocks.removeBookingFromSession.mockResolvedValue('removed')
    expect(await removeBookingAction('b1')).toEqual({ ok: true, message: 'Reserva anulada sin descontar' })
    expect(mocks.refresh).toHaveBeenCalledTimes(2)
  })

  test('un entrenador no puede usar las acciones', async () => {
    as('coach')
    await expect(setAttendanceAction('b1', 'attended')).rejects.toThrow('NEXT_REDIRECT')
    await expect(addClientAction(SESSION_ID, 'u1')).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.setAttendance).not.toHaveBeenCalled()
    expect(mocks.addClientToSession).not.toHaveBeenCalled()
  })
})
