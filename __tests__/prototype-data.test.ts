import { expect, test } from 'vitest'
import {
  prototypeAttendees,
  prototypeCoachSessions,
  prototypeNextBooking,
  prototypeSession,
  prototypeSessions,
} from '@/lib/prototype/data'
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

test('el entrenador solo ve las sesiones que imparte', () => {
  const sessions = prototypeCoachSessions('2026-10-07', 'Laura', today)
  expect(sessions.length).toBeGreaterThan(0)
  expect(sessions.every((s) => s.coach === 'Laura')).toBe(true)
})

test('una sesión tiene tantos asistentes como reservas', () => {
  const [session] = prototypeSessions('2026-10-07', today)
  expect(prototypeAttendees(session)).toHaveLength(session.booked)
})

test('la próxima clase del cliente es una reserva confirmada que aún no ha empezado', () => {
  const next = prototypeNextBooking(today, '23:59')
  expect(next?.myBooking?.status).toBe('confirmed')
  expect(next!.date > today).toBe(true)
})
