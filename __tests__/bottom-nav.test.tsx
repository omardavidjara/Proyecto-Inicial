import { describe, expect, test } from 'vitest'
import { isActive } from '@/components/app-shell/bottom-nav'

describe('isActive', () => {
  test('marca la ruta exacta y sus subrutas', () => {
    expect(isActive('/calendario', { href: '/calendario' })).toBe(true)
    expect(isActive('/calendario/abc', { href: '/calendario' })).toBe(true)
  })

  test('no confunde rutas con el mismo prefijo', () => {
    expect(isActive('/calendarios', { href: '/calendario' })).toBe(false)
  })

  test('"exact" evita que /admin quede activo en todas las secciones', () => {
    expect(isActive('/admin', { href: '/admin', exact: true })).toBe(true)
    expect(isActive('/admin/agenda', { href: '/admin', exact: true })).toBe(false)
  })
})
