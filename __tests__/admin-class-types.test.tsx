import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const TYPE_ID = '5b0e3f0a-6f0c-4d8e-9c1a-0d7e2a4b9c11'

const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  listClassTypes: vi.fn(),
  createClassType: vi.fn(),
  updateClassType: vi.fn(),
  setClassTypeActive: vi.fn(),
  deleteClassType: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))

// DAL real: sesión y perfil simulados, para comprobar que solo administración llega a los datos
vi.mock('@/lib/auth', () => ({ getAuth: () => ({ getSession: async () => ({ data: { user: { id: TYPE_ID, name: 'X', email: 'x@example.test' } } }) }) }))
vi.mock('@/lib/data/profiles', () => ({ ensureProfile: async () => mocks.viewer, createSignUpProfile: vi.fn(), getMyProfile: vi.fn(), updateMyProfile: vi.fn() }))
vi.mock('@/lib/data/class-types', () => ({
  listClassTypes: mocks.listClassTypes,
  createClassType: mocks.createClassType,
  updateClassType: mocks.updateClassType,
  setClassTypeActive: mocks.setClassTypeActive,
  deleteClassType: mocks.deleteClassType,
}))
vi.mock('@/db', () => ({ getDb: () => 'http-db', getTxDb: () => 'tx-db' }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, unstable_rethrow: vi.fn(), usePathname: () => '/admin/tipos-clase' }))
vi.mock('next/cache', () => ({ refresh: mocks.refresh }))

import { deleteClassTypeAction, saveClassTypeAction, setClassTypeActiveAction } from '../app/admin/tipos-clase/actions'
import MasOpcionesPage from '../app/admin/mas/page'
import TiposClasePage from '../app/admin/tipos-clase/page'

const as = (role: string, status = 'active') => {
  mocks.viewer = { userId: 'admin-1', fullName: 'Admin', role, isCoach: role === 'coach', status }
}

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}
const valid = { name: 'Hyrox', kind: 'group', durationMinutes: '60', defaultCapacity: '14', color: 'red' }
const parsed = { name: 'Hyrox', kind: 'group', durationMinutes: 60, defaultCapacity: 14, color: 'red' }

const type = (extra = {}) => ({
  id: TYPE_ID,
  name: 'CrossTraining',
  kind: 'group',
  durationMinutes: 60,
  defaultCapacity: 12,
  color: 'orange',
  isActive: true,
  ...extra,
})

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  as('admin')
})

