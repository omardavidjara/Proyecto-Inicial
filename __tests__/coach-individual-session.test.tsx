import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const CLIENT = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f'
const TYPE = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  createIndividualSession: vi.fn(),
  searchActiveClients: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))

// DAL real con sesión y perfil simulados: la acción solo vale para entrenadores y pasa su propio id
vi.mock('@/lib/auth', () => ({ getAuth: () => ({ getSession: async () => ({ data: { user: { id: '5b0e3f0a-6f0c-4d8e-9c1a-0d7e2a4b9c11', name: 'X', email: 'x@example.test' } } }) }) }))
vi.mock('@/lib/data/profiles', () => ({ ensureProfile: async () => mocks.viewer, createSignUpProfile: vi.fn(), getMyProfile: vi.fn(), updateMyProfile: vi.fn() }))
vi.mock('@/lib/data/individual-sessions', () => ({
  createIndividualSession: mocks.createIndividualSession,
  searchActiveClients: mocks.searchActiveClients,
  listIndividualClassTypes: async () => [],
}))
vi.mock('@/db', () => ({ getDb: () => 'http-db', getTxDb: () => 'tx-db' }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, unstable_rethrow: vi.fn(), usePathname: () => '/entrenador' }))

import { createIndividualSessionAction, searchCoachClientsAction } from '../app/entrenador/actions'
import { IndividualSessionDialog } from '../components/coach/individual-session-dialog'

const as = (role: string, isCoach: boolean) => {
  mocks.viewer = { userId: 'coach-1', fullName: 'Laura Prueba', role, isCoach, status: 'active', phone: '600000000' }
}

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [k, v] of Object.entries({ classTypeId: TYPE, date: '2030-03-26', startTime: '18:00', clientId: CLIENT, ...fields })) data.set(k, v)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  as('coach', true)
})
afterEach(cleanup)

describe('acción', () => {
  test('crea con el entrenador de la sesión y abre el detalle', async () => {
    mocks.createIndividualSession.mockResolvedValue({ status: 'created', sessionId: 's-1' })
    await expect(createIndividualSessionAction({}, form({}))).rejects.toThrow('NEXT_REDIRECT /entrenador/sesiones/s-1')
    expect(mocks.createIndividualSession).toHaveBeenCalledWith('tx-db', 'coach-1', { classTypeId: TYPE, date: '2030-03-26', startTime: '18:00', clientId: CLIENT })
  })

  test('sin cliente elegido, no llama a la base de datos', async () => {
    const state = await createIndividualSessionAction({}, form({ clientId: '' }))
    expect(state.fieldErrors?.clientId).toBe('Elige un cliente')
    expect(mocks.createIndividualSession).not.toHaveBeenCalled()
  })

  test('sin clases libres, el error va en el cliente', async () => {
    mocks.createIndividualSession.mockResolvedValue({ status: 'no_classes_left' })
    expect(await createIndividualSessionAction({}, form({}))).toEqual({ fieldErrors: { clientId: 'No le quedan clases en su tarifa' } })
  })

  test('un cliente no puede crearla ni buscar clientes', async () => {
    as('client', false)
    await expect(createIndividualSessionAction({}, form({}))).rejects.toThrow('NEXT_REDIRECT')
    await expect(searchCoachClientsAction('Ana')).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.createIndividualSession).not.toHaveBeenCalled()
    expect(mocks.searchActiveClients).not.toHaveBeenCalled()
  })
})

describe('diálogo', () => {
  test('busca y elige un cliente', async () => {
    mocks.searchActiveClients.mockResolvedValue([{ userId: CLIENT, fullName: 'Ana López' }])
    render(<IndividualSessionDialog classTypes={[{ id: TYPE, name: 'Personal', durationMinutes: 45 }]} today="2030-03-26" />)
    fireEvent.click(screen.getByRole('button', { name: 'Sesión individual' }))
    expect(screen.getByRole('option', { name: 'Personal · 45 min' })).toBeTruthy()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Cliente' }), { target: { value: 'ana' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Ana López' }))
    expect(screen.getByRole('button', { name: 'Cambiar el cliente Ana López' })).toBeTruthy()
    await waitFor(() => expect(document.querySelector<HTMLInputElement>('input[name="clientId"]')?.value).toBe(CLIENT))
  })

  test('sin tipos individuales, lo explica', () => {
    render(<IndividualSessionDialog classTypes={[]} today="2030-03-26" />)
    fireEvent.click(screen.getByRole('button', { name: 'Sesión individual' }))
    expect(screen.getByText(/No hay tipos de clase individuales activos/)).toBeTruthy()
  })
})
