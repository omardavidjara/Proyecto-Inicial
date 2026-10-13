// @vitest-environment node
// «Mis reservas» (F5) sobre Postgres real (PGlite): próximas (vivas y sin empezar), próxima clase confirmada e
// historial por cursor, siempre del usuario indicado (nunca las de otra persona).
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { bookings, classTypes, profiles, sessions } from '@/db/schema'
import { historyStatus, toHistoryEntries } from '@/lib/booking-history'
import { getNextConfirmedBooking, listBookingHistory, listUpcomingBookings } from '@/lib/data/my-bookings'

import { createTestDb, type TestDb } from './helpers/test-db'

let db: TestDb
let close: () => Promise<void>
let classTypeId: string

const now = new Date('2026-10-14T08:00:00Z')
const HOUR = 3_600_000

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
  const [type] = await db.insert(classTypes).values({ name: 'Pilates', durationMinutes: 60, defaultCapacity: 2, color: 'violet' }).returning()
  classTypeId = type.id
}, 60_000)

afterAll(async () => {
  await close()
})

async function person() {
  const userId = randomUUID()
  await db.insert(profiles).values({ userId, fullName: 'Cliente', status: 'active' })
  return userId
}

async function session(offsetHours: number, extra: Partial<typeof sessions.$inferInsert> = {}) {
  const start = new Date(now.getTime() + offsetHours * HOUR)
  const [row] = await db
    .insert(sessions)
    .values({ classTypeId, startsAt: start, endsAt: new Date(start.getTime() + HOUR), capacity: 2, ...extra })
    .returning()
  return row.id
}

type Status = 'confirmed' | 'waitlisted' | 'cancelled' | 'late_cancelled'

async function book(sessionId: string, userId: string, status: Status, extra: Partial<typeof bookings.$inferInsert> = {}) {
  const [row] = await db
    .insert(bookings)
    .values({ sessionId, userId, createdBy: userId, status, waitlistedAt: status === 'waitlisted' ? now : null, ...extra })
    .returning()
  return row.id
}

describe('próximas', () => {
  test('solo vivas y sin empezar, por hora, con mi puesto en la lista de espera', async () => {
    const [ana, otro] = [await person(), await person()]
    const later = await session(48)
    const soon = await session(2)
    const full = await session(24)
    const past = await session(-2)
    const b1 = await book(later, ana, 'confirmed')
    const b2 = await book(soon, ana, 'confirmed')
    await book(full, otro, 'waitlisted', { waitlistedAt: new Date(now.getTime() - 60_000) })
    const b3 = await book(full, ana, 'waitlisted')
    await book(past, ana, 'confirmed')
    await book(await session(5), ana, 'cancelled')
    await book(later, otro, 'confirmed')

    const rows = await listUpcomingBookings(db, ana, now)
    expect(rows.map((r) => r.id)).toEqual([b2, b3, b1])
    expect(rows[1]).toMatchObject({ status: 'waitlisted', waitlistPosition: 2 })
    expect(rows[0]).not.toHaveProperty('waitlistPosition')
    expect(rows[2]).toMatchObject({ className: 'Pilates', color: 'violet', booked: 2, capacity: 2 })
  })

  test('la próxima clase es la primera confirmada (no la lista de espera)', async () => {
    const ana = await person()
    await book(await session(1), ana, 'waitlisted')
    const confirmed = await book(await session(3), ana, 'confirmed')
    await book(await session(6), ana, 'confirmed')
    expect((await getNextConfirmedBooking(db, ana, now))?.id).toBe(confirmed)
    expect(await getNextConfirmedBooking(db, await person(), now)).toBeNull()
  })
})

describe('historial', () => {
  test('clases empezadas y anulaciones, de la más reciente a la más antigua, por páginas', async () => {
    const ana = await person()
    const ids: string[] = []
    // Seis clases pasadas (de -1 h a -6 h) y una anulación de una sesión futura
    for (let h = 1; h <= 6; h++) ids.push(await book(await session(-h), ana, 'confirmed'))
    const cancelled = await book(await session(10), ana, 'cancelled')
    await book(await session(12), ana, 'confirmed') // próxima: no sale
    await book(await session(-1), await person(), 'confirmed') // de otra persona

    const first = await listBookingHistory(db, ana, { now, limit: 3 })
    expect(first.items.map((r) => r.id)).toEqual([cancelled, ids[0], ids[1]])
    expect(first.nextCursor).not.toBeNull()
    const second = await listBookingHistory(db, ana, { now, limit: 3, cursor: first.nextCursor })
    expect(second.items.map((r) => r.id)).toEqual(ids.slice(2, 5))
    const third = await listBookingHistory(db, ana, { now, limit: 3, cursor: second.nextCursor })
    expect(third.items.map((r) => r.id)).toEqual([ids[5]])
    expect(third.nextCursor).toBeNull()
  })

  test('un cursor no válido empieza por el principio', async () => {
    const ana = await person()
    const id = await book(await session(-30), ana, 'confirmed')
    for (const cursor of ['nada', `2026-10-14T08:00:00.000Z_no-uuid`, "' or 1=1 --", 42, `x_${randomUUID()}`]) {
      expect((await listBookingHistory(db, ana, { now, cursor })).items.map((r) => r.id)).toEqual([id])
    }
  })
})

describe('estado en el historial', () => {
  const base = { status: 'confirmed', attendance: 'pending', lateCancelCharged: null, sessionStatus: 'scheduled' } as const

  test('texto para cada caso', () => {
    expect(historyStatus(base).label).toBe('Realizada')
    expect(historyStatus({ ...base, attendance: 'attended' }).label).toBe('Asistida')
    expect(historyStatus({ ...base, attendance: 'no_show' }).label).toBe('Falta sin avisar')
    expect(historyStatus({ ...base, status: 'cancelled' }).label).toBe('Anulada')
    expect(historyStatus({ ...base, status: 'waitlisted' }).label).toBe('Lista de espera caducada')
    expect(historyStatus({ ...base, status: 'late_cancelled' }).label).toMatch(/pendiente/)
    expect(historyStatus({ ...base, status: 'late_cancelled', lateCancelCharged: true }).label).toMatch(/descontada/)
    expect(historyStatus({ ...base, status: 'late_cancelled', lateCancelCharged: false }).label).toMatch(/sin descontar/)
    expect(historyStatus({ ...base, status: 'cancelled', sessionStatus: 'cancelled' }).label).toBe('Sesión cancelada')
  })

  test('días en la zona del gimnasio: «Ayer» y, de otro año, con el año', () => {
    const row = {
      ...base,
      id: 'b',
      sessionId: 's',
      endsAt: now,
      className: 'Pilates',
      color: 'violet',
      coachName: null,
      capacity: 2,
      booked: 1,
    } as const
    const [yesterday, old] = toHistoryEntries(
      [
        { ...row, startsAt: new Date('2026-10-13T21:30:00Z') }, // 23:30 del 13 en Madrid
        { ...row, startsAt: new Date('2025-12-01T09:00:00Z') },
      ],
      'Europe/Madrid',
      '2026-10-14',
    )
    expect(yesterday).toMatchObject({ day: 'Ayer', time: '23:30', struck: false })
    expect(old.day).toBe('1 dic 2025')
  })
})
