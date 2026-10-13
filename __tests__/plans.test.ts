// @vitest-environment node
// Tarifas (F4): validación y capa de datos sobre Postgres real (PGlite) con las migraciones.
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { memberships, plans, profiles } from '@/db/schema'
import { createPlan, deletePlan, listPlans, setPlanActive, updatePlan } from '@/lib/data/plans'
import { planLimitLabel, planSchema, type PlanInput } from '@/lib/validation/plans'

import { createTestDb, type TestDb } from './helpers/test-db'

let db: TestDb
let close: () => Promise<void>

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
}, 60_000)

afterAll(async () => {
  await close()
})

const input = (overrides: Partial<PlanInput> = {}): PlanInput => ({
  name: '3 a la semana',
  period: 'week',
  classesPerPeriod: 3,
  ...overrides,
})

const TODAY = '2026-10-13'
const byName = async (name: string) => (await listPlans(db, TODAY)).find((p) => p.name === name)

async function client() {
  const userId = randomUUID()
  await db.insert(profiles).values({ userId, fullName: `Cliente ${userId.slice(0, 4)}`, status: 'active' })
  return userId
}

describe('validación del formulario', () => {
  test('convierte el número y recorta el nombre', () => {
    expect(planSchema.parse({ name: '  Bono 8 ', period: 'month', classesPerPeriod: '8' })).toEqual({
      name: 'Bono 8',
      period: 'month',
      classesPerPeriod: 8,
    })
  })

  test('una ilimitada no tiene cupo, llegue lo que llegue', () => {
    expect(planSchema.parse({ name: 'Libre', period: 'unlimited', classesPerPeriod: '5' }).classesPerPeriod).toBeNull()
    expect(planSchema.parse({ name: 'Libre', period: 'unlimited', classesPerPeriod: null }).classesPerPeriod).toBeNull()
  })

  test.each([
    ['nombre vacío', { name: ' ' }, 'name'],
    ['periodo desconocido', { period: 'day' }, 'period'],
    ['cupo 0', { classesPerPeriod: '0' }, 'classesPerPeriod'],
    ['cupo vacío', { classesPerPeriod: null }, 'classesPerPeriod'],
    ['cupo con decimales', { classesPerPeriod: '2.5' }, 'classesPerPeriod'],
    ['cupo enorme', { classesPerPeriod: '1000' }, 'classesPerPeriod'],
  ])('rechaza %s', (_, overrides, field) => {
    const result = planSchema.safeParse({ name: 'Bono', period: 'week', classesPerPeriod: '3', ...overrides })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((i) => i.path[0])).toContain(field)
  })

  test('texto del límite', () => {
    expect(planLimitLabel({ period: 'week', classesPerPeriod: 3 })).toBe('3 clases / semana')
    expect(planLimitLabel({ period: 'month', classesPerPeriod: 1 })).toBe('1 clase / mes')
    expect(planLimitLabel({ period: 'unlimited', classesPerPeriod: null })).toBe('Ilimitada')
  })
})

describe('restricciones de la base de datos', () => {
  test('el cupo tiene que cuadrar con el periodo', async () => {
    await expect(db.insert(plans).values({ name: 'Ilimitada con cupo', period: 'unlimited', classesPerPeriod: 4 })).rejects.toThrow()
    await expect(db.insert(plans).values({ name: 'Semanal sin cupo', period: 'week', classesPerPeriod: null })).rejects.toThrow()
  })
})

describe('tarifas', () => {
  test('crea y lista con las activas primero y por nombre', async () => {
    expect(await createPlan(db, input({ name: 'Zeta' }))).toBe('saved')
    expect(await createPlan(db, input({ name: 'Alfa', period: 'unlimited', classesPerPeriod: null }))).toBe('saved')
    expect(await createPlan(db, input({ name: 'Bono 8', period: 'month', classesPerPeriod: 8 }))).toBe('saved')
    await setPlanActive(db, (await byName('Alfa'))!.id, false)

    expect((await listPlans(db, TODAY)).map((p) => p.name)).toEqual(['Bono 8', 'Zeta', 'Alfa'])
  })

  test('no admite dos tarifas con el mismo nombre, sin distinguir mayúsculas', async () => {
    expect(await createPlan(db, input({ name: 'ZETA' }))).toBe('duplicate')
    const other = await byName('Bono 8')
    expect(await updatePlan(db, other!.id, input({ name: 'zeta' }))).toBe('duplicate')
  })

  test('edita una tarifa y la pasa a ilimitada', async () => {
    const plan = await byName('Zeta')
    expect(await updatePlan(db, plan!.id, input({ name: 'Zeta', period: 'unlimited', classesPerPeriod: null }))).toBe('saved')
    expect(await byName('Zeta')).toMatchObject({ period: 'unlimited', classesPerPeriod: null })
  })

  test('editar, activar o borrar un id que no existe no toca nada', async () => {
    const missing = '00000000-0000-4000-8000-000000000000'
    expect(await updatePlan(db, missing, input({ name: 'Nada' }))).toBe('not_found')
    expect(await setPlanActive(db, missing, true)).toBe(false)
    expect(await deletePlan(db, missing)).toBe('not_found')
  })

  test('cuenta los clientes con la tarifa vigente o programada, no los que ya la dejaron', async () => {
    const plan = await byName('Bono 8')
    const [a, b, c] = [await client(), await client(), await client()]
    await db.insert(memberships).values([
      { userId: a, planId: plan!.id, startsOn: '2026-09-01' },
      { userId: b, planId: plan!.id, startsOn: '2026-11-01' },
      { userId: c, planId: plan!.id, startsOn: '2026-09-01', endsOn: '2026-10-12' },
    ])
    expect((await byName('Bono 8'))!.clients).toBe(2)
    expect((await byName('Zeta'))!.clients).toBe(0)
  })

  test('borra una tarifa sin asignar, pero no una que alguien ha tenido', async () => {
    const unused = await byName('Alfa')
    expect(await deletePlan(db, unused!.id)).toBe('deleted')
    expect(await byName('Alfa')).toBeUndefined()

    const used = await byName('Bono 8')
    expect(await deletePlan(db, used!.id)).toBe('in_use')
    expect(await byName('Bono 8')).toBeDefined()
  })
})
