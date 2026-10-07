// Privacidad de Sentry (lib/sentry.ts, /privacidad §5): sin datos personales y apagado fuera de producción.
import type { ErrorEvent } from '@sentry/nextjs'
import { describe, expect, test } from 'vitest'
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
