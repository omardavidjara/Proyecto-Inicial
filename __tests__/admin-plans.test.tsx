import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const PLAN_ID = '5b0e3f0a-6f0c-4d8e-9c1a-0d7e2a4b9c22'

const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  listPlans: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  setPlanActive: vi.fn(),
  deletePlan: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))

// DAL real: sesión y perfil simulados, para comprobar que solo administración llega a los datos
vi.mock('@/lib/auth', () => ({ getAuth: () => ({ getSession: async () => ({ data: { user: { id: PLAN_ID, name: 'X', email: 'x@example.test' } } }) }) }))
vi.mock('@/lib/data/profiles', () => ({ ensureProfile: async () => mocks.viewer, createSignUpProfile: vi.fn(), getMyProfile: vi.fn(), updateMyProfile: vi.fn() }))
vi.mock('@/lib/data/plans', () => ({
  listPlans: mocks.listPlans,
  createPlan: mocks.createPlan,
  updatePlan: mocks.updatePlan,
  setPlanActive: mocks.setPlanActive,
  deletePlan: mocks.deletePlan,
}))
vi.mock('@/db', () => ({ getDb: () => 'http-db', getTxDb: () => 'tx-db' }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, unstable_rethrow: vi.fn(), usePathname: () => '/admin/tarifas' }))
vi.mock('next/cache', () => ({ refresh: mocks.refresh }))

import { deletePlanAction, savePlanAction, setPlanActiveAction } from '../app/admin/tarifas/actions'
import TarifasPage from '../app/admin/tarifas/page'

const as = (role: string, status = 'active') => {
  mocks.viewer = { userId: 'admin-1', fullName: 'Admin Prueba', role, isCoach: role === 'coach', status, phone: '600000000' }
}

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}
const valid = { name: 'Bono 8', period: 'month', classesPerPeriod: '8' }
const parsed = { name: 'Bono 8', period: 'month', classesPerPeriod: 8 }

const plan = (extra = {}) => ({
  id: PLAN_ID,
  name: '3 a la semana',
  period: 'week',
  classesPerPeriod: 3,
  isActive: true,
  clients: 4,
  ...extra,
})

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  as('admin')
})

describe('guardar una tarifa', () => {
  test('sin id crea; con id edita; y refresca', async () => {
    mocks.createPlan.mockResolvedValue('saved')
    mocks.updatePlan.mockResolvedValue('saved')

    expect(await savePlanAction({}, form(valid))).toEqual({ saved: true })
    expect(mocks.createPlan).toHaveBeenCalledWith('http-db', parsed)

    expect(await savePlanAction({}, form({ ...valid, id: PLAN_ID }))).toEqual({ saved: true })
    expect(mocks.updatePlan).toHaveBeenCalledWith('http-db', PLAN_ID, parsed)
    expect(mocks.refresh).toHaveBeenCalledTimes(2)
  })

  test('una ilimitada se guarda sin cupo aunque el formulario no lo envíe', async () => {
    mocks.createPlan.mockResolvedValue('saved')
    const data = form({ ...valid, period: 'unlimited' })
    data.delete('classesPerPeriod')
    await savePlanAction({}, data)
    expect(mocks.createPlan).toHaveBeenCalledWith('http-db', { ...parsed, period: 'unlimited', classesPerPeriod: null })
  })

  test('errores de validación por campo, sin tocar la base de datos', async () => {
    const state = await savePlanAction({}, form({ ...valid, name: '', period: 'year' }))
    expect(state.fieldErrors).toMatchObject({ name: expect.any(String), period: expect.any(String) })
    const classes = await savePlanAction({}, form({ ...valid, classesPerPeriod: '0' }))
    expect(classes.fieldErrors?.classesPerPeriod).toContain('mínimo')
    expect(mocks.createPlan).not.toHaveBeenCalled()
  })

  test('nombre repetido: error en el nombre y sin refrescar', async () => {
    mocks.createPlan.mockResolvedValue('duplicate')
    const state = await savePlanAction({}, form(valid))
    expect(state.fieldErrors?.name).toContain('Ya hay')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  test('un id que no es un uuid no edita nada', async () => {
    const state = await savePlanAction({}, form({ ...valid, id: "' or 1=1 --" }))
    expect(state.error).toBeDefined()
    expect(mocks.updatePlan).not.toHaveBeenCalled()
  })
})

describe('activar, desactivar y eliminar', () => {
  test('desactivar y activar', async () => {
    mocks.setPlanActive.mockResolvedValue(true)
    expect((await setPlanActiveAction(PLAN_ID, false)).message).toContain('desactivada')
    expect(mocks.setPlanActive).toHaveBeenCalledWith('http-db', PLAN_ID, false)
    expect((await setPlanActiveAction(PLAN_ID, 'true')).ok).toBe(false)
  })

  test('eliminar una ya asignada propone desactivarla', async () => {
    mocks.deletePlan.mockResolvedValue('in_use')
    const result = await deletePlanAction(PLAN_ID)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('Desactívala')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  test('eliminar una sin asignar', async () => {
    mocks.deletePlan.mockResolvedValue('deleted')
    expect((await deletePlanAction(PLAN_ID)).ok).toBe(true)
    expect(mocks.deletePlan).toHaveBeenCalledWith('http-db', PLAN_ID)
  })

  test.each([
    ['un cliente', 'client', 'active'],
    ['un entrenador', 'coach', 'active'],
    ['un administrador de baja', 'admin', 'inactive'],
  ])('%s no puede, aunque llame a las acciones directamente', async (_name, role, status) => {
    as(role, status)
    await expect(savePlanAction({}, form(valid))).rejects.toThrow('NEXT_REDIRECT')
    await expect(setPlanActiveAction(PLAN_ID, false)).rejects.toThrow('NEXT_REDIRECT')
    await expect(deletePlanAction(PLAN_ID)).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.createPlan).not.toHaveBeenCalled()
    expect(mocks.setPlanActive).not.toHaveBeenCalled()
    expect(mocks.deletePlan).not.toHaveBeenCalled()
  })
})

describe('/admin/tarifas', () => {
  test('lista las tarifas con su límite y clientes, y marca las inactivas', async () => {
    mocks.listPlans.mockResolvedValue([
      plan(),
      plan({ id: 'b', name: 'Libre', period: 'unlimited', classesPerPeriod: null, isActive: false, clients: 1 }),
    ])
    render(await TarifasPage())
    expect(screen.getByText('3 clases / semana · 4 clientes')).toBeDefined()
    expect(screen.getByText('Ilimitada · 1 cliente')).toBeDefined()
    expect(screen.getByText('Inactiva')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Desactivar 3 a la semana' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Activar Libre' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Nueva tarifa' })).toBeDefined()
  })

  test('sin tarifas: estado vacío', async () => {
    mocks.listPlans.mockResolvedValue([])
    render(await TarifasPage())
    expect(screen.getByText('Aún no hay tarifas')).toBeDefined()
  })

  test('al editar avisa de a cuántos clientes afecta y oculta el cupo si es ilimitada', async () => {
    mocks.listPlans.mockResolvedValue([plan()])
    render(await TarifasPage())
    fireEvent.click(screen.getByRole('button', { name: 'Editar 3 a la semana' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/los 4 clientes que la tienen/)).toBeDefined()
    expect((within(dialog).getByLabelText('Clases por semana') as HTMLInputElement).value).toBe('3')
    fireEvent.click(within(dialog).getByRole('radio', { name: /Ilimitada/ }))
    expect(within(dialog).queryByLabelText(/Clases por/)).toBeNull()
  })
})
