import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const SLOT_ID = '7c1e3f0a-6f0c-4d8e-9c1a-0d7e2a4b9c22'
const TYPE_ID = '5b0e3f0a-6f0c-4d8e-9c1a-0d7e2a4b9c11'
const INDIVIDUAL_ID = '5b0e3f0a-6f0c-4d8e-9c1a-0d7e2a4b9c12'
const COACH_ID = '9a0e3f0a-6f0c-4d8e-9c1a-0d7e2a4b9c33'

const mocks = vi.hoisted(() => ({
  viewer: null as unknown,
  listScheduleSlots: vi.fn(),
  listCoaches: vi.fn(),
  listClassTypes: vi.fn(),
  createScheduleSlot: vi.fn(),
  updateScheduleSlot: vi.fn(),
  setScheduleSlotActive: vi.fn(),
  deleteScheduleSlot: vi.fn(),
  generateSessions: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))

// DAL real: sesión y perfil simulados, para comprobar que solo administración llega a los datos
vi.mock('@/lib/auth', () => ({ getAuth: () => ({ getSession: async () => ({ data: { user: { id: TYPE_ID, name: 'X', email: 'x@example.test' } } }) }) }))
vi.mock('@/lib/data/profiles', () => ({ ensureProfile: async () => mocks.viewer, createSignUpProfile: vi.fn(), getMyProfile: vi.fn(), updateMyProfile: vi.fn() }))
vi.mock('@/lib/data/class-types', () => ({ listClassTypes: mocks.listClassTypes }))
vi.mock('@/lib/data/schedule', () => ({
  listScheduleSlots: mocks.listScheduleSlots,
  listCoaches: mocks.listCoaches,
  createScheduleSlot: mocks.createScheduleSlot,
  updateScheduleSlot: mocks.updateScheduleSlot,
  setScheduleSlotActive: mocks.setScheduleSlotActive,
  deleteScheduleSlot: mocks.deleteScheduleSlot,
  generateSessions: mocks.generateSessions,
}))
vi.mock('@/db', () => ({ getDb: () => 'http-db', getTxDb: () => 'tx-db' }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})), headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, unstable_rethrow: vi.fn(), usePathname: () => '/admin/horario' }))
vi.mock('next/cache', () => ({ refresh: mocks.refresh }))

import { deleteScheduleSlotAction, saveScheduleSlotAction, setScheduleSlotActiveAction } from '../app/admin/horario/actions'
import HorarioPage from '../app/admin/horario/page'
import { GET as generateSessionsRoute } from '../app/api/cron/generate-sessions/route'

const as = (role: string, status = 'active') => {
  mocks.viewer = { userId: 'admin-1', fullName: 'Admin', role, isCoach: role === 'coach', status }
}

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}
const valid = { classTypeId: TYPE_ID, weekday: '0', startTime: '09:00', durationMinutes: '60', capacity: '12', coachId: '' }
const parsed = { classTypeId: TYPE_ID, weekday: 0, startTime: '09:00', durationMinutes: 60, capacity: 12, coachId: null }

const classType = (extra = {}) => ({
  id: TYPE_ID,
  name: 'CrossTraining',
  kind: 'group',
  durationMinutes: 60,
  defaultCapacity: 12,
  color: 'orange',
  isActive: true,
  ...extra,
})
const slot = (extra = {}) => ({
  id: SLOT_ID,
  classTypeId: TYPE_ID,
  className: 'CrossTraining',
  kind: 'group',
  color: 'orange',
  classTypeActive: true,
  weekday: 0,
  startTime: '09:00',
  durationMinutes: 60,
  capacity: 12,
  coachId: COACH_ID,
  coachName: 'Laura Coach',
  isActive: true,
  ...extra,
})

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  as('admin')
  mocks.listCoaches.mockResolvedValue([{ userId: COACH_ID, fullName: 'Laura Coach' }])
  mocks.listClassTypes.mockResolvedValue([
    classType(),
    classType({ id: INDIVIDUAL_ID, name: 'Personal', kind: 'individual', durationMinutes: 45, defaultCapacity: 1, color: 'violet' }),
  ])
})

