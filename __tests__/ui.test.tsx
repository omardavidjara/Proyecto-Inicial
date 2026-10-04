import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

afterEach(cleanup)

// docs/DESIGN.md §5: zonas táctiles de 44 px (h-11) como mínimo
test('el botón por defecto tiene 44 px de alto', () => {
  render(<Button>Reservar</Button>)
  expect(screen.getByRole('button', { name: 'Reservar' }).className).toContain('h-11')
})

test('el botón de icono tiene 44 × 44 px', () => {
  render(<Button size="icon" aria-label="Cerrar" />)
  expect(screen.getByRole('button', { name: 'Cerrar' }).className).toContain('size-11')
})

test('el campo de texto tiene 44 px de alto y texto de 16 px', () => {
  render(<Input aria-label="Correo" />)
  const input = screen.getByRole('textbox', { name: 'Correo' })
  expect(input.className).toContain('h-11')
  expect(input.className).toContain('text-base')
})

test('los anillos de foco son opacos (contraste ≥ 3:1, ver contrast.test.ts)', async () => {
  const { readFileSync, readdirSync } = await import('node:fs')
  const dir = 'components/ui'
  for (const file of readdirSync(dir)) {
    const source = readFileSync(`${dir}/${file}`, 'utf8')
    expect(source, file).not.toMatch(/focus-visible:ring-(ring|destructive)\/\d+/)
  }
})
