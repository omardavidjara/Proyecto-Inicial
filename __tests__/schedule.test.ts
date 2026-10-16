// @vitest-environment node
// Plantilla semanal, generación y próximas sesiones (F3): validación y capa de datos sobre Postgres real (PGlite).
import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { bookings, classTypes, profiles, scheduleSlots, sessions } from '@/db/schema'
import {
  cancelSession,
  createOneOffSession,
  createScheduleSlot,
  deleteScheduleSlot,
  generateSessions,
  getCoach,
  listCoaches,
  listScheduleSlots,
  listUpcomingSessions,
  setScheduleSlotActive,
  updateScheduleSlot,
  updateSession,
} from '@/lib/data/schedule'
import {
  cancelReasonSchema,
  oneOffSessionSchema,
  scheduleSlotSchema,
  sessionSchema,
  type OneOffSessionInput,
  type ScheduleSlotInput,
} from '@/lib/validation/schedule'

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

  test('getCoach: un entrenador activo por id; un cliente o un id desconocido no lo son', async () => {
    expect(await getCoach(db, coachId)).toEqual({ userId: coachId, fullName: 'Laura Coach' })
    expect(await getCoach(db, clientId)).toBeNull()
    expect(await getCoach(db, randomUUID())).toBeNull()
  })
})