describe('guardar una clase del horario', () => {
  test('sin id crea; con id edita; ambas en transacción y refresca', async () => {
    mocks.createScheduleSlot.mockResolvedValue('saved')
    mocks.updateScheduleSlot.mockResolvedValue('saved')

    expect(await saveScheduleSlotAction({}, form(valid))).toEqual({ saved: true })
    expect(mocks.createScheduleSlot).toHaveBeenCalledWith('tx-db', parsed)

    expect(await saveScheduleSlotAction({}, form({ ...valid, id: SLOT_ID, coachId: COACH_ID }))).toEqual({ saved: true })
    expect(mocks.updateScheduleSlot).toHaveBeenCalledWith('tx-db', SLOT_ID, { ...parsed, coachId: COACH_ID })
    expect(mocks.refresh).toHaveBeenCalledTimes(2)
  })

  test('errores de validación por campo, sin tocar la base de datos', async () => {
    const state = await saveScheduleSlotAction({}, form({ ...valid, startTime: '9', weekday: '8' }))
    expect(state.fieldErrors).toMatchObject({ startTime: expect.any(String), weekday: expect.any(String) })
    expect(mocks.createScheduleSlot).not.toHaveBeenCalled()
  })

  test.each([
    ['invalid_class_type', 'classTypeId'],
    ['invalid_coach', 'coachId'],
  ])('%s: error en su campo y sin refrescar', async (result, field) => {
    mocks.createScheduleSlot.mockResolvedValue(result)
    const state = await saveScheduleSlotAction({}, form(valid))
    expect(state.fieldErrors?.[field as 'coachId']).toContain('activo')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  test('un id que no es un uuid no edita nada', async () => {
    const state = await saveScheduleSlotAction({}, form({ ...valid, id: "' or 1=1 --" }))
    expect(state.error).toBeDefined()
    expect(mocks.updateScheduleSlot).not.toHaveBeenCalled()
  })
})

describe('activar, desactivar y eliminar', () => {
  test('desactivar', async () => {
    mocks.setScheduleSlotActive.mockResolvedValue(true)
    expect((await setScheduleSlotActiveAction(SLOT_ID, false)).message).toContain('desactivada')
    expect(mocks.setScheduleSlotActive).toHaveBeenCalledWith('tx-db', SLOT_ID, false)
    expect((await setScheduleSlotActiveAction(SLOT_ID, 'true')).ok).toBe(false)
  })

  test('eliminar una en uso propone desactivarla', async () => {
    mocks.deleteScheduleSlot.mockResolvedValue('in_use')
    const result = await deleteScheduleSlotAction(SLOT_ID)
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining('Desactívala') })
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  test.each([
    ['un cliente', 'client', 'active'],
    ['un entrenador', 'coach', 'active'],
    ['un administrador de baja', 'admin', 'inactive'],
  ])('%s no puede, aunque llame a las acciones directamente', async (_name, role, status) => {
    as(role, status)
    await expect(saveScheduleSlotAction({}, form(valid))).rejects.toThrow('NEXT_REDIRECT')
    await expect(setScheduleSlotActiveAction(SLOT_ID, false)).rejects.toThrow('NEXT_REDIRECT')
    await expect(deleteScheduleSlotAction(SLOT_ID)).rejects.toThrow('NEXT_REDIRECT')
    await expect(HorarioPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.createScheduleSlot).not.toHaveBeenCalled()
    expect(mocks.setScheduleSlotActive).not.toHaveBeenCalled()
    expect(mocks.deleteScheduleSlot).not.toHaveBeenCalled()
    expect(mocks.listScheduleSlots).not.toHaveBeenCalled()
  })
})

describe('/admin/horario', () => {
  test('agrupa por día con hora, tipo, plazas y entrenador', async () => {
    mocks.listScheduleSlots.mockResolvedValue([
      slot(),
      slot({ id: 'b', weekday: 3, startTime: '18:30', coachId: null, coachName: null, isActive: false }),
    ])
    render(await HorarioPage())
    expect(screen.getByRole('heading', { name: 'Lunes' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Jueves' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Martes' })).toBeNull()
    expect(screen.getByText('09:00 – 10:00')).toBeDefined()
    expect(screen.getByText('12 plazas · Laura Coach')).toBeDefined()
    expect(screen.getByText('12 plazas · Sin entrenador')).toBeDefined()
    expect(screen.getByText('Inactiva')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Activar CrossTraining del jueves a las 18:30' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Nueva clase' })).toBeDefined()
  })

  test('sin franjas: estado vacío', async () => {
    mocks.listScheduleSlots.mockResolvedValue([])
    render(await HorarioPage())
    expect(screen.getByText('El horario está vacío')).toBeDefined()
  })

  test('sin tipos activos: lleva a crearlos y no ofrece «Nueva clase»', async () => {
    mocks.listScheduleSlots.mockResolvedValue([])
    mocks.listClassTypes.mockResolvedValue([classType({ isActive: false })])
    render(await HorarioPage())
    expect(screen.getByRole('link', { name: 'Ir a tipos de clase' }).getAttribute('href')).toBe('/admin/tipos-clase')
    expect(screen.queryByRole('button', { name: 'Nueva clase' })).toBeNull()
  })

  test('el formulario propone duración y aforo del tipo y fija 1 en las individuales', async () => {
    mocks.listScheduleSlots.mockResolvedValue([])
    render(await HorarioPage())
    fireEvent.click(screen.getByRole('button', { name: 'Nueva clase' }))
    const dialog = screen.getByRole('dialog')
    expect((within(dialog).getByLabelText('Aforo') as HTMLInputElement).value).toBe('12')
    fireEvent.change(within(dialog).getByLabelText('Tipo de clase'), { target: { value: INDIVIDUAL_ID } })
    expect((within(dialog).getByLabelText('Duración (min)') as HTMLInputElement).value).toBe('45')
    const capacity = within(dialog).getByLabelText('Aforo') as HTMLInputElement
    expect(capacity.disabled).toBe(true)
    expect(capacity.value).toBe('1')
    expect(within(dialog).getByRole('option', { name: 'Laura Coach' })).toBeDefined()
  })
})

describe('cron generate-sessions', () => {
  const call = (authorization?: string) =>
    generateSessionsRoute(new Request('http://localhost/api/cron/generate-sessions', { headers: authorization ? { authorization } : {} }))

  test('con CRON_SECRET genera y responde cuántas ha creado', async () => {
    vi.stubEnv('CRON_SECRET', 'secreto-de-prueba')
    mocks.generateSessions.mockResolvedValue(3)
    const response = await call('Bearer secreto-de-prueba')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ created: 3 })
    expect(mocks.generateSessions).toHaveBeenCalledWith('http-db')
  })

  test.each([
    ['sin cabecera', 'secreto-de-prueba', undefined],
    ['con otro secreto', 'secreto-de-prueba', 'Bearer otro'],
    ['sin CRON_SECRET configurado', '', 'Bearer '],
  ])('401 %s', async (_name, secret, authorization) => {
    vi.stubEnv('CRON_SECRET', secret)
    expect((await call(authorization)).status).toBe(401)
    expect(mocks.generateSessions).not.toHaveBeenCalled()
  })
})
