import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import Page from '../app/page'

test('la página de inicio del prototipo enlaza las pantallas clave', () => {
  render(<Page />)
  expect(screen.getByRole('heading', { level: 1 })).toBeDefined()
  for (const href of ['/login', '/calendario', '/admin']) {
    expect(screen.getAllByRole('link').some((a) => a.getAttribute('href') === href)).toBe(true)
  }
})
