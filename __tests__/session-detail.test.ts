// @vitest-environment node
// Detalle de sesión del administrador (F6) sobre Postgres real (PGlite): asistentes, lista de espera y anulaciones
// tardías; añadir a un cliente a mano saltándose cupo, ventana y aforo; quitar sin descontar; asistencia.
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { bookings, classTypes, memberships, plans, profiles, sessions } from '@/db/schema'
import { countUsedClasses } from '@/lib/data/memberships'
import {
  addClientToSession,
  getSessionDetail,
  removeBookingFromSession,
  searchClientsForSession,
  setAttendance,
} from '@/lib/data/session-detail'

import { createTestDb, type TestDb } from './helpers/test-db'

let db: TestDb
let close: () => Promise<void>
let classTypeId: string
let planId: string
let admin: string

// Miércoles 14 de octubre de 2026, 10:00 en Madrid
const now = new Date('2026-10-14T08:00:00Z')
const HOUR = 3_600_000
const future = '2026-10-16T17:00:00Z'
const past = '2026-10-13T17:00:00Z'

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
  const [type] = await db.insert(classTypes).values({ name: 'Funcional', durationMinutes: 60, defaultCapacity: 2, color: 'teal' }).returning()
  classTypeId = type.id
  const [plan] = await db.insert(plans).values({ name: '1 a la semana', period: 'week', classesPerPeriod: 1 }).returning()
  planId = plan.id
  admin = randomUUID()
  await db.insert(profiles).values({ userId: admin, fullName: 'Admin', role: 'admin', status: 'active' })
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

async function session(startsAt: string, capacity = 2, status: 'scheduled' | 'cancelled' = 'scheduled') {
  const start = new Date(startsAt)
  const [row] = await db
    .insert(sessions)
    .values({ classTypeId, startsAt: start, endsAt: new Date(start.getTime() + HOUR), capacity, status })
    .returning()
  return row.id
}

async function book(sessionId: string, userId: string, status: 'confirmed' | 'waitlisted' | 'late_cancelled', waitlistedAt = now) {
  const [row] = await db
    .insert(bookings)
    .values({
      sessionId,
      userId,
      status,
      createdBy: userId,
      waitlistedAt: status === 'waitlisted' ? waitlistedAt : null,
      cancelledAt: status === 'late_cancelled' ? now : null,
    })
    .returning()
  return row.id
}

const statusOf = async (bookingId: string) => (await db.select().from(bookings).where(eq(bookings.id, bookingId)))[0]

describe('detalle', () => {
  test('asistentes por nombre, lista de espera por orden y anulaciones tardías; anuladas fuera', async () => {
    const s = await session(future)
    const bea = await client('Bea')
    const ana = await client('Ana')
    await book(s, bea, 'confirmed')
    await book(s, ana, 'confirmed')
    await book(s, await client('Segundo'), 'waitlisted', new Date(now.getTime() + 1000))
    await book(s, await client('Primero'), 'waitlisted', now)
    await book(s, await client('Tarde'), 'late_cancelled')
    await addClientToSession(db, admin, s, await client('Zoe'))
    const cancelled = await client('Anulado')
    await removeBookingFromSession(db, await book(s, cancelled, 'waitlisted'), now)

    const detail = await getSessionDetail(db, s, now)
    expect(detail?.className).toBe('Funcional')
    expect(detail?.attendees.map((a) => [a.fullName, a.attendance, a.addedByStaff])).toEqual([
      ['Ana', 'pending', false],
      ['Bea', 'pending', false],
      ['Zoe', 'pending', true],
    ])
    expect(detail?.waitlist.map((w) => w.fullName)).toEqual(['Primero', 'Segundo'])
    expect(detail?.lateCancellations.map((l) => [l.fullName, l.charged])).toEqual([['Tarde', null]])
  })

  test('la lista de espera caduca al empezar la sesión', async () => {
    const s = await session(past)
    await book(s, await client(), 'waitlisted')
    expect((await getSessionDetail(db, s, now))?.waitlist).toEqual([])
  })

  test('id que no existe o no válido: null', async () => {
    expect(await getSessionDetail(db, randomUUID(), now)).toBeNull()
    expect(await getSessionDetail(db, 'x', now)).toBeNull()
  })
})

