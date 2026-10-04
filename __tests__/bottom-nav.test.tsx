import { describe, expect, test } from 'vitest'
import { activeHref } from '@/components/app-shell/bottom-nav'

describe('activeHref', () => {
  test('marca la ruta exacta y sus subrutas', () => {
    expect(activeHref('/calendario', ['/inicio', '/calendario'])).toBe('/calendario')
    expect(activeHref('/calendario/abc', ['/inicio', '/calendario'])).toBe('/calendario')
  })

  test('no confunde rutas con el mismo prefijo', () => {
    expect(activeHref('/calendarios', ['/calendario'])).toBeUndefined()
  })

  test('gana la ruta más larga: /admin no queda activo en las demás secciones', () => {
    const admin = ['/admin', '/admin/agenda']
    expect(activeHref('/admin', admin)).toBe('/admin')
    expect(activeHref('/admin/agenda', admin)).toBe('/admin/agenda')
    const coach = ['/entrenador', '/entrenador/incidencias']
    expect(activeHref('/entrenador/dia/2026-10-05', coach)).toBe('/entrenador')
    expect(activeHref('/entrenador/incidencias', coach)).toBe('/entrenador/incidencias')
  })
})
