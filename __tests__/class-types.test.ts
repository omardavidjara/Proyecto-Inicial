// @vitest-environment node
// Tipos de clase (F2): validación y capa de datos sobre Postgres real (PGlite) con las migraciones.
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { classTypes, sessions } from '@/db/schema'
import {
  createClassType,
  deleteClassType,
  listClassTypes,
  setClassTypeActive,
  updateClassType,
} from '@/lib/data/class-types'
import { CLASS_COLORS } from '@/lib/sessions'
import { classTypeSchema, type ClassTypeInput } from '@/lib/validation/class-types'

import { createTestDb, type TestDb } from './helpers/test-db'

let db: TestDb
let close: () => Promise<void>

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
}, 60_000)

afterAll(async () => {
  await close()
})

const input = (overrides: Partial<ClassTypeInput> = {}): ClassTypeInput => ({
  name: 'CrossTraining',
  kind: 'group',
  durationMinutes: 60,
  defaultCapacity: 12,
  color: 'orange',
  ...overrides,
})

const byName = async (name: string) => (await listClassTypes(db)).find((t) => t.name === name)

describe('validación del formulario', () => {
  test('convierte los números y recorta el nombre', () => {
    const parsed = classTypeSchema.parse({ name: '  Hyrox ', kind: 'group', durationMinutes: '45', defaultCapacity: '16', color: 'red' })
    expect(parsed).toEqual({ name: 'Hyrox', kind: 'group', durationMinutes: 45, defaultCapacity: 16, color: 'red' })
  })

  test('una clase individual siempre tiene aforo 1, llegue lo que llegue', () => {
    const parsed = classTypeSchema.parse({ name: 'Personal', kind: 'individual', durationMinutes: '60', defaultCapacity: null, color: 'violet' })
    expect(parsed.defaultCapacity).toBe(1)
    expect(classTypeSchema.parse({ ...parsed, defaultCapacity: '30' }).defaultCapacity).toBe(1)
  })

  test.each([
    ['nombre vacío', { name: ' ' }, 'name'],
    ['modalidad desconocida', { kind: 'duo' }, 'kind'],
    ['duración demasiado corta', { durationMinutes: '2' }, 'durationMinutes'],
    ['duración con decimales', { durationMinutes: '45.5' }, 'durationMinutes'],
    ['aforo 0 en grupal', { defaultCapacity: '0' }, 'defaultCapacity'],
    ['aforo vacío en grupal', { defaultCapacity: null }, 'defaultCapacity'],
    ['color fuera de la paleta', { color: '#ff0000' }, 'color'],
  ])('rechaza %s', (_, overrides, field) => {
    const result = classTypeSchema.safeParse({ ...input(), durationMinutes: '60', defaultCapacity: '12', ...overrides })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((i) => i.path[0])).toContain(field)
  })
})

describe('restricciones de la base de datos', () => {
  test('aceptan todos los colores de la paleta (la lista de la migración coincide con CLASS_COLORS)', async () => {
    for (const color of CLASS_COLORS) {
      expect(await createClassType(db, input({ name: `Color ${color}`, color }))).toBe('saved')
    }
    await expect(db.insert(classTypes).values({ ...input({ name: 'Color raro' }), color: 'black' })).rejects.toThrow()
  })

  test('una clase individual no puede tener más de 1 plaza', async () => {
    await expect(db.insert(classTypes).values(input({ name: 'Individual mal', kind: 'individual', defaultCapacity: 2 }))).rejects.toThrow()
  })
})

describe('tipos de clase', () => {
  test('crea y lista con los activos primero y por nombre', async () => {
    expect(await createClassType(db, input({ name: 'Zumba' }))).toBe('saved')
    expect(await createClassType(db, input({ name: 'Aeróbic' }))).toBe('saved')
    const zumba = await byName('Zumba')
    await setClassTypeActive(db, zumba!.id, false)

    const names = (await listClassTypes(db)).map((t) => t.name)
    expect(names.indexOf('Aeróbic')).toBeLessThan(names.indexOf('Color blue'))
    expect(names.at(-1)).toBe('Zumba')
  })

  test('no admite dos tipos con el mismo nombre, sin distinguir mayúsculas', async () => {
    expect(await createClassType(db, input({ name: 'Movilidad' }))).toBe('saved')
    expect(await createClassType(db, input({ name: 'MOVILIDAD' }))).toBe('duplicate')
    const other = await byName('Aeróbic')
    expect(await updateClassType(db, other!.id, input({ name: 'movilidad' }))).toBe('duplicate')
  })

  test('edita un tipo y cambia de grupal a individual', async () => {
    const type = await byName('Movilidad')
    const result = await updateClassType(db, type!.id, input({ name: 'Movilidad', kind: 'individual', defaultCapacity: 1, durationMinutes: 30, color: 'teal' }))
    expect(result).toBe('saved')
    expect(await byName('Movilidad')).toMatchObject({ kind: 'individual', defaultCapacity: 1, durationMinutes: 30, color: 'teal' })
  })

  test('editar, activar o borrar un id que no existe no toca nada', async () => {
    const missing = '00000000-0000-4000-8000-000000000000'
    expect(await updateClassType(db, missing, input({ name: 'Nada' }))).toBe('not_found')
    expect(await setClassTypeActive(db, missing, true)).toBe(false)
    expect(await deleteClassType(db, missing)).toBe('not_found')
  })

  test('borra un tipo sin usar, pero no uno que ya tiene sesiones', async () => {
    const unused = await byName('Zumba')
    expect(await deleteClassType(db, unused!.id)).toBe('deleted')
    expect(await byName('Zumba')).toBeUndefined()

    const used = await byName('Aeróbic')
    const startsAt = new Date('2026-11-02T08:00:00Z')
    await db.insert(sessions).values({ classTypeId: used!.id, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000), capacity: 12 })
    expect(await deleteClassType(db, used!.id)).toBe('in_use')
    expect(await byName('Aeróbic')).toBeDefined()
  })
})
