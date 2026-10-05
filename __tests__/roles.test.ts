import { describe, expect, test } from 'vitest'
import { canAccessArea, homePathFor, isPublicPath, type AccessProfile } from '@/lib/roles'

const active = (role: AccessProfile['role'], isCoach = role === 'coach'): AccessProfile => ({ role, isCoach, status: 'active' })

describe('zonas por rol (ARCHITECTURE §6)', () => {
  test.each([
    ['cliente', active('client'), { client: true, coach: false, admin: false }],
    ['entrenador', active('coach'), { client: false, coach: true, admin: false }],
    ['administrador', active('admin'), { client: true, coach: false, admin: true }],
    ['administrador que imparte clases', active('admin', true), { client: true, coach: true, admin: true }],
    ['desarrollador', active('developer'), { client: true, coach: false, admin: true }],
  ] as const)('%s', (_name, profile, expected) => {
    expect(canAccessArea(profile, 'client')).toBe(expected.client)
    expect(canAccessArea(profile, 'coach')).toBe(expected.coach)
    expect(canAccessArea(profile, 'admin')).toBe(expected.admin)
  })

  test.each(['pending', 'inactive'] as const)('una cuenta %s no entra en ninguna zona', (status) => {
    for (const role of ['client', 'coach', 'admin', 'developer'] as const) {
      const profile = { ...active(role), status }
      expect(canAccessArea(profile, 'client')).toBe(false)
      expect(canAccessArea(profile, 'coach')).toBe(false)
      expect(canAccessArea(profile, 'admin')).toBe(false)
      expect(homePathFor(profile)).toBe('/pendiente')
    }
  })
})

test('el inicio de cada rol', () => {
  expect(homePathFor(null)).toBe('/login')
  expect(homePathFor(active('client'))).toBe('/inicio')
  expect(homePathFor(active('coach'))).toBe('/entrenador')
  expect(homePathFor(active('admin', true))).toBe('/admin')
  expect(homePathFor(active('developer'))).toBe('/admin')
})

test('solo las páginas públicas se abren sin sesión', () => {
  for (const path of ['/login', '/registro', '/privacidad', '/aviso-legal', '/offline']) expect(isPublicPath(path)).toBe(true)
  for (const path of ['/', '/inicio', '/admin', '/entrenador', '/pendiente', '/loginx', '/privacidad-falsa']) {
    expect(isPublicPath(path)).toBe(false)
  }
})
