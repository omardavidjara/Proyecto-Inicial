// Reglas de reserva puras (SPEC §4): ventana de 7 días, cierre al empezar, anulación tardía a menos de 2 h.
import { describe, expect, test } from 'vitest'

import { bookingOpensAt, bookingWindow, DEFAULT_BOOKING_RULES as rules, hasClassesLeft, isLateCancel, placeFor } from '@/lib/booking'

const startsAt = new Date('2026-10-20T08:00:00Z')
const before = (minutes: number) => new Date(startsAt.getTime() - minutes * 60_000)

describe('ventana de reserva', () => {
  test('se abre 7 días antes y se cierra al empezar', () => {
    expect(bookingWindow(startsAt, before(7 * 24 * 60 + 1), rules)).toBe('not_open_yet')
    expect(bookingWindow(startsAt, before(7 * 24 * 60), rules)).toBe('open')
    expect(bookingWindow(startsAt, before(1), rules)).toBe('open')
    expect(bookingWindow(startsAt, startsAt, rules)).toBe('closed')
    expect(bookingWindow(startsAt, before(-30), rules)).toBe('closed')
  })

  test('respeta los días que fije el gimnasio', () => {
    expect(bookingWindow(startsAt, before(3 * 24 * 60 + 1), { ...rules, bookingWindowDays: 3 })).toBe('not_open_yet')
  })

  test('cuenta días de calendario: con un cambio de hora por medio se abre a la misma hora local', () => {
    // Sesión del 30 oct 2026 a las 09:00 de Madrid (UTC+1); el 23 oct aún es horario de verano (UTC+2)
    const autumn = new Date('2026-10-30T08:00:00Z')
    expect(bookingOpensAt(autumn, rules).toISOString()).toBe('2026-10-23T07:00:00.000Z')
    expect(bookingWindow(autumn, new Date('2026-10-23T06:59:00Z'), rules)).toBe('not_open_yet')
    expect(bookingWindow(autumn, new Date('2026-10-23T07:00:00Z'), rules)).toBe('open')
    // Primavera: sesión del 1 abr 2027 a las 09:00 (UTC+2); el 25 mar es horario de invierno (UTC+1)
    expect(bookingOpensAt(new Date('2027-04-01T07:00:00Z'), rules).toISOString()).toBe('2027-03-25T08:00:00.000Z')
    // Sin cambio de hora, 7 × 24 h
    expect(bookingOpensAt(startsAt, rules).toISOString()).toBe('2026-10-13T08:00:00.000Z')
  })
})

describe('anulación tardía', () => {
  test('a menos de 2 horas es tardía; justo a las 2 horas, no', () => {
    expect(isLateCancel(startsAt, before(120), rules)).toBe(false)
    expect(isLateCancel(startsAt, before(119), rules)).toBe(true)
    expect(isLateCancel(startsAt, before(0), { ...rules, cancelDeadlineMinutes: 0 })).toBe(false)
  })
})

describe('cupo y plazas', () => {
  test('clases que quedan en el periodo; la ilimitada no tiene tope', () => {
    expect(hasClassesLeft({ period: 'week', classesPerPeriod: 3 }, 2)).toBe(true)
    expect(hasClassesLeft({ period: 'week', classesPerPeriod: 3 }, 3)).toBe(false)
    expect(hasClassesLeft({ period: 'unlimited', classesPerPeriod: null }, 99)).toBe(true)
  })

  test('con plaza se confirma; lleno, a la lista de espera', () => {
    expect(placeFor(12, 11)).toBe('confirmed')
    expect(placeFor(12, 12)).toBe('waitlisted')
    expect(placeFor(1, 0)).toBe('confirmed')
  })
})
