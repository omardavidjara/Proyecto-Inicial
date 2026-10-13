// @vitest-environment node
// Reservar, anular, cambiar y lista de espera (F5) sobre Postgres real (PGlite) con las migraciones. También la
// promoción de la lista de espera al subir el aforo, dar de baja y eliminar la cuenta.
import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { bookings, classTypes, memberships, plans, profiles, sessions } from '@/db/schema'
import { anonymizeAccount } from '@/lib/data/account'
import { bookSession, cancelBooking, changeBooking, promoteWaitlist } from '@/lib/data/bookings'
import { deactivateClient } from '@/lib/data/clients'
import { updateSession } from '@/lib/data/schedule'

import { createTestDb, type TestDb } from './helpers/test-db'

let db: TestDb
let close: () => Promise<void>
let classTypeId: string
let unlimited: string
let onePerWeek: string

// Miércoles 14 de octubre de 2026, 10:00 en Madrid: la semana va del lunes 12 al domingo 18
const now = new Date('2026-10-14T08:00:00Z')
const HOUR = 3_600_000
/** Unos segundos después de `now`: para ordenar la lista de espera */
const later = (seconds: number) => new Date(now.getTime() + seconds * 1000)

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
  const [type] = await db.insert(classTypes).values({ name: 'Funcional', durationMinutes: 60, defaultCapacity: 2, color: 'orange' }).returning()
  classTypeId = type.id
  const rows = await db
    .insert(plans)
    .values([
      { name: 'Libre', period: 'unlimited', classesPerPeriod: null },
      { name: '1 a la semana', period: 'week', classesPerPeriod: 1 },
    ])
    .returning()
  ;[unlimited, onePerWeek] = rows.map((r) => r.id)
}, 60_000)

afterAll(async () => {
  await close()
})

/** Cliente con tarifa desde el 1 de octubre (o sin tarifa) */
async function member(planId: string | null = unlimited, status: 'active' | 'pending' = 'active') {
  const userId = randomUUID()
  await db.insert(profiles).values({ userId, fullName: `Cliente ${userId.slice(0, 4)}`, status })
  if (planId) await db.insert(memberships).values({ userId, planId, startsOn: '2026-10-01' })
  return userId
}

/** Sesión que empieza `hours` horas después de `now` */
async function session(hours: number, capacity = 2) {
  const startsAt = new Date(now.getTime() + hours * HOUR)
  const [row] = await db
    .insert(sessions)
    .values({ classTypeId, startsAt, endsAt: new Date(startsAt.getTime() + HOUR), capacity })
    .returning()
  return row.id
}

const bookingOf = async (userId: string, sessionId: string) => {
  const rows = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.userId, userId), eq(bookings.sessionId, sessionId)))
  return rows.at(-1)
}

const statusOf = async (userId: string, sessionId: string) => (await bookingOf(userId, sessionId))?.status

/** Llena una sesión con clientes nuevos con tarifa libre */
async function fill(sessionId: string, count: number) {
  for (let i = 0; i < count; i++) expect(await bookSession(db, await member(), sessionId, now)).toBe('confirmed')
}

describe('reservar', () => {
  test('con plaza se confirma; lleno, lista de espera con fecha; no se reserva dos veces', async () => {
    const s = await session(24)
    const [ana, bruno, carla] = [await member(), await member(), await member()]
    expect(await bookSession(db, ana, s, now)).toBe('confirmed')
    expect(await bookSession(db, ana, s, now)).toBe('already_booked')
    expect(await bookSession(db, bruno, s, now)).toBe('confirmed')
    expect(await bookSession(db, carla, s, now)).toBe('waitlisted')
    expect(await bookingOf(carla, s)).toMatchObject({ status: 'waitlisted', waitlistedAt: now, createdBy: carla })
    expect(await bookSession(db, carla, s, now)).toBe('already_booked')
  })

  test('ventana: se abre 7 días antes y se cierra al empezar; ni sesiones canceladas ni inexistentes', async () => {
    const ana = await member()
    expect(await bookSession(db, ana, await session(7 * 24 + 1), now)).toBe('not_open_yet')
    expect(await bookSession(db, ana, await session(7 * 24), now)).toBe('confirmed')
    expect(await bookSession(db, ana, await session(-0.5), now)).toBe('closed')
    const cancelled = await session(5)
    await db.update(sessions).set({ status: 'cancelled' }).where(eq(sessions.id, cancelled))
    expect(await bookSession(db, ana, cancelled, now)).toBe('session_cancelled')
    expect(await bookSession(db, ana, randomUUID(), now)).toBe('not_found')
    expect(await bookSession(db, ana, "' or 1=1 --", now)).toBe('not_found')
  })

  test('exige perfil activo, tarifa vigente ese día y clases libres en el periodo', async () => {
    expect(await bookSession(db, await member(unlimited, 'pending'), await session(3), now)).toBe('not_active')
    expect(await bookSession(db, await member(null), await session(3), now)).toBe('no_plan')

    const ana = await member(onePerWeek)
    const thursday = await session(24)
    expect(await bookSession(db, ana, thursday, now)).toBe('confirmed')
    expect(await bookSession(db, ana, await session(48), now)).toBe('no_classes_left')
    // El lunes 19 empieza otra semana
    expect(await bookSession(db, ana, await session(5 * 24), now)).toBe('confirmed')

    // Tarifa que termina antes de la sesión
    const bruno = await member(null)
    await db.insert(memberships).values({ userId: bruno, planId: unlimited, startsOn: '2026-10-01', endsOn: '2026-10-14' })
    expect(await bookSession(db, bruno, await session(24), now)).toBe('no_plan')
  })

  test('la lista de espera también exige clases libres (aunque no las gaste)', async () => {
    const s = await session(30, 1)
    await fill(s, 1)
    const ana = await member(onePerWeek)
    expect(await bookSession(db, ana, await session(26), now)).toBe('confirmed')
    expect(await bookSession(db, ana, s, now)).toBe('no_classes_left')
  })
})

