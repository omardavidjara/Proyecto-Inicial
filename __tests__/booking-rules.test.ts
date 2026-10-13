// Reglas de reserva puras (SPEC §4): ventana de 7 días, cierre al empezar, anulación tardía a menos de 2 h.
import { describe, expect, test } from 'vitest'

import { bookingWindow, DEFAULT_BOOKING_RULES as rules, hasClassesLeft, isLateCancel, placeFor } from '@/lib/booking'

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
