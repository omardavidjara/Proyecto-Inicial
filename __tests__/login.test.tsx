import { expect, test, vi } from 'vitest'
import { render } from '@testing-library/react'
import { LoginForm } from '../app/(auth)/login/login-form'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { social: vi.fn() } } }))
vi.mock('../app/(auth)/actions', () => ({ signInWithEmail: vi.fn(), signOut: vi.fn() }))

test('el formulario de acceso nunca envía la contraseña en la URL', () => {
  const { container } = render(<LoginForm />)
  const form = container.querySelector('form')!
  expect(form.getAttribute('method')).toBe('post')
  expect(container.querySelector('input[type="password"]')?.getAttribute('autocomplete')).toBe('current-password')
  expect(container.querySelector('input[type="email"]')?.getAttribute('autocomplete')).toBe('email')
})
