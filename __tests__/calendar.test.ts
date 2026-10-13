// @vitest-environment node
// Calendario del cliente (F5) sobre Postgres real (PGlite): sesiones de un día en la zona del gimnasio, plazas,
// lista de espera y la reserva propia (nunca la de otra persona).
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { bookings, classTypes, profiles, sessions } from '@/db/schema'
import { getCalendarSession, getMyLiveBooking, listDaySessions } from '@/lib/data/calendar'

import { createTestDb, type TestDb } from './helpers/test-db'

let db: TestDb
let close: () => Promise<void>
let classTypeId: string
let coach: string

const now = new Date('2026-10-14T08:00:00Z')
const HOUR = 3_600_000

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
  const [type] = await db.insert(classTypes).values({ name: 'Funcional', durationMinutes: 60, defaultCapacity: 3, color: 'teal' }).returning()
  classTypeId = type.id
  coach = await person('Laura Coach')
  await db.update(profiles).set({ role: 'coach', isCoach: true }).where(eq(profiles.userId, coach))
}, 60_000)

afterAll(async () => {
  await close()
})

async function person(fullName = 'Cliente') {
  const userId = randomUUID()
  await db.insert(profiles).values({ userId, fullName, status: 'active' })
  return userId
}

async function session(startsAt: string, extra: Partial<typeof sessions.$inferInsert> = {}) {
  const start = new Date(startsAt)
  const [row] = await db
    .insert(sessions)
    .values({ classTypeId, startsAt: start, endsAt: new Date(start.getTime() + HOUR), capacity: 3, ...extra })
    .returning()
  return row.id
}

async function book(sessionId: string, userId: string, status: 'confirmed' | 'waitlisted' | 'cancelled' | 'late_cancelled', minute = 0) {
  const [row] = await db
    .insert(bookings)
    .values({
      sessionId,
      userId,
      createdBy: userId,
      status,
      waitlistedAt: status === 'waitlisted' ? new Date(now.getTime() + minute * 60_000) : null,
    })
    .returning()
  return row.id
}

describe('sesiones de un día', () => {
  test('usa el día de Madrid, ordena por hora e incluye las canceladas', async () => {
    // 15 de octubre en Madrid (UTC+2): de 2026-10-14T22:00Z a 2026-10-15T22:00Z
    const early = await session('2026-10-14T22:00:00Z', { coachId: coach })
    const late = await session('2026-10-15T21:30:00Z', { status: 'cancelled' })
    await session('2026-10-14T21:59:00Z')
    await session('2026-10-15T22:00:00Z')
    const day = await listDaySessions(db, await person(), '2026-10-15', now)
    expect(day.map((s) => s.id)).toEqual([early, late])
    expect(day[0]).toMatchObject({ className: 'Funcional', color: 'teal', coachName: 'Laura Coach', myBooking: null })
    expect(day[1]).toMatchObject({ status: 'cancelled', coachName: null })
  })

  test('cuenta confirmadas y en espera; mi reserva con mi puesto en la lista', async () => {
    const s = await session('2026-10-16T08:00:00Z')
    const [ana, bruno, carla, dani] = [await person(), await person(), await person(), await person()]
    for (const id of [await person(), await person(), await person()]) await book(s, id, 'confirmed')
    await book(s, bruno, 'waitlisted', 1)
    const carlaBooking = await book(s, carla, 'waitlisted', 2)
    await book(s, dani, 'cancelled')
    // El día 16 también tiene la sesión de las 00:00 de la prueba anterior
    const mine = async (userId: string) => (await listDaySessions(db, userId, '2026-10-16', now)).find((r) => r.id === s)!
    const row = await mine(carla)
    expect(row).toMatchObject({ booked: 3, waitlisted: 2, myBooking: { id: carlaBooking, status: 'waitlisted', waitlistPosition: 2 } })
    expect((await mine(ana)).myBooking).toBeNull()
    expect((await mine(dani)).myBooking).toBeNull()
  })

  test('muestra la anulación tardía, salvo que haya vuelto a reservar', async () => {
    const s = await session('2026-10-17T08:00:00Z')
    const ana = await person()
    const late = await book(s, ana, 'late_cancelled')
    expect((await getCalendarSession(db, ana, s, now))?.myBooking).toEqual({ id: late, status: 'late_cancelled' })
    const again = await book(s, ana, 'confirmed')
    expect((await getCalendarSession(db, ana, s, now))?.myBooking).toEqual({ id: again, status: 'confirmed' })
  })

  test('la lista de espera caduca al empezar la sesión', async () => {
    const s = await session('2026-10-14T07:30:00Z')
    const ana = await person()
    await book(s, ana, 'waitlisted')
    expect(await getCalendarSession(db, ana, s, now)).toMatchObject({ waitlisted: 0, myBooking: null })
  })

  test('un id no válido o inexistente no devuelve nada', async () => {
    const ana = await person()
    expect(await getCalendarSession(db, ana, "' or 1=1 --", now)).toBeNull()
    expect(await getCalendarSession(db, ana, randomUUID(), now)).toBeNull()
  })
})

describe('reserva que se quiere cambiar', () => {
  test('solo la propia y viva', async () => {
    const s = await session('2026-10-18T08:00:00Z')
    const [ana, bruno] = [await person(), await person()]
    const id = await book(s, ana, 'confirmed')
    expect(await getMyLiveBooking(db, ana, id)).toMatchObject({ id, sessionId: s, className: 'Funcional' })
    expect(await getMyLiveBooking(db, bruno, id)).toBeNull()
    expect(await getMyLiveBooking(db, ana, 'x')).toBeNull()
    await db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, id))
    expect(await getMyLiveBooking(db, ana, id)).toBeNull()
  })
})
