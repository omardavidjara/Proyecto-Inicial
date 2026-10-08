import { expect, test } from 'vitest'
import nextConfig from '../next.config'

test('cabeceras de seguridad en toda la web, con la CSP base', async () => {
  const rules = (await nextConfig.headers?.()) ?? []
  const all = rules.find((rule) => rule.source === '/(.*)')
  const headers = Object.fromEntries((all?.headers ?? []).map((h) => [h.key, h.value]))

  expect(headers['X-Frame-Options']).toBe('DENY')
  expect(headers['X-Content-Type-Options']).toBe('nosniff')
  const csp = headers['Content-Security-Policy']
  for (const directive of ["frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"]) {
    expect(csp).toContain(directive)
  }
  // Sin script-src ni default-src todavía: con ellos haría falta un nonce por petición (Fase 6)
  expect(csp).not.toMatch(/script-src|default-src/)
})
