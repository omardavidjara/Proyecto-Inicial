import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SessionStatusBadge, type SessionStatusInput } from '@/components/sessions/session-status'

afterEach(cleanup)

const base: SessionStatusInput = { capacity: 12, booked: 4, status: 'scheduled', closed: false }

test.each<[string, Partial<SessionStatusInput>, string]>([
  ['plazas libres', {}, '8 plazas'],
  ['completa', { booked: 12 }, 'Completa · lista de espera'],
  ['reservada por mí', { myBooking: { status: 'confirmed' } }, 'Reservada'],
  ['en lista de espera', { myBooking: { status: 'waitlisted', waitlistPosition: 2 } }, 'En espera · nº 2'],
  ['cerrada', { closed: true }, 'Cerrada'],
  ['cancelada gana a todo', { status: 'cancelled', myBooking: { status: 'confirmed' } }, 'Cancelada'],
])('estado: %s', (_, overrides, text) => {
  render(<SessionStatusBadge session={{ ...base, ...overrides }} />)
  expect(screen.getByText(text)).toBeDefined()
})