describe('buscar clientes para añadir', () => {
  test('activos, por parte del nombre, sin los que ya tienen plaza; marca los que esperan', async () => {
    const s = await session(future)
    const booked = await client('Marta Reservada')
    await book(s, booked, 'confirmed')
    const waiting = await client('Marta Esperando')
    await book(s, waiting, 'waitlisted')
    const free = await client('Marta Libre')
    await client('Marta Pendiente', 'pending')
    await client('Marta Baja', 'inactive')

    const found = await searchClientsForSession(db, s, '  marta ')
    expect(found).toEqual([
      { userId: waiting, fullName: 'Marta Esperando', waitlisted: true },
      { userId: free, fullName: 'Marta Libre', waitlisted: false },
    ])
  })

  test('sin texto suficiente o con comodines: nada de más', async () => {
    const s = await session(future)
    await client('Persona 100%')
    expect(await searchClientsForSession(db, s, 'a')).toEqual([])
    expect((await searchClientsForSession(db, s, '%%')).length).toBe(0)
    expect((await searchClientsForSession(db, s, '100%')).map((c) => c.fullName)).toEqual(['Persona 100%'])
  })
})

describe('añadir a mano', () => {
  test('se salta el aforo y el cupo de la tarifa; queda quién la creó', async () => {
    const s = await session(future, 1)
    await book(s, await client(), 'confirmed')
    const used = await client('Sin clases')
    await book(await session('2026-10-15T17:00:00Z'), used, 'confirmed')

    expect(await addClientToSession(db, admin, s, used)).toBe('added')
    const detail = await getSessionDetail(db, s, now)
    expect(detail?.attendees).toHaveLength(2) // 2/1
    expect(await countUsedClasses(db, used, 'week', '2026-10-16')).toBe(2)
  })

  test('también sin tarifa y en una sesión pasada (para registrar la asistencia)', async () => {
    const s = await session(past)
    const noPlan = await client('Sin tarifa', 'active', false)
    expect(await addClientToSession(db, admin, s, noPlan)).toBe('added')
    const [row] = await db.select().from(bookings).where(eq(bookings.userId, noPlan))
    expect(row).toMatchObject({ status: 'confirmed', createdBy: admin })
  })

  test('si estaba en la lista de espera, pasa a confirmado; si ya tenía plaza, se avisa', async () => {
    const s = await session(future, 1)
    await book(s, await client(), 'confirmed')
    const waiting = await client()
    const id = await book(s, waiting, 'waitlisted')
    expect(await addClientToSession(db, admin, s, waiting)).toBe('confirmed_from_waitlist')
    expect((await statusOf(id)).status).toBe('confirmed')
    expect(await addClientToSession(db, admin, s, waiting)).toBe('already_booked')
  })

  test('cliente no activo, sesión cancelada o ids que no existen', async () => {
    const s = await session(future)
    expect(await addClientToSession(db, admin, s, await client('P', 'pending'))).toBe('client_not_active')
    expect(await addClientToSession(db, admin, s, await client('B', 'inactive'))).toBe('client_not_active')
    expect(await addClientToSession(db, admin, s, admin)).toBe('client_not_active') // solo clientes
    expect(await addClientToSession(db, admin, await session(future, 2, 'cancelled'), await client())).toBe('session_cancelled')
    expect(await addClientToSession(db, admin, randomUUID(), await client())).toBe('not_found')
    expect(await addClientToSession(db, admin, 'x', 'y')).toBe('not_found')
  })
})

