import { expect, test, vi } from 'vitest'
import Page from '../app/page'
import type { Viewer } from '@/lib/data/profiles'

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`)
  }),
  viewer: null as Viewer | null,
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/dal', () => ({ getViewer: async () => mocks.viewer }))
const { redirect } = mocks

const base: Viewer = { userId: '00000000-0000-4000-8000-000000000001', fullName: 'Ana', role: 'client', isCoach: false, status: 'active' }


test.each([
  ['sin sesión', null, '/login'],
  ['cliente activo', base, '/inicio'],
  ['cliente pendiente', { ...base, status: 'pending' }, '/pendiente'],
  ['entrenador', { ...base, role: 'coach', isCoach: true }, '/entrenador'],
  ['administrador', { ...base, role: 'admin' }, '/admin'],
] as const)('"/" redirige: %s', async (_name, current, expected) => {
  mocks.viewer = current
  await expect(Page()).rejects.toThrow(`NEXT_REDIRECT ${expected}`)
  expect(redirect).toHaveBeenLastCalledWith(expected)
})
