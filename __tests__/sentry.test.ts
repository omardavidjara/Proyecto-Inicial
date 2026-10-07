// Privacidad de Sentry (lib/sentry.ts, /privacidad §5): sin datos personales y apagado fuera de producción.
import type { ErrorEvent } from '@sentry/nextjs'
import { describe, expect, test, vi } from 'vitest'
import { sentryOptions } from '@/lib/sentry'

const send = (event: ErrorEvent) => sentryOptions.beforeSend(event) as ErrorEvent

/** Apagado: false, lista vacía o un objeto con todo a false */
const isOff = (value: unknown): boolean =>
  value === false || (Array.isArray(value) ? value.length === 0 : typeof value === 'object' && value !== null && Object.values(value).every(isOff))

describe('Sentry', () => {
  test('no envía datos personales por defecto ni graba sesiones', () => {
    expect(isOff(sentryOptions.dataCollection)).toBe(true)
    expect(sentryOptions).not.toHaveProperty('integrations')
    expect(sentryOptions).not.toHaveProperty('replaysSessionSampleRate')
  })

  test('apagado en tests y en desarrollo', () => {
    expect(sentryOptions.enabled).toBe(false)
  })

  test('del usuario solo deja el id', () => {
    const event = send({ type: undefined, user: { id: 'u1', email: 'cliente@example.com', ip_address: '203.0.113.1' } })
    expect(event.user).toEqual({ id: 'u1' })
    expect(send({ type: undefined, user: { email: 'cliente@example.com' } }).user).toBeUndefined()
  })

  test('quita cookies y cabeceras de la petición', () => {
    const event = send({
      type: undefined,
      request: { url: 'https://example.com/perfil', cookies: { session: 'x' }, headers: { authorization: 'y' } },
    })
    expect(event.request).toEqual({ url: 'https://example.com/perfil' })
  })
})

describe('/api/sentry-test', () => {
  test('solo un desarrollador activo provoca el error; al resto, 404', async () => {
    const notFound = new Error('NEXT_NOT_FOUND')
    vi.doMock('next/navigation', () => ({ notFound: () => { throw notFound } }))
    const getViewer = vi.fn()
    vi.doMock('@/lib/dal', () => ({ getViewer }))
    const { GET } = await import('../app/api/sentry-test/route')

    for (const viewer of [null, { role: 'admin', status: 'active' }, { role: 'developer', status: 'pending' }]) {
      getViewer.mockResolvedValueOnce(viewer)
      await expect(GET()).rejects.toBe(notFound)
    }
    getViewer.mockResolvedValueOnce({ role: 'developer', status: 'active' })
    await expect(GET()).rejects.toThrow('Prueba de Sentry')
  })
})