describe('quitar', () => {
  test('anula sin descontar y promueve la lista de espera', async () => {
    const s = await session(future, 1)
    const first = await client()
    const firstBooking = await book(s, first, 'confirmed')
    const waitingBooking = await book(s, await client(), 'waitlisted')

    expect(await removeBookingFromSession(db, firstBooking, now)).toBe('removed')
    expect(await statusOf(firstBooking)).toMatchObject({ status: 'cancelled', lateCancelCharged: null })
    expect((await statusOf(waitingBooking)).status).toBe('confirmed')
    expect(await countUsedClasses(db, first, 'week', '2026-10-16')).toBe(0)
  })

  test('de la lista de espera y en sesiones pasadas (sin promover)', async () => {
    const s = await session(past, 1)
    const confirmed = await book(s, await client(), 'confirmed')
    const waiting = await book(s, await client(), 'waitlisted')
    expect(await removeBookingFromSession(db, confirmed, now)).toBe('removed')
    expect((await statusOf(waiting)).status).toBe('waitlisted')
    expect(await removeBookingFromSession(db, waiting, now)).toBe('removed')
  })

  test('una falta ya marcada deja de contar para el cupo al quitar (AUDITORIA-2026-10-14 #1)', async () => {
    const started = await session('2026-10-14T07:30:00Z')
    const user = await client()
    const id = await book(started, user, 'confirmed')
    expect(await setAttendance(db, id, 'no_show', now)).toBe(true)
    expect(await countUsedClasses(db, user, 'week', '2026-10-14')).toBe(1)
    expect(await removeBookingFromSession(db, id, now)).toBe('removed')
    expect(await statusOf(id)).toMatchObject({ status: 'cancelled', attendance: 'pending' })
    expect(await countUsedClasses(db, user, 'week', '2026-10-14')).toBe(0)
  })

  test('ya anulada, de una sesión cancelada o que no existe', async () => {
    const s = await session(future)
    const late = await book(s, await client(), 'late_cancelled')
    expect(await removeBookingFromSession(db, late, now)).toBe('not_found')
    const c = await session(future, 2, 'cancelled')
    expect(await removeBookingFromSession(db, await book(c, await client(), 'confirmed'), now)).toBe('session_cancelled')
    expect(await removeBookingFromSession(db, randomUUID(), now)).toBe('not_found')
    expect(await removeBookingFromSession(db, 'x', now)).toBe('not_found')
  })
})

describe('asistencia', () => {
  test('desde que empieza la sesión: asistió, faltó (cuenta para el cupo) y vuelta a pendiente', async () => {
    const started = await session('2026-10-14T07:30:00Z')
    const user = await client()
    const id = await book(started, user, 'confirmed')
    expect(await setAttendance(db, id, 'attended', now)).toBe(true)
    expect((await statusOf(id)).attendance).toBe('attended')
    expect(await setAttendance(db, id, 'no_show', now)).toBe(true)
    expect(await countUsedClasses(db, user, 'week', '2026-10-14')).toBe(1)
    expect(await setAttendance(db, id, 'pending', now)).toBe(true)
  })

  test('no antes de empezar, ni en la lista de espera, ni en sesiones canceladas', async () => {
    expect(await setAttendance(db, await book(await session(future), await client(), 'confirmed'), 'attended', now)).toBe(false)
    expect(await setAttendance(db, await book(await session(past), await client(), 'waitlisted'), 'attended', now)).toBe(false)
    expect(await setAttendance(db, await book(await session(past, 2, 'cancelled'), await client(), 'confirmed'), 'attended', now)).toBe(false)
    expect(await setAttendance(db, 'x', 'attended', now)).toBe(false)
  })
})

describe('entrenador (F7): solo las sesiones que imparte', () => {
  test('ve y marca la asistencia de las suyas; una ajena es inexistente', async () => {
    const laura = randomUUID()
    const pablo = randomUUID()
    await db.insert(profiles).values([
      { userId: laura, fullName: 'Laura Coach', role: 'coach', isCoach: true, status: 'active' },
      { userId: pablo, fullName: 'Pablo Coach', role: 'coach', isCoach: true, status: 'active' },
    ])
    const mine = await session(past)
    const other = await session(past)
    await db.update(sessions).set({ coachId: laura }).where(eq(sessions.id, mine))
    await db.update(sessions).set({ coachId: pablo }).where(eq(sessions.id, other))
    const myBooking = await book(mine, await client('Ana'), 'confirmed')
    const otherBooking = await book(other, await client('Bea'), 'confirmed')

    expect(await getSessionDetail(db, mine, now, laura)).toMatchObject({ coachName: 'Laura Coach', attendees: [{ fullName: 'Ana' }] })
    expect(await getSessionDetail(db, other, now, laura)).toBeNull()

    expect(await setAttendance(db, myBooking, 'no_show', now, laura)).toBe(true)
    expect(await setAttendance(db, otherBooking, 'attended', now, laura)).toBe(false)
    expect((await statusOf(otherBooking)).attendance).toBe('pending')
    // Administración sigue pudiendo con todas
    expect(await setAttendance(db, otherBooking, 'attended', now)).toBe(true)
  })
})
