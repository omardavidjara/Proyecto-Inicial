import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AppShell, Page } from '@/components/app-shell/app-shell'
import { clientNav } from '@/components/app-shell/nav'

vi.mock('next/navigation', () => ({ usePathname: () => '/calendario' }))

afterEach(cleanup)

function renderScreen() {
  return render(
    <AppShell nav={clientNav} navLabel="Navegación principal">
      <Page title="Calendario" backHref="/inicio">
        <p>Contenido</p>
      </Page>
    </AppShell>
  )
}

test('el primer elemento enfocable salta al contenido principal', () => {
  renderScreen()
  const skip = screen.getByRole('link', { name: 'Saltar al contenido' })
  expect(skip.getAttribute('href')).toBe('#contenido')
  expect(screen.getByRole('main').id).toBe('contenido')
  expect(document.querySelector('a, button')).toBe(skip)
})

test('un solo h1 por pantalla y botón "Volver" con nombre accesible', () => {
  renderScreen()
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'Volver' }).getAttribute('href')).toBe('/inicio')
})

test('la navegación tiene nombre y marca la pestaña actual', () => {
  renderScreen()
  const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
  const current = nav.querySelector('[aria-current="page"]')
  expect(current?.textContent).toBe('Calendario')
})
