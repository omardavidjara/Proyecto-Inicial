// @vitest-environment node
// Tarifa de cada cliente (F4) sobre Postgres real (PGlite) con las migraciones: asignar, cambiar, quitar,
// historial, baja y clases que quedan en el periodo.
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { bookings, classTypes, memberships, plans, profiles, sessions } from '@/db/schema'
import { approveClient, changeClientPlan, deactivateClient, listClients, reactivateClient } from '@/lib/data/clients'
import {
  assignPlan,
  countUsedClasses,
  getMembershipOn,
  getPlanSummary,
  listMemberships,
  periodBounds,
} from '@/lib/data/memberships'

import { createTestDb, type TestDb } from './helpers/test-db'

let db: TestDb
let close: () => Promise<void>
let classTypeId: string
let weekly: string
let monthly: string
let unlimited: string
let retired: string

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
  const [type] = await db.insert(classTypes).values({ name: 'Funcional', durationMinutes: 60, defaultCapacity: 10, color: 'orange' }).returning()
  classTypeId = type.id
  const rows = await db
    .insert(plans)
    .values([
      { name: '3 a la semana', period: 'week', classesPerPeriod: 3 },
      { name: 'Bono 8', period: 'month', classesPerPeriod: 8 },
      { name: 'Libre', period: 'unlimited', classesPerPeriod: null },
      { name: 'Antigua', period: 'week', classesPerPeriod: 2, isActive: false },
    ])
    .returning()
  ;[weekly, monthly, unlimited, retired] = rows.map((r) => r.id)
}, 60_000)

afterAll(async () => {
  await close()
})

async function client(status: 'pending' | 'active' | 'inactive' = 'active') {
  const userId = randomUUID()
  await db.insert(profiles).values({ userId, fullName: `Cliente ${userId.slice(0, 4)}`, status })
  return userId
}

const historyOf = async (userId: string) =>
  ((await listMemberships(db, [userId])).get(userId) ?? []).map((m) => [m.planName, m.startsOn, m.endsOn])

/** Sesión a una hora de Madrid (UTC+2 en octubre, UTC+1 desde el 25) */
async function booking(userId: string, startsAt: string, extra: Partial<typeof bookings.$inferInsert> = {}) {
  const start = new Date(startsAt)
  const [session] = await db
    .insert(sessions)
    .values({ classTypeId, startsAt: start, endsAt: new Date(start.getTime() + 3_600_000), capacity: 10 })
    .returning()
  await db.insert(bookings).values({ sessionId: session.id, userId, createdBy: userId, status: 'confirmed', ...extra })
}

describe('periodos', () => {
  test('semana de lunes a domingo y mes natural', () => {
    expect(periodBounds('week', '2026-10-15')).toEqual({ from: '2026-10-12', to: '2026-10-19' })
    expect(periodBounds('week', '2026-10-12')).toEqual({ from: '2026-10-12', to: '2026-10-19' })
    expect(periodBounds('month', '2026-10-31')).toEqual({ from: '2026-10-01', to: '2026-11-01' })
    expect(periodBounds('month', '2026-12-05')).toEqual({ from: '2026-12-01', to: '2027-01-01' })
  })
})

describe('asignar y cambiar', () => {
  test('cambiar desde una fecha cierra la anterior el día antes; el historial queda completo', async () => {
    const id = await client()
    expect(await assignPlan(db, id, weekly, '2026-09-01')).toBe('saved')
    expect(await changeClientPlan(db, id, monthly, '2026-10-13')).toBe('saved')
    expect(await historyOf(id)).toEqual([
      ['Bono 8', '2026-10-13', null],
      ['3 a la semana', '2026-09-01', '2026-10-12'],
    ])
    expect((await getMembershipOn(db, id, '2026-10-12'))?.planName).toBe('3 a la semana')
    expect((await getMembershipOn(db, id, '2026-10-13'))?.planName).toBe('Bono 8')
  })

  test('un cambio nuevo sustituye al programado; el mismo día, corrige la tarifa de ese día', async () => {
    const id = await client()
    await assignPlan(db, id, weekly, '2026-10-01')
    await changeClientPlan(db, id, monthly, '2026-11-01')
    await changeClientPlan(db, id, unlimited, '2026-10-20')
    expect(await historyOf(id)).toEqual([
      ['Libre', '2026-10-20', null],
      ['3 a la semana', '2026-10-01', '2026-10-19'],
    ])
    await changeClientPlan(db, id, monthly, '2026-10-20')
    expect((await historyOf(id))[0]).toEqual(['Bono 8', '2026-10-20', null])
    expect(await historyOf(id)).toHaveLength(2)
  })

  test('quitar la tarifa (sin tarifa) desde una fecha', async () => {
    const id = await client()
    await assignPlan(db, id, weekly, '2026-10-01')
    expect(await changeClientPlan(db, id, null, '2026-10-15')).toBe('saved')
    expect(await historyOf(id)).toEqual([['3 a la semana', '2026-10-01', '2026-10-14']])
    expect(await getMembershipOn(db, id, '2026-10-15')).toBeNull()
  })

  test('no se asigna una tarifa inactiva ni se cambia a quien no está activo', async () => {
    const id = await client()
    expect(await changeClientPlan(db, id, retired, '2026-10-13')).toBe('plan_not_found')
    expect(await historyOf(id)).toEqual([])
    expect(await changeClientPlan(db, await client('inactive'), weekly, '2026-10-13')).toBe('not_found')
    expect(await changeClientPlan(db, await client('pending'), weekly, '2026-10-13')).toBe('not_found')
  })

  test('la base de datos impide dos tarifas solapadas', async () => {
    const id = await client()
    await assignPlan(db, id, weekly, '2026-10-01')
    await expect(db.insert(memberships).values({ userId: id, planId: monthly, startsOn: '2026-10-10' })).rejects.toThrow()
  })
})

