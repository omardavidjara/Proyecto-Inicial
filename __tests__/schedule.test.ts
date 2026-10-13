// @vitest-environment node
// Plantilla semanal y generación de sesiones (F3): validación y capa de datos sobre Postgres real (PGlite).
import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { bookings, classTypes, profiles, scheduleSlots, sessions } from '@/db/schema'
import {
  createScheduleSlot,
  deleteScheduleSlot,
  generateSessions,
  listCoaches,
  listScheduleSlots,
  setScheduleSlotActive,
  updateScheduleSlot,
} from '@/lib/data/schedule'
import { scheduleSlotSchema, type ScheduleSlotInput } from '@/lib/validation/schedule'

import { createTestDb, type TestDb } from './helpers/test-db'

let db: TestDb
let close: () => Promise<void>

// Lunes 25 de marzo de 2030 a las 8:00 en Madrid (UTC+1). El domingo 31 cambia la hora (UTC+2).
const NOW = new Date('2030-03-25T07:00:00Z')

let groupType: string
let individualType: string
let inactiveType: string
const coachId = randomUUID()
const clientId = randomUUID()

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
  const types = await db
    .insert(classTypes)
    .values([
      { name: 'CrossTraining', kind: 'group', durationMinutes: 60, defaultCapacity: 12, color: 'orange' },
      { name: 'Personal', kind: 'individual', durationMinutes: 45, defaultCapacity: 1, color: 'violet' },
      { name: 'Antigua', kind: 'group', durationMinutes: 60, defaultCapacity: 10, color: 'red', isActive: false },
    ])
    .returning({ id: classTypes.id })
  ;[groupType, individualType, inactiveType] = types.map((t) => t.id)
  await db.insert(profiles).values([
    { userId: coachId, fullName: 'Laura Coach', role: 'coach', isCoach: true, status: 'active' },
    { userId: clientId, fullName: 'Cliente', role: 'client', status: 'active' },
  ])
}, 60_000)

afterAll(async () => {
  await close()
})

beforeEach(async () => {
  await db.delete(bookings)
  await db.delete(sessions)
  await db.delete(scheduleSlots)
})

const input = (overrides: Partial<ScheduleSlotInput> = {}): ScheduleSlotInput => ({
  classTypeId: groupType,
  weekday: 0,
  startTime: '09:00',
  durationMinutes: 60,
  capacity: 12,
  coachId: null,
  ...overrides,
})

const slotSessions = async () =>
  (await db.select().from(sessions).orderBy(sessions.startsAt)).map((s) => ({ ...s, startsAt: s.startsAt.toISOString() }))

const onlySlotId = async () => (await listScheduleSlots(db))[0].id

describe('validación del formulario', () => {
  test('convierte los números y acepta "sin entrenador"', () => {
    const parsed = scheduleSlotSchema.parse({
      classTypeId: groupType,
      weekday: '2',
      startTime: '18:30',
      durationMinutes: '60',
      capacity: '14',
      coachId: '',
    })
    expect(parsed).toMatchObject({ weekday: 2, durationMinutes: 60, capacity: 14, coachId: null })
  })

  test.each([
    ['tipo no válido', { classTypeId: 'x' }, 'classTypeId'],
    ['día fuera de rango', { weekday: '7' }, 'weekday'],
    ['hora mal escrita', { startTime: '25:00' }, 'startTime'],
    ['duración demasiado corta', { durationMinutes: '2' }, 'durationMinutes'],
    ['aforo 0', { capacity: '0' }, 'capacity'],
    ['entrenador no válido', { coachId: 'abc' }, 'coachId'],
  ])('rechaza %s', (_, overrides, field) => {
    const result = scheduleSlotSchema.safeParse({ ...input(), ...overrides })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((i) => i.path[0])).toContain(field)
  })
})

describe('generación de sesiones', () => {
  test('crea las de las próximas 4 semanas en hora de Madrid, también tras el cambio de hora', async () => {
    expect(await createScheduleSlot(db, input({ coachId }), NOW)).toBe('saved')
    const created = await slotSessions()
    // Lunes 25 mar (UTC+1), 1, 8 y 15 abr (UTC+2): 4 lunes desde hoy
    expect(created.map((s) => s.startsAt)).toEqual([
      '2030-03-25T08:00:00.000Z',
      '2030-04-01T07:00:00.000Z',
      '2030-04-08T07:00:00.000Z',
      '2030-04-15T07:00:00.000Z',
    ])
    expect(created[0]).toMatchObject({ capacity: 12, coachId, slotDate: '2030-03-25', isCustomized: false, status: 'scheduled' })
    expect(created[0].endsAt.getTime() - new Date(created[0].startsAt).getTime()).toBe(3_600_000)
  })

  test('no crea sesiones que ya han empezado', async () => {
    await createScheduleSlot(db, input({ startTime: '07:30' }), NOW)
    expect((await slotSessions())[0].slotDate).toBe('2030-04-01')
  })

  test('es idempotente y no recrea una sesión movida o cancelada', async () => {
    await createScheduleSlot(db, input(), NOW)
    const [first] = await slotSessions()
    await db.update(sessions).set({ status: 'cancelled', isCustomized: true }).where(eq(sessions.id, first.id))
    expect(await generateSessions(db, NOW)).toBe(0)
    expect(await slotSessions()).toHaveLength(4)
    // Al día siguiente entra en la ventana el lunes 22 de abril
    expect(await generateSessions(db, new Date('2030-03-26T07:00:00Z'))).toBe(1)
  })

  test('las clases individuales tienen siempre aforo 1', async () => {
    await createScheduleSlot(db, input({ classTypeId: individualType, capacity: 8 }), NOW)
    expect((await listScheduleSlots(db))[0].capacity).toBe(1)
    expect((await slotSessions()).every((s) => s.capacity === 1)).toBe(true)
  })
})

