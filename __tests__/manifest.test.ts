import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import manifest from '../app/manifest'

test('el manifest permite instalar la app en español', () => {
  const m = manifest()
  expect(m.display).toBe('standalone')
  expect(m.lang).toBe('es')
  expect(m.start_url).toBe('/')
})

test('el manifest declara iconos 192/512 normales y maskable que existen', () => {
  const icons = manifest().icons ?? []
  for (const purpose of ['any', 'maskable'] as const) {
    const sizes = icons.filter((i) => i.purpose === purpose).map((i) => i.sizes)
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
  }
  for (const icon of icons) {
    expect(existsSync(join(process.cwd(), 'public', icon.src))).toBe(true)
  }
})