describe('altas, reactivaciones y bajas', () => {
  test('aprobar con tarifa la asigna desde hoy; sin tarifa, solo aprueba', async () => {
    const withPlan = await client('pending')
    expect(await approveClient(db, withPlan, monthly, '2026-10-13')).toBe('done')
    expect(await historyOf(withPlan)).toEqual([['Bono 8', '2026-10-13', null]])

    const without = await client('pending')
    expect(await approveClient(db, without, null, '2026-10-13')).toBe('done')
    expect(await historyOf(without)).toEqual([])
  })

  test('con una tarifa inactiva no se aprueba: sigue pendiente', async () => {
    const id = await client('pending')
    expect(await approveClient(db, id, retired, '2026-10-13')).toBe('plan_not_found')
    const [row] = await db.select().from(profiles).where(eq(profiles.userId, id))
    expect(row.status).toBe('pending')
  })

  test('la baja termina la tarifa hoy y quita las programadas; al reactivar se puede asignar otra', async () => {
    const id = await client()
    await assignPlan(db, id, weekly, '2026-09-01')
    await assignPlan(db, id, monthly, '2026-11-01')
    expect(await deactivateClient(db, id, '2026-10-13')).toBe(true)
    expect(await historyOf(id)).toEqual([['3 a la semana', '2026-09-01', '2026-10-13']])

    expect(await reactivateClient(db, id, unlimited, '2026-10-13')).toBe('done')
    expect(await historyOf(id)).toEqual([
      ['Libre', '2026-10-13', null],
      ['3 a la semana', '2026-09-01', '2026-10-12'],
    ])
  })

  test('la lista de clientes enseña la tarifa vigente hoy', async () => {
    const id = await client()
    await assignPlan(db, id, monthly, '2026-10-01')
    const listed = (await listClients(db, 'active', { limit: 200 }, '2026-10-13')).find((c) => c.userId === id)
    expect(listed?.planName).toBe('Bono 8')
    const later = (await listClients(db, 'active', { limit: 200 }, '2026-09-30')).find((c) => c.userId === id)
    expect(later?.planName).toBeNull()
  })
})

describe('clases que quedan', () => {
  test('cuentan confirmadas, tardías descontadas y faltas, dentro del periodo en hora de Madrid', async () => {
    const id = await client()
    await assignPlan(db, id, weekly, '2026-10-01')
    // Semana del 12 al 18 de octubre (Madrid = UTC+2)
    await booking(id, '2026-10-12T07:00:00Z') // lunes 09:00: cuenta
    await booking(id, '2026-10-14T07:00:00Z', { status: 'late_cancelled', lateCancelCharged: true, cancelledAt: new Date() }) // cuenta
    await booking(id, '2026-10-15T07:00:00Z', { status: 'late_cancelled', cancelledAt: new Date() }) // pendiente de decidir: no
    await booking(id, '2026-10-16T07:00:00Z', { status: 'cancelled', cancelledAt: new Date() }) // anulada a tiempo: no
    await booking(id, '2026-10-11T21:30:00Z') // domingo 11, 23:30 en Madrid: semana anterior
    await booking(id, '2026-10-18T21:30:00Z') // domingo 18, 23:30 en Madrid: cuenta
    await booking(id, '2026-10-18T22:30:00Z') // lunes 19, 00:30 en Madrid: semana siguiente

    expect(await countUsedClasses(db, id, 'week', '2026-10-15')).toBe(3)
    expect(await getPlanSummary(db, id, '2026-10-15')).toEqual({
      current: { planName: '3 a la semana', period: 'week', classesPerPeriod: 3, remaining: 0 },
      next: null,
    })
  })

  test('una falta sin avisar cuenta', async () => {
    const id = await client()
    await booking(id, '2026-10-05T07:00:00Z', { attendance: 'no_show' })
    expect(await countUsedClasses(db, id, 'month', '2026-10-20')).toBe(1)
  })

  test('ilimitada, sin tarifa y con un cambio programado', async () => {
    const id = await client()
    expect(await getPlanSummary(db, id, '2026-10-13')).toEqual({ current: null, next: null })
    await assignPlan(db, id, unlimited, '2026-10-01')
    await changeClientPlan(db, id, monthly, '2026-11-01')
    expect(await getPlanSummary(db, id, '2026-10-13')).toEqual({
      current: { planName: 'Libre', period: 'unlimited', classesPerPeriod: null, remaining: null },
      next: { planName: 'Bono 8', startsOn: '2026-11-01' },
    })
  })
})
