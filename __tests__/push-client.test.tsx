import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('@/app/push-actions', () => ({ subscribePush: vi.fn(), unsubscribePush: vi.fn() }))

import { PushToggle } from '@/components/pwa/push-toggle'
import { base64UrlToBytes, detectPushSupport } from '@/lib/push-client'
import { isPushServiceUrl, pushSubscriptionSchema } from '@/lib/validation/push'

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('servicios de push admitidos', () => {
  test.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/QGx',
    'https://wns2-db5p.notify.windows.com/w/?token=abc',
  ])('acepta %s', (url) => expect(isPushServiceUrl(url)).toBe(true))

  test.each([
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com:8443/x',
    'https://fcm.googleapis.com.evil.test/x',
    'https://localhost/x',
    'https://169.254.169.254/latest',
    'no es una url',
  ])('rechaza %s (el servidor nunca hace POST a una URL cualquiera)', (url) => expect(isPushServiceUrl(url)).toBe(false))

  test('la suscripción exige las claves en base64url', () => {
    const endpoint = 'https://fcm.googleapis.com/fcm/send/abc'
    expect(pushSubscriptionSchema.safeParse({ endpoint, keys: { p256dh: 'BNc_x-1', auth: 'k9=' } }).success).toBe(true)
    expect(pushSubscriptionSchema.safeParse({ endpoint, keys: { p256dh: '<script>', auth: 'k9' } }).success).toBe(false)
    expect(pushSubscriptionSchema.safeParse({ endpoint }).success).toBe(false)
  })
})

describe('detectPushSupport', () => {
  const full = { serviceWorker: {} }
  test('iPhone en Safari: hay que instalar la app', () => {
    expect(detectPushSupport({ navigator: { userAgent: UA.iphone, ...full } }, false)).toBe('needs-install')
  })
  test('iPhone con la app instalada y Android: admitido', () => {
    const win = { PushManager: {}, Notification: {} }
    expect(detectPushSupport({ navigator: { userAgent: UA.iphone, ...full }, ...win }, true)).toBe('supported')
    expect(detectPushSupport({ navigator: { userAgent: UA.android, ...full }, ...win }, false)).toBe('supported')
  })
  test('sin PushManager: no admitido', () => {
    expect(detectPushSupport({ navigator: { userAgent: UA.android, ...full }, Notification: {} }, false)).toBe('unsupported')
  })
})

test('base64UrlToBytes decodifica la clave pública VAPID', () => {
  expect([...base64UrlToBytes('AQID_-8')]).toEqual([1, 2, 3, 255, 239])
})

describe('PushToggle', () => {
  test('en iPhone sin instalar enlaza a /instalar', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(UA.iphone)
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
    render(<PushToggle publicKey="AQID" />)
    const link = await screen.findByRole('link', { name: /Avisos en el iPhone/ })
    expect(link.getAttribute('href')).toBe('/instalar')
  })

  test('sin push en este entorno lo explica y no ofrece activarlo', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(UA.android)
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
    render(<PushToggle publicKey={null} />)
    expect(await screen.findByText('Este navegador no puede recibir avisos.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Activar avisos' })).toBeNull()
  })
})
