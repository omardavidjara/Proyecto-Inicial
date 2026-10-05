import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import PrivacyPage from '../app/privacidad/page'
import LegalNoticePage from '../app/aviso-legal/page'
import LoginPage from '../app/(auth)/login/page'
import RegisterPage from '../app/(auth)/registro/page'
import PerfilPage from '../app/(client)/perfil/page'
import CoachPerfilPage from '../app/entrenador/perfil/page'
import MasOpcionesPage from '../app/admin/mas/page'
import { LEGAL, isLegalComplete } from '../lib/legal'

// Sin sesión: el inicio de sesión se muestra (con sesión redirigiría a "/")
vi.mock('@/lib/dal', () => ({ getSessionUser: vi.fn(async () => null) }))
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { social: vi.fn() } } }))
vi.mock('../app/(auth)/actions', () => ({ signInWithEmail: vi.fn(), signOut: vi.fn() }))

afterEach(cleanup)

const hrefs = () => screen.getAllByRole('link').map((a) => a.getAttribute('href'))

test('la política de privacidad incluye la información del RGPD art. 13', () => {
  const { container } = render(<PrivacyPage />)
  expect(screen.getByRole('heading', { level: 1, name: 'Política de privacidad' })).toBeDefined()
  for (const section of ['Responsable', 'datos tratamos', 'base legal', 'Cuánto tiempo', 'Quién puede ver', 'Transferencias', 'derechos', 'Menores', 'Cookies', 'Seguridad', 'Cambios']) {
    expect(screen.getByRole('heading', { level: 2, name: new RegExp(section, 'i') })).toBeDefined()
  }
  for (const value of [LEGAL.owner, LEGAL.taxId, LEGAL.address, LEGAL.privacyEmail]) expect(container.textContent).toContain(value)
  // art. 13.2.e: si dar los datos es obligatorio y qué pasa si no se dan
  expect(container.textContent).toMatch(/obligatorios/)
  // art. 13.2.d: derecho a reclamar ante la autoridad de control
  const aepd = screen.getByRole('link', { name: /www\.aepd\.es/ })
  expect(aepd.getAttribute('href')).toBe('https://www.aepd.es')
  expect(aepd.getAttribute('rel')).toContain('noopener')
  expect(aepd.textContent).toContain('se abre en otra pestaña')
})

test('el aviso legal identifica al titular (LSSI art. 10)', () => {
  const { container } = render(<LegalNoticePage />)
  expect(screen.getByRole('heading', { level: 1, name: 'Aviso legal' })).toBeDefined()
  for (const value of [LEGAL.owner, LEGAL.taxId, LEGAL.address, LEGAL.privacyEmail]) expect(container.textContent).toContain(value)
  expect(hrefs()).toContain('/privacidad')
})

test('mientras falten los datos del titular, las páginas legales avisan de que son un borrador y no enlazan un correo falso', () => {
  expect(isLegalComplete).toBe(!Object.values(LEGAL).some((value) => value.startsWith('[')))
  render(<PrivacyPage />)
  expect(screen.queryByText(/Borrador/) !== null).toBe(!isLegalComplete)
  expect(hrefs().some((href) => href?.startsWith('mailto:'))).toBe(isLegalComplete)
})

test('el inicio de sesión enlaza la privacidad y el aviso legal', async () => {
  render(await LoginPage())
  expect(hrefs()).toEqual(expect.arrayContaining(['/privacidad', '/aviso-legal']))
})

test('el registro muestra la información básica de protección de datos (LOPDGDD art. 11)', () => {
  render(<RegisterPage />)
  expect(screen.getByRole('heading', { name: /protección de datos/i })).toBeDefined()
  expect(hrefs()).toEqual(expect.arrayContaining(['/privacidad', '/aviso-legal']))
})

test.each([
  ['perfil del cliente', PerfilPage],
  ['perfil del entrenador', CoachPerfilPage],
  ['"Más" del administrador', MasOpcionesPage],
])('el %s enlaza los textos legales (requisito de las tiendas)', (_, Page) => {
  render(<Page />)
  expect(screen.getByRole('navigation', { name: 'Información legal' })).toBeDefined()
  expect(hrefs()).toEqual(expect.arrayContaining(['/privacidad', '/aviso-legal']))
})
