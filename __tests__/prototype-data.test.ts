import { expect, test } from 'vitest'
import { prototypeSession, prototypeSessions } from '@/lib/prototype/data'
import { isClosed } from '@/lib/prototype/now'

const today = '2026-10-06' // martes

test('entre semana hay sesiones y el domingo no (estado vacío)', () => {
  expect(prototypeSessions(today, today).length).toBeGreaterThan(0)
  expect(prototypeSessions('2026-10-11', today)).toEqual([])
})

test('ninguna sesión supera su aforo', () => {
  for (const s of prototypeSessions('2026-10-07', today)) expect(s.booked).toBeLessThanOrEqual(s.capacity)
})

test('prototypeSession rechaza identificadores inválidos', () => {
  expect(prototypeSession('nada')).toBeUndefined()
  expect(prototypeSession('2026-02-30_0700')).toBeUndefined()
})

test('una sesión se cierra al empezar', () => {
  expect(isClosed(today, '07:00', today, '07:00')).toBe(true)
  expect(isClosed(today, '18:00', today, '07:00')).toBe(false)
  expect(isClosed('2026-10-05', '20:00', today, '07:00')).toBe(true)
})
