import { describe, expect, test } from 'vitest'
import {
  addDays,
  formatDayLabel,
  formatDayLong,
  formatDayNumber,
  formatWeekdayShort,
  isDateKey,
  toDateKey,
  weekdayIndex,
} from '@/lib/dates'

describe('fechas del gimnasio', () => {
  test('toDateKey usa la zona horaria de Madrid', () => {
    // 23:30 UTC del 5 de octubre = 01:30 del 6 en Madrid (horario de verano)
    expect(toDateKey(new Date('2026-10-05T23:30:00Z'))).toBe('2026-10-06')
  })

  test('addDays cruza meses, años y el cambio de hora', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
    expect(addDays('2026-10-06', -7)).toBe('2026-09-29')
  })

  test('isDateKey solo acepta fechas reales', () => {
    expect(isDateKey('2026-10-06')).toBe(true)
    expect(isDateKey('2026-02-30')).toBe(false)
    expect(isDateKey('06/10/2026')).toBe(false)
    expect(isDateKey(undefined)).toBe(false)
  })

  test('la semana empieza en lunes', () => {
    expect(weekdayIndex('2026-10-05')).toBe(0)
    expect(weekdayIndex('2026-10-11')).toBe(6)
  })

  test('etiquetas en español', () => {
    expect(formatDayLabel('2026-10-06', '2026-10-06')).toBe('Hoy')
    expect(formatDayLabel('2026-10-07', '2026-10-06')).toBe('Mañana')
    expect(formatDayLabel('2026-10-12', '2026-10-06')).toBe('lun 12 oct')
    expect(formatWeekdayShort('2026-10-06')).toBe('mar')
    expect(formatDayNumber('2026-10-06')).toBe('6')
    expect(formatDayLong('2026-10-06')).toBe('martes, 6 de octubre')
  })
})