describe('anular', () => {
  test('a tiempo libera la plaza y entra el primero de la lista de espera', async () => {
    const s = await session(24)
    const [ana, bruno, carla, dani] = [await member(), await member(), await member(), await member()]
    for (const [i, id] of [ana, bruno, carla, dani].entries()) await bookSession(db, id, s, later(i))
    const anaBooking = await bookingOf(ana, s)
    expect(await cancelBooking(db, ana, anaBooking!.id, now)).toBe('cancelled')
    expect(await bookingOf(ana, s)).toMatchObject({ status: 'cancelled', cancelledAt: now, lateCancelCharged: null })
    expect(await statusOf(carla, s)).toBe('confirmed')
    expect(await statusOf(dani, s)).toBe('waitlisted')
    expect(await cancelBooking(db, ana, anaBooking!.id, now)).toBe('not_found')
  })

  test('a menos de 2 horas es tardía, sin decidir, y la plaza se libera igual', async () => {
    const s = await session(1.5, 1)
    const [ana, bruno] = [await member(), await member()]
    await bookSession(db, ana, s, now)
    await bookSession(db, bruno, s, now)
    expect(await cancelBooking(db, ana, (await bookingOf(ana, s))!.id, now)).toBe('late_cancelled')
    expect(await bookingOf(ana, s)).toMatchObject({ status: 'late_cancelled', lateCancelCharged: null })
    expect(await statusOf(bruno, s)).toBe('confirmed')
  })

  test('salir de la lista de espera no promueve a nadie ni es tardío', async () => {
    const s = await session(1, 1)
    await fill(s, 1)
    const [ana, bruno] = [await member(), await member()]
    await bookSession(db, ana, s, now)
    await bookSession(db, bruno, s, now)
    expect(await cancelBooking(db, ana, (await bookingOf(ana, s))!.id, now)).toBe('left_waitlist')
    expect(await statusOf(ana, s)).toBe('cancelled')
    expect(await statusOf(bruno, s)).toBe('waitlisted')
  })

  test('no se anula una sesión empezada ni la reserva de otra persona', async () => {
    const s = await session(2)
    const [ana, bruno] = [await member(), await member()]
    await bookSession(db, ana, s, now)
    const id = (await bookingOf(ana, s))!.id
    expect(await cancelBooking(db, bruno, id, now)).toBe('not_found')
    expect(await cancelBooking(db, ana, 'nada', now)).toBe('not_found')
    expect(await cancelBooking(db, ana, id, new Date(now.getTime() + 2 * HOUR))).toBe('closed')
    expect(await statusOf(ana, s)).toBe('confirmed')
  })
})