describe('guardar un tipo de clase', () => {
  test('sin id crea; con id edita; y refresca', async () => {
    mocks.createClassType.mockResolvedValue('saved')
    mocks.updateClassType.mockResolvedValue('saved')

    expect(await saveClassTypeAction({}, form(valid))).toEqual({ saved: true })
    expect(mocks.createClassType).toHaveBeenCalledWith('http-db', parsed)

    expect(await saveClassTypeAction({}, form({ ...valid, id: TYPE_ID }))).toEqual({ saved: true })
    expect(mocks.updateClassType).toHaveBeenCalledWith('http-db', TYPE_ID, parsed)
    expect(mocks.refresh).toHaveBeenCalledTimes(2)
  })

  test('una individual se guarda con aforo 1 aunque el formulario no lo envíe', async () => {
    mocks.createClassType.mockResolvedValue('saved')
    const data = form({ ...valid, kind: 'individual' })
    data.delete('defaultCapacity')
    await saveClassTypeAction({}, data)
    expect(mocks.createClassType).toHaveBeenCalledWith('http-db', { ...parsed, kind: 'individual', defaultCapacity: 1 })
  })

  test('errores de validación por campo, sin tocar la base de datos', async () => {
    const state = await saveClassTypeAction({}, form({ ...valid, name: '', color: 'black' }))
    expect(state.fieldErrors).toMatchObject({ name: expect.any(String), color: expect.any(String) })
    const capacity = await saveClassTypeAction({}, form({ ...valid, defaultCapacity: '0' }))
    expect(capacity.fieldErrors?.defaultCapacity).toContain('mínimo')
    expect(mocks.createClassType).not.toHaveBeenCalled()
  })

  test('nombre repetido: error en el nombre y sin refrescar', async () => {
    mocks.createClassType.mockResolvedValue('duplicate')
    const state = await saveClassTypeAction({}, form(valid))
    expect(state.fieldErrors?.name).toContain('Ya hay')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  test('un id que no es un uuid no edita nada', async () => {
    const state = await saveClassTypeAction({}, form({ ...valid, id: "' or 1=1 --" }))
    expect(state.error).toBeDefined()
    expect(mocks.updateClassType).not.toHaveBeenCalled()
  })
})

describe('activar, desactivar y eliminar', () => {
  test('desactivar y activar', async () => {
    mocks.setClassTypeActive.mockResolvedValue(true)
    expect((await setClassTypeActiveAction(TYPE_ID, false)).message).toContain('desactivado')
    expect(mocks.setClassTypeActive).toHaveBeenCalledWith('http-db', TYPE_ID, false)
    expect((await setClassTypeActiveAction(TYPE_ID, 'true')).ok).toBe(false)
  })

  test('eliminar uno en uso propone desactivarlo', async () => {
    mocks.deleteClassType.mockResolvedValue('in_use')
    const result = await deleteClassTypeAction(TYPE_ID)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('Desactívalo')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  test('eliminar uno sin usar', async () => {
    mocks.deleteClassType.mockResolvedValue('deleted')
    expect((await deleteClassTypeAction(TYPE_ID)).ok).toBe(true)
    expect(mocks.deleteClassType).toHaveBeenCalledWith('http-db', TYPE_ID)
  })

  test.each([
    ['un cliente', 'client', 'active'],
    ['un entrenador', 'coach', 'active'],
    ['un administrador de baja', 'admin', 'inactive'],
  ])('%s no puede, aunque llame a las acciones directamente', async (_name, role, status) => {
    as(role, status)
    await expect(saveClassTypeAction({}, form(valid))).rejects.toThrow('NEXT_REDIRECT')
    await expect(setClassTypeActiveAction(TYPE_ID, false)).rejects.toThrow('NEXT_REDIRECT')
    await expect(deleteClassTypeAction(TYPE_ID)).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.createClassType).not.toHaveBeenCalled()
    expect(mocks.setClassTypeActive).not.toHaveBeenCalled()
    expect(mocks.deleteClassType).not.toHaveBeenCalled()
  })
})

describe('/admin/tipos-clase', () => {
  test('lista los tipos con su resumen y marca los inactivos', async () => {
    mocks.listClassTypes.mockResolvedValue([
      type(),
      type({ id: 'b', name: 'Entrenamiento personal', kind: 'individual', defaultCapacity: 1, color: 'violet', isActive: false }),
    ])
    render(await TiposClasePage())
    expect(screen.getByText('Grupal · 12 plazas · 60 min · Naranja')).toBeDefined()
    expect(screen.getByText('Individual · 60 min · Violeta')).toBeDefined()
    expect(screen.getByText('Inactivo')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Desactivar CrossTraining' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Activar Entrenamiento personal' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Nuevo tipo' })).toBeDefined()
  })

  test('sin tipos: estado vacío', async () => {
    mocks.listClassTypes.mockResolvedValue([])
    render(await TiposClasePage())
    expect(screen.getByText('Aún no hay tipos de clase')).toBeDefined()
  })

  test('el formulario fija el aforo en 1 al elegir individual', async () => {
    mocks.listClassTypes.mockResolvedValue([type()])
    render(await TiposClasePage())
    fireEvent.click(screen.getByRole('button', { name: 'Editar CrossTraining' }))
    const dialog = screen.getByRole('dialog')
    expect((within(dialog).getByLabelText('Nombre') as HTMLInputElement).value).toBe('CrossTraining')
    expect((within(dialog).getByRole('radio', { name: 'Naranja' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(within(dialog).getByRole('radio', { name: /Individual/ }))
    const capacity = within(dialog).getByLabelText('Aforo') as HTMLInputElement
    expect(capacity.disabled).toBe(true)
    expect(capacity.value).toBe('1')
  })
})

test('«Más» enlaza a tipos de clase, horario, tarifas y perfil del administrador', () => {
  render(<MasOpcionesPage />)
  const nav = screen.getByRole('navigation', { name: 'Más opciones' })
  expect(within(nav).getByRole('link', { name: /Tipos de clase/ }).getAttribute('href')).toBe('/admin/tipos-clase')
  expect(within(nav).getByRole('link', { name: /Mi perfil/ }).getAttribute('href')).toBe('/admin/perfil')
  expect(within(nav).getByRole('link', { name: /Horario/ }).getAttribute('href')).toBe('/admin/horario')
  expect(within(nav).getByRole('link', { name: /Tarifas/ }).getAttribute('href')).toBe('/admin/tarifas')
})
