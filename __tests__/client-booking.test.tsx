// Reservar, anular y cambiar desde el calendario (F5): las acciones pasan por la DAL real (sesión y zona de
// cliente) con el usuario de la sesión, y los botones muestran lo que corresponde a cada estado.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const SESSION_ID = '5b0e3f0a-6f0c-4d8e-9c1a-0d7e2a4b9c22'

const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  bookSession: vi.fn(),
  cancelBooking: vi.fn(),
  changeBooking: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))

vi.mock('@/lib/auth', () => ({ getAuth: () => ({ getSession: async () => ({ data: { user: { id: SESSION_ID, name: 'X', email: 'x@example.test' } } }) }) }))
vi.mock('@/lib/data/profiles', () => ({ ensureProfile: async () => mocks.viewer, createSignUpProfile: vi.fn(), getMyProfile: vi.fn(), updateMyProfile: vi.fn() }))
vi.mock('@/lib/data/bookings', () => ({
  bookSession: mocks.bookSession,
  cancelBooking: mocks.cancelBooking,
  changeBooking: mocks.changeBooking,
  getBookingSettings: vi.fn(),
}))
vi.mock('@/db', () => ({ getDb: () => 'http-db', getTxDb: () => 'tx-db' }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  unstable_rethrow: vi.fn(),
  useRouter: () => ({ replace: mocks.replace }),
}))
vi.mock('next/cache', () => ({ refresh: mocks.refresh }))

import { bookSessionAction, cancelBookingAction, changeBookingAction } from '../app/(client)/calendario/actions'
import { BookingActions } from '@/components/sessions/booking-actions'

const as = (role: string, isCoach = role === 'coach') => {
  mocks.viewer = { userId: 'user-1', fullName: 'Ana', role, isCoach, status: 'active' }
}

beforeEach(() => {
  vi.clearAllMocks()
  as('client')
})

afterEach(cleanup)

describe('acciones', () => {
  test('reservar con el usuario de la sesión y la conexión de transacciones', async () => {
    mocks.bookSession.mockResolvedValue('confirmed')
    expect(await bookSessionAction(SESSION_ID)).toEqual({ ok: true, message: 'Reserva confirmada' })
    expect(mocks.bookSession).toHaveBeenCalledWith('tx-db', 'user-1', SESSION_ID)
    expect(mocks.refresh).toHaveBeenCalled()
  })

  test('los rechazos se explican y no refrescan', async () => {
    mocks.bookSession.mockResolvedValue('no_classes_left')
    expect(await bookSessionAction(SESSION_ID)).toEqual({ ok: false, message: 'No te quedan clases en este periodo de tu tarifa.' })
    mocks.changeBooking.mockResolvedValue('full')
    expect((await changeBookingAction('b-1', SESSION_ID)).ok).toBe(false)
    mocks.changeBooking.mockResolvedValue('no_plan')
    expect((await changeBookingAction('b-1', SESSION_ID)).message).toMatch(/tarifa vigente/)
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  test('anular y cambiar avisan de la anulación tardía', async () => {
    mocks.cancelBooking.mockResolvedValue('late_cancelled')
    expect(await cancelBookingAction('b-1')).toMatchObject({ ok: true, message: expect.stringMatching(/tardía/) })
    expect(mocks.cancelBooking).toHaveBeenCalledWith('tx-db', 'user-1', 'b-1')
    mocks.changeBooking.mockResolvedValue('changed_late')
    expect(await changeBookingAction('b-1', SESSION_ID)).toMatchObject({ ok: true, message: expect.stringMatching(/tardía/) })
    expect(mocks.changeBooking).toHaveBeenCalledWith('tx-db', 'user-1', 'b-1', SESSION_ID)
  })

  test('el administrador reserva para sí; el entrenador sin administración no llega a los datos', async () => {
    as('admin')
    mocks.bookSession.mockResolvedValue('waitlisted')
    expect((await bookSessionAction(SESSION_ID)).ok).toBe(true)
    as('coach')
    await expect(bookSessionAction(SESSION_ID)).rejects.toThrow('NEXT_REDIRECT')
    await expect(cancelBookingAction('b-1')).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.cancelBooking).not.toHaveBeenCalled()
  })
})

describe('botones', () => {
  const base = { sessionId: SESSION_ID, myBooking: null, full: false, lateCancel: false, deadline: '2 horas' }

  test('reservar o apuntarse a la lista de espera', () => {
    const { rerender } = render(<BookingActions {...base} />)
    expect((screen.getByRole('button', { name: 'Reservar' }) as HTMLButtonElement).disabled).toBe(false)
    rerender(<BookingActions {...base} full />)
    expect((screen.getByRole('button', { name: 'Apuntarme a la lista de espera' }) as HTMLButtonElement).disabled).toBe(false)
    rerender(<BookingActions {...base} disabledReason="Reservas cerradas" />)
    expect((screen.getByRole('button', { name: 'Reservas cerradas' }) as HTMLButtonElement).disabled).toBe(true)
  })

  test('con reserva: cambiar de sesión y anular con aviso de tardía', () => {
    render(
      <BookingActions {...base} myBooking={{ id: 'b-1', status: 'confirmed' }} lateCancel changeHref="/calendario?cambiar=b-1" />,
    )
    expect(screen.getByRole('link', { name: 'Cambiar a otra sesión' }).getAttribute('href')).toBe('/calendario?cambiar=b-1')
    fireEvent.click(screen.getByRole('button', { name: 'Anular reserva' }))
    expect(screen.getByText(/Faltan menos de 2 horas/)).toBeTruthy()
  })

  test('cambiando: no se puede elegir una sesión completa', () => {
    const changeFrom = { bookingId: 'b-1', label: 'Funcional (mañana a las 10:00)', late: false }
    const { rerender } = render(<BookingActions {...base} changeFrom={changeFrom} />)
    expect((screen.getByRole('button', { name: 'Cambiar a esta sesión' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText(/Se anulará tu reserva de Funcional/)).toBeTruthy()
    rerender(<BookingActions {...base} changeFrom={changeFrom} full />)
    expect((screen.getByRole('button', { name: 'Completa: elige otra sesión' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
