import { expect, test } from 'vitest'
import { availability } from '@/lib/sessions'

test('plazas libres', () => {
  expect(availability(12, 4)).toEqual({ kind: 'free', remaining: 8, label: '8 plazas' })
})

test('últimas plazas: como mucho el 20 % del aforo', () => {
  expect(availability(12, 10).kind).toBe('few')
  expect(availability(12, 9).kind).toBe('free')
  expect(availability(12, 11).label).toBe('1 plaza')
})

test('completa, también si se ha forzado por encima del aforo', () => {
  expect(availability(12, 12)).toEqual({ kind: 'full', remaining: 0, label: 'Completa' })
  expect(availability(12, 13).remaining).toBe(0)
})

test('sesión individual libre', () => {
  expect(availability(1, 0)).toEqual({ kind: 'free', remaining: 1, label: '1 plaza' })
})