describe('franjas', () => {
  test('no acepta un tipo inactivo ni alguien que no es entrenador', async () => {
    expect(await createScheduleSlot(db, input({ classTypeId: inactiveType }), NOW)).toBe('invalid_class_type')
    expect(await createScheduleSlot(db, input({ classTypeId: randomUUID() }), NOW)).toBe('invalid_class_type')
    expect(await createScheduleSlot(db, input({ coachId: clientId }), NOW)).toBe('invalid_coach')
    expect(await listScheduleSlots(db)).toEqual([])
  })

  test('lista con nombre del tipo y del entrenador', async () => {
    await createScheduleSlot(db, input({ weekday: 2, startTime: '18:30', coachId }), NOW)
    await createScheduleSlot(db, input({ weekday: 2, startTime: '07:00' }), NOW)
    const list = await listScheduleSlots(db)
    expect(list.map((s) => s.startTime)).toEqual(['07:00', '18:30'])
    expect(list[1]).toMatchObject({ className: 'CrossTraining', color: 'orange', coachName: 'Laura Coach', isActive: true })
  })

  test('editar rehace las sesiones intactas y respeta las que tienen reservas o cambios', async () => {
    await createScheduleSlot(db, input(), NOW)
    const id = await onlySlotId()
    const [booked, customized] = await slotSessions()
    await db.insert(bookings).values({ sessionId: booked.id, userId: clientId, status: 'confirmed', createdBy: clientId })
    await db.update(sessions).set({ isCustomized: true }).where(eq(sessions.id, customized.id))

    expect(await updateScheduleSlot(db, id, input({ startTime: '10:00', capacity: 20, coachId }), NOW)).toBe('saved')
    const after = await slotSessions()
    expect(after).toHaveLength(4)
    expect(after.find((s) => s.id === booked.id)).toMatchObject({ capacity: 12, coachId: null })
    expect(after.find((s) => s.id === customized.id)).toMatchObject({ capacity: 12 })
    const rebuilt = after.filter((s) => s.id !== booked.id && s.id !== customized.id)
    expect(rebuilt.map((s) => s.startsAt)).toEqual(['2030-04-08T08:00:00.000Z', '2030-04-15T08:00:00.000Z'])
    expect(rebuilt.every((s) => s.capacity === 20 && s.coachId === coachId)).toBe(true)
  })

  test('cambiar de día crea las sesiones del día nuevo', async () => {
    await createScheduleSlot(db, input(), NOW)
    await updateScheduleSlot(db, await onlySlotId(), input({ weekday: 1 }), NOW)
    expect((await slotSessions()).map((s) => s.slotDate)).toEqual(['2030-03-26', '2030-04-02', '2030-04-09', '2030-04-16'])
  })

  test('se puede editar una franja cuyo tipo se ha desactivado, sin cambiarle el tipo', async () => {
    await createScheduleSlot(db, input(), NOW)
    const id = await onlySlotId()
    await db.update(classTypes).set({ isActive: false }).where(eq(classTypes.id, groupType))
    try {
      expect(await updateScheduleSlot(db, id, input({ capacity: 8 }), NOW)).toBe('saved')
      expect(await updateScheduleSlot(db, id, input({ classTypeId: inactiveType }), NOW)).toBe('invalid_class_type')
    } finally {
      await db.update(classTypes).set({ isActive: true }).where(eq(classTypes.id, groupType))
    }
  })

  test('editar una franja que no existe', async () => {
    expect(await updateScheduleSlot(db, randomUUID(), input(), NOW)).toBe('not_found')
  })

  test('desactivar quita las sesiones intactas y activar las vuelve a crear', async () => {
    await createScheduleSlot(db, input(), NOW)
    const id = await onlySlotId()
    const [booked] = await slotSessions()
    await db.insert(bookings).values({ sessionId: booked.id, userId: clientId, status: 'confirmed', createdBy: clientId })

    expect(await setScheduleSlotActive(db, id, false, NOW)).toBe(true)
    expect((await slotSessions()).map((s) => s.id)).toEqual([booked.id])
    expect(await generateSessions(db, NOW)).toBe(0)

    expect(await setScheduleSlotActive(db, id, true, NOW)).toBe(true)
    expect(await slotSessions()).toHaveLength(4)
    expect(await setScheduleSlotActive(db, randomUUID(), true, NOW)).toBe(false)
  })

  test('eliminar borra la franja y sus sesiones intactas', async () => {
    await createScheduleSlot(db, input(), NOW)
    expect(await deleteScheduleSlot(db, await onlySlotId(), NOW)).toBe('deleted')
    expect(await slotSessions()).toEqual([])
    expect(await deleteScheduleSlot(db, randomUUID(), NOW)).toBe('not_found')
  })

  test('no se elimina si ya tiene sesiones con reservas o pasadas: no toca nada', async () => {
    await createScheduleSlot(db, input(), NOW)
    const id = await onlySlotId()
    const [booked] = await slotSessions()
    await db.insert(bookings).values({ sessionId: booked.id, userId: clientId, status: 'confirmed', createdBy: clientId })
    expect(await deleteScheduleSlot(db, id, NOW)).toBe('in_use')
    expect(await slotSessions()).toHaveLength(4)

    await db.delete(bookings)
    // Una semana después, la primera ya es pasada
    expect(await deleteScheduleSlot(db, id, new Date('2030-03-26T07:00:00Z'))).toBe('in_use')
  })
})

describe('entrenadores', () => {
  test('solo perfiles de entrenador activos', async () => {
    expect(await listCoaches(db)).toEqual([{ userId: coachId, fullName: 'Laura Coach' }])
  })
})
