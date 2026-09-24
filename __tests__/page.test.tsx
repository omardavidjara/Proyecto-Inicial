import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import Page from '../app/page'

test('la página de inicio muestra un encabezado', () => {
  render(<Page />)
  expect(screen.getByRole('heading', { level: 1 })).toBeDefined()
})