describe('próximas sesiones', () => {
  const otherClient = randomUUID()
  const session = (overrides: Partial<OneOffSessionInput> = {}): OneOffSessionInput => ({
    classTypeId: groupType,
    date: '2030-03-27',
    startTime: '18:30',
    durationMinutes: 60,
    capacity: 10,
    coachId: null,
    ...overrides,
  })
  const book = (sessionId: string, userId: string, status: 'confirmed' | 'waitlisted' = 'confirmed') =>
    db.insert(bookings).values({ sessionId, userId, status, createdBy: userId, waitlistedAt: status === 'waitlisted' ? NOW : null })
  const byId = async (id: string) => (await db.select().from(sessions).where(eq(sessions.id, id)))[0]

  beforeAll(async () => {
    await db.insert(profiles).values({ userId: otherClient, fullName: 'Otra', role: 'client', status: 'active' })
  })

  test('validación: fecha real y motivo recortado', () => {
    expect(sessionSchema.safeParse({ ...session(), date: '2030-02-30' }).success).toBe(false)
    expect(oneOffSessionSchema.parse({ ...session(), durationMinutes: '45', capacity: '8', coachId: '' })).toMatchObject({
      durationMinutes: 45,
      capacity: 8,
      coachId: null,
    })
    expect(cancelReasonSchema.parse('  ')).toBeNull()
  })

  test('crear una suelta: hora de Madrid, sin franja; individual con aforo 1', async () => {
    expect(await createOneOffSession(db, session({ coachId }), NOW)).toBe('saved')
    expect(await createOneOffSession(db, session({ classTypeId: individualType, date: '2030-04-02', startTime: '10:00' }), NOW)).toBe('saved')
    const [group, individual] = await slotSessions()
    expect(group).toMatchObject({ startsAt: '2030-03-27T17:30:00.000Z', slotId: null, slotDate: null, capacity: 10, coachId })
    expect(group.endsAt.toISOString()).toBe('2030-03-27T18:30:00.000Z')
    // Tras el cambio de hora (UTC+2)
    expect(individual).toMatchObject({ startsAt: '2030-04-02T08:00:00.000Z', capacity: 1 })
  })

  test('no crea una suelta en el pasado, con un tipo inactivo o con alguien que no es entrenador', async () => {
    expect(await createOneOffSession(db, session({ date: '2030-03-25', startTime: '07:30' }), NOW)).toBe('past')
    expect(await createOneOffSession(db, session({ classTypeId: inactiveType }), NOW)).toBe('invalid_class_type')
    expect(await createOneOffSession(db, session({ coachId: clientId }), NOW)).toBe('invalid_coach')
    expect(await slotSessions()).toHaveLength(0)
  })

  test('listar: solo las que no han empezado, con reservas confirmadas y en espera', async () => {
    await createScheduleSlot(db, input({ capacity: 1 }), NOW)
    const [first] = await slotSessions()
    await book(first.id, clientId)
    await book(first.id, otherClient, 'waitlisted')
    await createOneOffSession(db, session(), NOW)

    // A las 10:00 ya ha empezado la de las 9:00
    expect((await listUpcomingSessions(db, new Date('2030-03-25T09:00:00Z'))).map((s) => s.id)).not.toContain(first.id)
    const rows = await listUpcomingSessions(db, NOW)
    expect(rows).toHaveLength(5)
    expect(rows[0]).toMatchObject({ id: first.id, booked: 1, waitlisted: 1, isOneOff: false, className: 'CrossTraining' })
    expect(rows.find((s) => s.isOneOff)).toMatchObject({ booked: 0, startsAt: new Date('2030-03-27T17:30:00Z') })
  })

  test('mover y cambiar entrenador o aforo la marca como cambiada: la plantilla ya no la toca', async () => {
    await createScheduleSlot(db, input(), NOW)
    const id = await onlySlotId()
    const [first] = await slotSessions()
    const edit = { date: '2030-03-26', startTime: '19:00', durationMinutes: 45, capacity: 8, coachId }
    expect(await updateSession(db, first.id, edit, NOW)).toBe('saved')
    const moved = await byId(first.id)
    expect(moved).toMatchObject({ isCustomized: true, capacity: 8, coachId, slotDate: '2030-03-25' })
    expect(moved.startsAt.toISOString()).toBe('2030-03-26T18:00:00.000Z')
    expect(moved.endsAt.toISOString()).toBe('2030-03-26T18:45:00.000Z')

    await updateScheduleSlot(db, id, input({ startTime: '10:00' }), NOW)
    expect((await byId(first.id)).startsAt.toISOString()).toBe('2030-03-26T18:00:00.000Z')
  })

  test('guardar sin cambios no la aparta de la plantilla', async () => {
    await createScheduleSlot(db, input(), NOW)
    const [first] = await slotSessions()
    const same = { date: '2030-03-25', startTime: '09:00', durationMinutes: 60, capacity: 12, coachId: null }
    expect(await updateSession(db, first.id, same, NOW)).toBe('saved')
    expect((await byId(first.id)).isCustomized).toBe(false)
  })

  test('el aforo no baja de las reservas confirmadas; una individual sigue con 1', async () => {
    await createOneOffSession(db, session(), NOW)
    await createOneOffSession(db, session({ classTypeId: individualType, startTime: '20:00' }), NOW)
    const [group, individual] = await slotSessions()
    await book(group.id, clientId)
    await book(group.id, otherClient)
    const edit = { date: '2030-03-27', startTime: '18:30', durationMinutes: 60, coachId: null }
    expect(await updateSession(db, group.id, { ...edit, capacity: 1 }, NOW)).toBe('capacity_below_booked')
    expect(await updateSession(db, group.id, { ...edit, capacity: 2 }, NOW)).toBe('saved')
    expect(await updateSession(db, individual.id, { ...edit, startTime: '20:00', capacity: 5 }, NOW)).toBe('saved')
    expect((await byId(individual.id)).capacity).toBe(1)
  })

  test('no se edita una sesión empezada, cancelada o que no existe, ni se mueve al pasado', async () => {
    await createOneOffSession(db, session(), NOW)
    const [one] = await slotSessions()
    const edit = { date: '2030-03-27', startTime: '18:30', durationMinutes: 60, capacity: 10, coachId: null }
    expect(await updateSession(db, one.id, { ...edit, date: '2030-03-24' }, NOW)).toBe('past')
    expect(await updateSession(db, one.id, edit, new Date('2030-03-27T17:31:00Z'))).toBe('not_editable')
    expect(await updateSession(db, randomUUID(), edit, NOW)).toBe('not_found')
    await cancelSession(db, one.id, null, NOW)
    expect(await updateSession(db, one.id, edit, NOW)).toBe('not_editable')
  })

  test('se puede dejar un entrenador que ya no está disponible, pero no poner a otro que no lo es', async () => {
    const formerCoach = randomUUID()
    await db.insert(profiles).values({ userId: formerCoach, fullName: 'Ex', role: 'client', status: 'inactive' })
    await createOneOffSession(db, session(), NOW)
    const [one] = await slotSessions()
    await db.update(sessions).set({ coachId: formerCoach }).where(eq(sessions.id, one.id))
    const edit = { date: '2030-03-27', startTime: '19:00', durationMinutes: 60, capacity: 10 }
    expect(await updateSession(db, one.id, { ...edit, coachId: formerCoach }, NOW)).toBe('saved')
    expect(await updateSession(db, one.id, { ...edit, coachId: clientId }, NOW)).toBe('invalid_coach')
  })

  test('cancelar anula las reservas vivas, guarda el motivo y la plantilla no la recrea', async () => {
    await createScheduleSlot(db, input(), NOW)
    const id = await onlySlotId()
    const [first] = await slotSessions()
    await book(first.id, clientId)
    await book(first.id, otherClient, 'waitlisted')

    expect(await cancelSession(db, first.id, 'Festivo', NOW)).toEqual({ result: 'cancelled', cancelledBookings: 2 })
    expect(await byId(first.id)).toMatchObject({ status: 'cancelled', cancelReason: 'Festivo' })
    const states = await db.select().from(bookings).where(eq(bookings.sessionId, first.id))
    expect(states.map((b) => b.status)).toEqual(['cancelled', 'cancelled'])
    expect(states.every((b) => b.cancelledAt?.getTime() === NOW.getTime())).toBe(true)

    expect(await generateSessions(db, NOW)).toBe(0)
    await updateScheduleSlot(db, id, input({ startTime: '10:00' }), NOW)
    expect((await byId(first.id)).status).toBe('cancelled')
    expect(await cancelSession(db, first.id, null, NOW)).toEqual({ result: 'not_editable' })
    expect(await cancelSession(db, randomUUID(), null, NOW)).toEqual({ result: 'not_found' })
  })

  test('no se cancela una sesión que ya ha empezado', async () => {
    await createOneOffSession(db, session(), NOW)
    const [one] = await slotSessions()
    expect(await cancelSession(db, one.id, null, new Date('2030-03-27T17:30:00Z'))).toEqual({ result: 'not_editable' })
  })
})
