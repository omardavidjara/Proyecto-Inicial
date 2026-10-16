// Pantallas del cliente sin tarjetas (docs/DESIGN.md §1.4): línea de tiempo, franja de bienvenida y «Empieza en…»
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { NextClassHero, type NextClass } from '@/components/sessions/next-class-hero'
import { SessionTimeline } from '@/components/sessions/session-timeline'
import type { SessionCardData } from '@/components/sessions/session-card'
import { formatStartsIn } from '@/lib/dates'

afterEach(cleanup)

describe('formatStartsIn', () => {
  const now = new Date('2026-10-16T10:00:00Z')
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000)

  test.each<[number, string | null]>([
    [-5, 'Ya ha empezado'],
    [25, 'Empieza en 25 min'],
    [60, 'Empieza en 1 h'],
    [90, 'Empieza en 1 h 30 min'],
    [5 * 60 + 20, 'Empieza en 5 h'],
    [12 * 60, null],
  ])('%i min → %s', (minutes, label) => {
    expect(formatStartsIn(at(minutes), now)).toBe(label)
  })
})

const session = (overrides: Partial<SessionCardData>): SessionCardData => ({
  href: '/calendario/a',
  start: '09:00',
  end: '10:00',
  className: 'Yoga',
  color: 'teal',
  subtitle: 'Ana',
  capacity: 10,
  booked: 3,
  status: 'scheduled',
  closed: false,
  ...overrides,
})

describe('SessionTimeline', () => {
  test('cada sesión es un enlace con hora, clase, entrenador y estado', () => {
    render(
      <SessionTimeline
        sessions={[
          session({}),
          session({ href: '/calendario/b', start: '18:00', className: 'Cross', myBooking: { status: 'confirmed' } }),
          session({ href: '/calendario/c', className: 'Pilates', status: 'cancelled' }),
        ]}
      />,
    )
    const links = screen.getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/calendario/a', '/calendario/b', '/calendario/c'])
    expect(links[0].textContent).toContain('09:00')
    expect(links[0].textContent).toContain('Ana')
    expect(screen.getByText('7 plazas')).toBeTruthy()
    expect(screen.getByText('Reservada')).toBeTruthy()
    expect(screen.getByText('Pilates').className).toContain('line-through')
  })
})

describe('NextClassHero', () => {
  const next: NextClass = {
    href: '/calendario/a',
    dayLabel: 'Hoy',
    start: '18:00',
    end: '19:00',
    className: 'Yoga',
    color: 'teal',
    coachName: null,
    startsIn: 'Empieza en 25 min',
    soon: true,
  }

  test('enlaza a la clase y dice cuándo empieza', () => {
    render(<NextClassHero next={next} />)
    expect(screen.getByRole('heading', { name: 'Tu próxima clase' })).toBeTruthy()
    expect(screen.getByRole('link').getAttribute('href')).toBe('/calendario/a')
    expect(screen.getByText('Hoy')).toBeTruthy()
    expect(screen.getByText('18:00–19:00 · Sin entrenador asignado')).toBeTruthy()
    expect(screen.getByText('Empieza en 25 min')).toBeTruthy()
  })

  test('sin reservas: frase que lleva al calendario y sin enlace', () => {
    render(<NextClassHero next={null} />)
    expect(screen.getByText(/No tienes clases reservadas/)).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
