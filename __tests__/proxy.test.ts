import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { describe, expect, test, vi } from 'vitest'
import { config } from '@/proxy'

// Solo se prueba el matcher: el SDK de Neon Auth necesita el entorno de Next
vi.mock('@/lib/auth', () => ({ getAuth: vi.fn() }))

// El proxy renueva la sesión de Neon Auth y completa el regreso de Google: tiene que correr en todas las páginas
const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url })

describe('proxy.ts: en qué rutas se ejecuta', () => {
  test.each([
    '/',
    '/inicio',
    '/calendario',
    '/calendario/0b4f2c1e-8a8e-4f7b-9a51-2f0f6d1c3a77',
    '/admin',
    '/admin/clientes',
    '/entrenador/dia/2026-10-07',
    '/login',
    '/pendiente',
    '/privacidad',
  ])('sí en la página %s', (url) => {
    expect(matches(url)).toBe(true)
  })

  test.each([
    '/api/auth/get-session',
    '/api/sentry-test',
    '/_next/static/chunks/main.js',
    '/_next/image?url=%2Flogo.png&w=256&q=75',
    '/sw.js',
    '/manifest.webmanifest',
    '/logo.png',
    '/icons/icon-192.png',
  ])('no en %s', (url) => {
    expect(matches(url)).toBe(false)
  })
})
