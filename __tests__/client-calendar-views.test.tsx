// Calendario del cliente con vistas Día · Semana · Mes (SPEC F5): periodo, enlaces y «Se abre …»
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { AgendaMonth, AgendaToolbar } from '@/components/admin/agenda'
import { SessionStatusBadge } from '@/components/sessions/session-status'
import { agendaRange } from '@/lib/agenda'
import { calendarHref, clientCalendarPeriod, opensLabel } from '@/lib/client-calendar'

afterEach(cleanup)

// Sábado 17 de octubre de 2026
const today = '2026-10-17'

describe('calendarHref', () => {
  test('lleva vista y fecha, y conserva la reserva que se cambia', () => {
    expect(calendarHref('semana', today)).toBe('/calendario?vista=semana&fecha=2026-10-17')
    expect(calendarHref('dia', today, 'b1')).toBe('/calendario?vista=dia&fecha=2026-10-17&cambiar=b1')
  })
})

describe('clientCalendarPeriod', () => {
  test('sin parámetros: el día de hoy, sin ‹', () => {
    expect(clientCalendarPeriod({}, today)).toMatchObject({ view: 'dia', date: today, canGoBack: false })
  })

  test('una fecha pasada o no válida pasa a hoy', () => {
    expect(clientCalendarPeriod({ vista: 'dia', fecha: '2026-10-01' }, today).date).toBe(today)
    expect(clientCalendarPeriod({ vista: 'mes', fecha: 'ayer' }, today).date).toBe(today)
  })

  test('‹ solo cuando el periodo anterior tiene días de hoy en adelante', () => {
    expect(clientCalendarPeriod({ vista: 'dia', fecha: '2026-10-18' }, today).canGoBack).toBe(true)
    expect(clientCalendarPeriod({ vista: 'semana', fecha: today }, today).canGoBack).toBe(false)
    expect(clientCalendarPeriod({ vista: 'semana', fecha: '2026-10-19' }, today).canGoBack).toBe(true)
    expect(clientCalendarPeriod({ vista: 'mes', fecha: today }, today).canGoBack).toBe(false)
    // La cuadrícula de noviembre empieza el 26 de octubre, pero el mes anterior es octubre (con hoy dentro)
    expect(clientCalendarPeriod({ vista: 'mes', fecha: '2026-11-10' }, today).canGoBack).toBe(true)
  })
})

describe('opensLabel', () => {
  const rules = { bookingWindowDays: 7, cancelDeadlineMinutes: 120 }
  const now = new Date('2026-10-17T08:00:00Z') // 10:00 en Madrid

  test('nada si ya se puede reservar o ha empezado', () => {
    expect(opensLabel(new Date('2026-10-20T16:00:00Z'), now, rules)).toBeUndefined()
    expect(opensLabel(new Date('2026-10-17T07:00:00Z'), now, rules)).toBeUndefined()
  })

  test('hoy con hora, mañana o el día', () => {
    expect(opensLabel(new Date('2026-10-24T16:00:00Z'), now, rules)).toBe('Se abre hoy a las 18:00')
    expect(opensLabel(new Date('2026-10-25T17:00:00Z'), now, rules)).toBe('Se abre mañana')
    expect(opensLabel(new Date('2026-11-03T17:00:00Z'), now, rules)).toBe('Se abre el mar 27 oct')
  })
})

describe('SessionStatusBadge', () => {
  const base = { capacity: 10, booked: 3, status: 'scheduled' as const, closed: false }

  test('muestra «Se abre …» en lugar de las plazas', () => {
    render(<SessionStatusBadge session={{ ...base, opensLabel: 'Se abre mañana' }} />)
    expect(screen.getByText('Se abre mañana')).toBeTruthy()
    expect(screen.queryByText('7 plazas')).toBeNull()
  })

  test('la cancelación manda sobre «Se abre …»', () => {
    render(<SessionStatusBadge session={{ ...base, status: 'cancelled', opensLabel: 'Se abre mañana' }} />)
    expect(screen.getByText('Cancelada')).toBeTruthy()
  })
})

describe('AgendaToolbar del cliente', () => {
  const range = { from: today, to: today, prev: '2026-10-16', next: '2026-10-18', title: 'sábado, 17 de octubre' }

  test('usa los enlaces del calendario y oculta ‹ si el día anterior ya pasó', () => {
    render(
      <AgendaToolbar
        view="dia"
        date={today}
        today={today}
        range={range}
        hrefFor={(v, d) => calendarHref(v, d)}
        canGoBack={false}
      />,
    )
    expect(screen.queryByRole('link', { name: 'Anterior' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Siguiente' }).getAttribute('href')).toBe('/calendario?vista=dia&fecha=2026-10-18')
    expect(screen.getByRole('link', { name: 'Mes' }).getAttribute('href')).toBe('/calendario?vista=mes&fecha=2026-10-17')
  })
})

describe('AgendaMonth del cliente', () => {
  test('los días pasados salen sin enlace; hoy y los siguientes llevan a la vista Día', () => {
    render(
      <AgendaMonth
        range={agendaRange('mes', today)}
        date={today}
        sessions={[{ color: 'teal', startsAt: new Date('2026-10-20T08:00:00Z'), status: 'scheduled' }]}
        today={today}
        dayHref={(d) => calendarHref('dia', d)}
        minDay={today}
      />,
    )
    expect(screen.queryByRole('link', { name: /viernes, 16 de octubre/ })).toBeNull()
    expect(screen.getByRole('link', { name: /sábado, 17 de octubre/ }).getAttribute('href')).toBe('/calendario?vista=dia&fecha=2026-10-17')
    expect(screen.getByRole('link', { name: 'martes, 20 de octubre: 1 sesión' })).toBeTruthy()
  })
})