describe('lista de espera', () => {
  test('se salta a quien ya no tiene clases y entra el siguiente', async () => {
    const s = await session(50, 1)
    await fill(s, 1)
    const ana = await member(onePerWeek)
    const bruno = await member()
    expect(await bookSession(db, ana, s, later(1))).toBe('waitlisted')
    expect(await bookSession(db, bruno, s, later(2))).toBe('waitlisted')
    // Ana gasta su clase de la semana en otra sesión mientras espera
    expect(await bookSession(db, ana, await session(26), now)).toBe('confirmed')
    await db.update(sessions).set({ capacity: 2 }).where(eq(sessions.id, s))
    expect(await db.transaction((tx) => promoteWaitlist(tx, s, now))).toEqual([expect.objectContaining({ userId: bruno })])
    expect(await statusOf(ana, s)).toBe('waitlisted')
    expect(await statusOf(bruno, s)).toBe('confirmed')
  })

  test('caduca al empezar la sesión: ya no se promueve', async () => {
    const s = await session(1, 1)
    await fill(s, 1)
    const ana = await member()
    await bookSession(db, ana, s, now)
    await db.update(sessions).set({ capacity: 2 }).where(eq(sessions.id, s))
    expect(await promoteWaitlist(db, s, new Date(now.getTime() + HOUR))).toEqual([])
    expect(await statusOf(ana, s)).toBe('waitlisted')
  })

  test('al subir el aforo de una sesión entran los que esperan', async () => {
    // Martes 20 a las 10:00 de Madrid
    const startsAt = new Date('2026-10-20T08:00:00Z')
    const [row] = await db.insert(sessions).values({ classTypeId, startsAt, endsAt: new Date(startsAt.getTime() + HOUR), capacity: 1 }).returning()
    await fill(row.id, 1)
    const [ana, bruno] = [await member(), await member()]
    await bookSession(db, ana, row.id, later(1))
    await bookSession(db, bruno, row.id, later(2))
    const input = { date: '2026-10-20', startTime: '10:00', durationMinutes: 60, capacity: 2, coachId: null }
    expect(await updateSession(db, row.id, input, now)).toBe('saved')
    expect(await statusOf(ana, row.id)).toBe('confirmed')
    expect(await statusOf(bruno, row.id)).toBe('waitlisted')
  })
})

describe('cambiar de sesión', () => {
  test('anula y reserva a la vez; la plaza que deja pasa a la lista de espera', async () => {
    const [from, to] = [await session(24, 1), await session(28)]
    const [ana, bruno] = [await member(), await member()]
    await bookSession(db, ana, from, now)
    await bookSession(db, bruno, from, now)
    const id = (await bookingOf(ana, from))!.id
    expect(await changeBooking(db, ana, id, from, now)).toBe('same_session')
    expect(await changeBooking(db, ana, id, to, now)).toBe('changed')
    expect(await statusOf(ana, from)).toBe('cancelled')
    expect(await statusOf(ana, to)).toBe('confirmed')
    expect(await statusOf(bruno, from)).toBe('confirmed')
  })

  test('si la nueva no se puede reservar, la antigua sigue igual', async () => {
    const from = await session(24)
    const full = await session(28, 1)
    await fill(full, 1)
    const ana = await member(onePerWeek)
    await bookSession(db, ana, from, now)
    const id = (await bookingOf(ana, from))!.id
    expect(await changeBooking(db, ana, id, full, now)).toBe('full')
    expect(await changeBooking(db, ana, id, await session(8 * 24), now)).toBe('not_open_yet')
    expect(await changeBooking(db, ana, id, randomUUID(), now)).toBe('not_found')
    expect(await statusOf(ana, from)).toBe('confirmed')

    // Su tarifa acaba el domingo: la sesión del lunes no tiene tarifa y se deshace todo
    await db.update(memberships).set({ endsOn: '2026-10-18' }).where(eq(memberships.userId, ana))
    const monday = await session(5 * 24)
    expect(await changeBooking(db, ana, id, monday, now)).toBe('no_plan')
    expect(await statusOf(ana, from)).toBe('confirmed')
    expect(await statusOf(ana, monday)).toBeUndefined()
  })

  test('dentro de la misma semana la clase que se deja vuelve a quedar libre', async () => {
    const ana = await member(onePerWeek)
    const [thursday, friday] = [await session(24), await session(48)]
    await bookSession(db, ana, thursday, now)
    expect(await changeBooking(db, ana, (await bookingOf(ana, thursday))!.id, friday, now)).toBe('changed')
  })

  test('a menos de 2 horas, la anterior queda como anulación tardía', async () => {
    const ana = await member()
    const [soon, later] = [await session(1), await session(30)]
    await bookSession(db, ana, soon, now)
    expect(await changeBooking(db, ana, (await bookingOf(ana, soon))!.id, later, now)).toBe('changed_late')
    expect(await statusOf(ana, soon)).toBe('late_cancelled')
  })
})

describe('baja y eliminar cuenta', () => {
  test('dar de baja anula sus reservas futuras y promueve la lista de espera', async () => {
    const s = await session(24, 1)
    const [ana, bruno] = [await member(), await member()]
    await bookSession(db, ana, s, now)
    await bookSession(db, bruno, s, now)
    expect(await deactivateClient(db, ana, '2026-10-14', now)).toBe(true)
    expect(await statusOf(ana, s)).toBe('cancelled')
    expect(await statusOf(bruno, s)).toBe('confirmed')
  })

  test('eliminar la cuenta también libera la plaza para la lista de espera', async () => {
    const s = await session(24, 1)
    const [ana, bruno] = [await member(), await member()]
    await bookSession(db, ana, s, now)
    await bookSession(db, bruno, s, now)
    expect(await anonymizeAccount(db, ana, now)).toEqual({ avatarUrl: null })
    expect(await statusOf(ana, s)).toBe('cancelled')
    expect(await statusOf(bruno, s)).toBe('confirmed')
  })
})
