// @vitest-environment node
// Agenda y anulaciones tardías del administrador (F6) sobre Postgres real (PGlite): sesiones de un rango de días en la
// zona del gimnasio con ocupación y lista de espera, y decidir si una anulación tardía descuenta la clase.
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { bookings, classTypes, memberships, plans, profiles, sessions } from '@/db/schema'
import { lateCancellationItem } from '@/lib/agenda'
import {
  countPendingLateCancellations,
  decideLateCancellation,
  listPendingLateCancellations,
  listSessionsBetween,
} from '@/lib/data/agenda'
import { countUsedClasses } from '@/lib/data/memberships'

import { createTestDb, type TestDb } from './helpers/test-db'

let db: TestDb
let close: () => Promise<void>
let classTypeId: string
let admin: string

// Miércoles 14 de octubre de 2026, 10:00 en Madrid
const now = new Date('2026-10-14T08:00:00Z')
const HOUR = 3_600_000

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
  const [type] = await db.insert(classTypes).values({ name: 'Funcional', durationMinutes: 60, defaultCapacity: 2, color: 'teal' }).returning()
  classTypeId = type.id
  admin = await person('Admin')
}, 60_000)

afterAll(async () => {
  await close()
})

async function person(fullName = 'Cliente') {
  const userId = randomUUID()
  await db.insert(profiles).values({ userId, fullName, status: 'active' })
  return userId
}

async function session(startsAt: string, capacity = 2) {
  const start = new Date(startsAt)
  const [row] = await db
    .insert(sessions)
    .values({ classTypeId, startsAt: start, endsAt: new Date(start.getTime() + HOUR), capacity })
    .returning()
  return row.id
}

async function book(sessionId: string, status: 'confirmed' | 'waitlisted' | 'cancelled' | 'late_cancelled', userId?: string, cancelledAt?: Date) {
  const user = userId ?? (await person())
  const [row] = await db
    .insert(bookings)
    .values({
      sessionId,
      userId: user,
      status,
      createdBy: user,
      waitlistedAt: status === 'waitlisted' ? now : null,
      cancelledAt: status === 'cancelled' || status === 'late_cancelled' ? (cancelledAt ?? now) : null,
    })
    .returning()
  return row.id
}

describe('sesiones de un rango', () => {
  test('días en la hora de Madrid, con ocupación; la lista de espera caduca al empezar', async () => {
    // 00:30 del 20 en Madrid es el 19 en UTC: cuenta para el 20
    const early = await session('2026-10-19T22:30:00Z')
    const late = await session('2026-10-20T19:00:00Z')
    const nextDay = await session('2026-10-21T08:00:00Z')
    await book(late, 'confirmed')
    await book(late, 'confirmed')
    await book(late, 'waitlisted')
    await book(late, 'cancelled')

    const day = await listSessionsBetween(db, '2026-10-20', '2026-10-20', now)
    expect(day.map((s) => s.id)).toEqual([early, late])
    expect(day[1]).toMatchObject({ booked: 2, waitlisted: 1, capacity: 2, className: 'Funcional', coachName: null })

    const twoDays = await listSessionsBetween(db, '2026-10-20', '2026-10-21', now)
    expect(twoDays.map((s) => s.id)).toEqual([early, late, nextDay])

    const afterStart = await listSessionsBetween(db, '2026-10-20', '2026-10-20', new Date('2026-10-20T19:00:00Z'))
    expect(afterStart[1]).toMatchObject({ booked: 2, waitlisted: 0 })
  })
})

describe('anulaciones tardías', () => {
  test('lista las pendientes de la más antigua a la más reciente, con el nombre del cliente', async () => {
    const s = await session('2026-10-14T16:00:00Z')
    const ana = await person('Ana Pendiente')
    const first = await book(s, 'late_cancelled', ana, new Date('2026-10-14T15:00:00Z'))
    const second = await book(s, 'late_cancelled', undefined, new Date('2026-10-14T15:30:00Z'))
    await book(s, 'cancelled')

    const pending = await listPendingLateCancellations(db)
    expect(pending.map((p) => p.id)).toEqual([first, second])
    expect(pending[0]).toMatchObject({ clientName: 'Ana Pendiente', className: 'Funcional' })
    expect(await countPendingLateCancellations(db)).toBe(2)
    expect(await listPendingLateCancellations(db, 1)).toHaveLength(1)

    // Limpieza para los demás tests
    for (const id of [first, second]) await decideLateCancellation(db, admin, id, false)
  })

  test('descontar fija la decisión y quién la tomó; no se decide dos veces', async () => {
    const s = await session('2026-10-14T16:00:00Z')
    const id = await book(s, 'late_cancelled')

    expect(await decideLateCancellation(db, admin, id, true)).toBe(true)
    const [row] = await db.select().from(bookings).where(eq(bookings.id, id))
    expect(row).toMatchObject({ status: 'late_cancelled', lateCancelCharged: true, lateCancelDecidedBy: admin })

    expect(await decideLateCancellation(db, admin, id, false)).toBe(false)
    const [again] = await db.select().from(bookings).where(eq(bookings.id, id))
    expect(again.lateCancelCharged).toBe(true)
    expect(await listPendingLateCancellations(db)).toEqual([])
  })

  test('solo se deciden anulaciones tardías; un id no válido o inexistente no hace nada', async () => {
    const s = await session('2026-10-14T16:00:00Z')
    const confirmed = await book(s, 'confirmed')
    expect(await decideLateCancellation(db, admin, confirmed, true)).toBe(false)
    expect(await decideLateCancellation(db, admin, 'no-es-un-id', true)).toBe(false)
    expect(await decideLateCancellation(db, admin, randomUUID(), true)).toBe(false)
  })

  test('descontada cuenta para el cupo de la tarifa; sin descontar, no', async () => {
    const [plan] = await db.insert(plans).values({ name: 'Dos por semana', period: 'week', classesPerPeriod: 2 }).returning()
    const client = await person()
    await db.insert(memberships).values({ userId: client, planId: plan.id, startsOn: '2026-10-01' })
    const charged = await book(await session('2026-10-15T16:00:00Z'), 'late_cancelled', client)
    const forgiven = await book(await session('2026-10-16T16:00:00Z'), 'late_cancelled', client)

    expect(await countUsedClasses(db, client, 'week', '2026-10-14')).toBe(0)
    await decideLateCancellation(db, admin, charged, true)
    await decideLateCancellation(db, admin, forgiven, false)
    expect(await countUsedClasses(db, client, 'week', '2026-10-14')).toBe(1)
  })
})

describe('textos', () => {
  test('sesión y antelación de la anulación', () => {
    const item = lateCancellationItem(
      {
        id: 'x',
        clientName: 'Ana',
        className: 'Funcional',
        startsAt: new Date('2026-10-14T16:00:00Z'),
        cancelledAt: new Date('2026-10-14T15:15:00Z'),
      },
      '2026-10-14',
    )
    expect(item).toEqual({ id: 'x', client: 'Ana', session: 'Funcional · Hoy 18:00', when: 'anulada 45 minutos antes' })
  })
})
