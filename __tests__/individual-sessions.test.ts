// @vitest-environment node
// Sesión individual del entrenador (F7) sobre Postgres real (PGlite): aforo 1, él como entrenador, reserva
// confirmada del cliente que gasta clase de la tarifa; se salta la ventana de reserva pero no la tarifa.
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { bookings, classTypes, memberships, plans, profiles, sessions } from '@/db/schema'
import { createIndividualSession, listIndividualClassTypes, searchActiveClients } from '@/lib/data/individual-sessions'
import { countUsedClasses } from '@/lib/data/memberships'

import { createTestDb, type TestDb } from './helpers/test-db'

let db: TestDb
let close: () => Promise<void>
let individualId: string
let groupId: string
let planId: string
let coach: string

// Miércoles 14 de octubre de 2026, 10:00 en Madrid
const now = new Date('2026-10-14T08:00:00Z')

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
  const [individual] = await db
    .insert(classTypes)
    .values({ name: 'Entrenamiento personal', kind: 'individual', durationMinutes: 45, defaultCapacity: 1, color: 'teal' })
    .returning()
  individualId = individual.id
  await db.insert(classTypes).values({ name: 'Personal antiguo', kind: 'individual', durationMinutes: 60, defaultCapacity: 1, color: 'teal', isActive: false })
  const [group] = await db.insert(classTypes).values({ name: 'Funcional', durationMinutes: 60, defaultCapacity: 12, color: 'orange' }).returning()
  groupId = group.id
  const [plan] = await db.insert(plans).values({ name: '1 a la semana', period: 'week', classesPerPeriod: 1 }).returning()
  planId = plan.id
  coach = randomUUID()
  await db.insert(profiles).values({ userId: coach, fullName: 'Laura', role: 'coach', isCoach: true, status: 'active' })
}, 60_000)

afterAll(async () => {
  await close()
})

async function client(fullName = 'Cliente', status: 'active' | 'pending' | 'inactive' = 'active', withPlan = true) {
  const userId = randomUUID()
  await db.insert(profiles).values({ userId, fullName, status })
  if (withPlan) await db.insert(memberships).values({ userId, planId, startsOn: '2026-01-01' })
  return userId
}

const input = (clientId: string, extra = {}) => ({ classTypeId: individualId, date: '2026-10-16', startTime: '18:00', clientId, ...extra })

describe('crear', () => {
  test('aforo 1, duración del tipo, él como entrenador y la reserva del cliente gasta clase', async () => {
    const ana = await client('Ana')
    const result = await createIndividualSession(db, coach, input(ana), now)
    expect(result.status).toBe('created')
    if (result.status !== 'created') return
    const [session] = await db.select().from(sessions).where(eq(sessions.id, result.sessionId))
    expect(session).toMatchObject({ capacity: 1, coachId: coach, slotId: null, classTypeId: individualId, status: 'scheduled' })
    expect(session.startsAt.toISOString()).toBe('2026-10-16T16:00:00.000Z')
    expect(session.endsAt.getTime() - session.startsAt.getTime()).toBe(45 * 60_000)
    const rows = await db.select().from(bookings).where(eq(bookings.sessionId, result.sessionId))
    expect(rows).toEqual([expect.objectContaining({ userId: ana, status: 'confirmed', createdBy: coach })])
    expect(await countUsedClasses(db, ana, 'week', '2026-10-16')).toBe(1)
  })

  test('se salta la ventana de reserva', async () => {
    const result = await createIndividualSession(db, coach, input(await client(), { date: '2027-03-01' }), now)
    expect(result.status).toBe('created')
  })

  test('sin clases libres o sin tarifa, no se crea nada', async () => {
    const bea = await client('Bea')
    expect((await createIndividualSession(db, coach, input(bea), now)).status).toBe('created')
    const before = await db.$count(sessions)
    expect((await createIndividualSession(db, coach, input(bea, { startTime: '19:00' }), now)).status).toBe('no_classes_left')
    expect((await createIndividualSession(db, coach, input(await client('Sin', 'active', false)), now)).status).toBe('no_plan')
    expect(await db.$count(sessions)).toBe(before)
  })

  test('cliente pendiente, de baja, otro rol o inexistente', async () => {
    expect((await createIndividualSession(db, coach, input(await client('P', 'pending')), now)).status).toBe('client_not_active')
    expect((await createIndividualSession(db, coach, input(await client('B', 'inactive')), now)).status).toBe('client_not_active')
    expect((await createIndividualSession(db, coach, input(coach), now)).status).toBe('client_not_active')
    expect((await createIndividualSession(db, coach, input(randomUUID()), now)).status).toBe('client_not_active')
  })

  test('tipo grupal, inactivo o inexistente', async () => {
    const ana = await client()
    const [inactive] = await db.select().from(classTypes).where(eq(classTypes.name, 'Personal antiguo'))
    for (const classTypeId of [groupId, inactive.id, randomUUID()]) {
      expect((await createIndividualSession(db, coach, input(ana, { classTypeId }), now)).status).toBe('invalid_class_type')
    }
  })

  test('a una hora pasada', async () => {
    const result = await createIndividualSession(db, coach, input(await client(), { date: '2026-10-14', startTime: '09:00' }), now)
    expect(result.status).toBe('past')
  })

  test('quien no es entrenador activo no puede', async () => {
    const notCoach = randomUUID()
    await db.insert(profiles).values({ userId: notCoach, fullName: 'Admin', role: 'admin', isCoach: false, status: 'active' })
    expect((await createIndividualSession(db, notCoach, input(await client()), now)).status).toBe('invalid_coach')
  })
})

describe('opciones del diálogo', () => {
  test('solo tipos individuales activos', async () => {
    expect(await listIndividualClassTypes(db)).toEqual([{ id: individualId, name: 'Entrenamiento personal', durationMinutes: 45 }])
  })

  test('busca clientes activos por nombre, sin pendientes ni personal', async () => {
    await client('Marta Ruiz')
    await client('Marta Pendiente', 'pending')
    const found = await searchActiveClients(db, 'marta')
    expect(found.map((c) => c.fullName)).toEqual(['Marta Ruiz'])
    expect(await searchActiveClients(db, 'Lau')).toEqual([])
    expect(await searchActiveClients(db, 'M')).toEqual([])
  })
})
