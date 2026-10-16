// @vitest-environment node
// Altas y bajas de clientes (F1) sobre Postgres real (PGlite) con las migraciones.
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { bookings, classTypes, profiles, sessions } from '@/db/schema'
import {
  approveClient,
  countClientsByStatus,
  countPendingClients,
  deactivateClient,
  listClients,
  reactivateClient,
  rejectClient,
} from '@/lib/data/clients'

import { createTestDb, type TestDb } from './helpers/test-db'

let db: TestDb
let close: () => Promise<void>
let classTypeId: string

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
  const [type] = await db.insert(classTypes).values({ name: 'Funcional', durationMinutes: 60, defaultCapacity: 10, color: 'orange' }).returning()
  classTypeId = type.id
}, 60_000)

afterAll(async () => {
  await close()
})

type Overrides = Partial<typeof profiles.$inferInsert>
async function client(overrides: Overrides = {}) {
  const userId = randomUUID()
  await db.insert(profiles).values({ userId, fullName: `Cliente ${userId.slice(0, 4)}`, ...overrides })
  return userId
}
const statusOf = async (userId: string) => (await db.select().from(profiles).where(eq(profiles.userId, userId)))[0]

async function booking(userId: string, startsInHours: number, status: 'confirmed' | 'waitlisted' | 'cancelled' = 'confirmed') {
  const startsAt = new Date(Date.now() + startsInHours * 3_600_000)
  const [session] = await db
    .insert(sessions)
    .values({ classTypeId, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000), capacity: 10 })
    .returning()
  const [row] = await db
    .insert(bookings)
    .values({ sessionId: session.id, userId, createdBy: userId, status, waitlistedAt: status === 'waitlisted' ? new Date() : null })
    .returning()
  return row.id
}
const bookingStatus = async (id: string) => (await db.select().from(bookings).where(eq(bookings.id, id)))[0].status

describe('aprobar y rechazar altas', () => {
  test('aprobar: pendiente → activo con fecha de aprobación', async () => {
    const id = await client()
    expect(await approveClient(db, id)).toBe('done')
    const row = await statusOf(id)
    expect(row.status).toBe('active')
    expect(row.approvedAt).toBeInstanceOf(Date)
  })

  test('rechazar: pendiente → baja (no se borra)', async () => {
    const id = await client()
    expect(await rejectClient(db, id)).toBe(true)
    const row = await statusOf(id)
    expect(row.status).toBe('inactive')
    expect(row.deactivatedAt).toBeInstanceOf(Date)
  })

  test('solo desde pendiente: aprobar a alguien de baja no cambia nada', async () => {
    const id = await client({ status: 'inactive' })
    expect(await approveClient(db, id)).toBe('conflict')
    expect((await statusOf(id)).status).toBe('inactive')
  })

  test('nunca a quien no es cliente (equipo) ni a un id inexistente', async () => {
    const coach = await client({ role: 'coach', isCoach: true })
    expect(await approveClient(db, coach)).toBe('conflict')
    expect((await statusOf(coach)).status).toBe('pending')
    expect(await approveClient(db, randomUUID())).toBe('conflict')
  })
})

describe('dar de baja y reactivar', () => {
  test('baja: anula sus reservas futuras (confirmadas y en espera), no las pasadas ni las de otros', async () => {
    const id = await client({ status: 'active' })
    const other = await client({ status: 'active' })
    const future = await booking(id, 48)
    const waitlisted = await booking(id, 72, 'waitlisted')
    const past = await booking(id, -48)
    const othersFuture = await booking(other, 48)

    expect(await deactivateClient(db, id)).toBe(true)
    expect((await statusOf(id)).status).toBe('inactive')
    expect(await bookingStatus(future)).toBe('cancelled')
    expect(await bookingStatus(waitlisted)).toBe('cancelled')
    expect(await bookingStatus(past)).toBe('confirmed')
    expect(await bookingStatus(othersFuture)).toBe('confirmed')
  })

  test('baja de alguien que no está activo: no cambia nada ni anula reservas', async () => {
    const id = await client()
    const future = await booking(id, 48)
    expect(await deactivateClient(db, id)).toBe(false)
    expect(await bookingStatus(future)).toBe('confirmed')
  })

  test('reactivar: baja → activo, conserva la fecha de aprobación original', async () => {
    const id = await client({ status: 'active', approvedAt: new Date('2026-01-01T10:00:00Z') })
    await deactivateClient(db, id)
    expect(await reactivateClient(db, id)).toBe('done')
    const row = await statusOf(id)
    expect(row.status).toBe('active')
    expect(row.deactivatedAt).toBeNull()
    expect(row.approvedAt?.toISOString()).toBe('2026-01-01T10:00:00.000Z')
  })

  test('una cuenta eliminada (anonimizada) no se reactiva ni aparece en las listas', async () => {
    const id = await client({ status: 'inactive', deletedAt: new Date(), fullName: 'Usuario eliminado' })
    expect(await reactivateClient(db, id)).toBe('conflict')
    expect((await listClients(db, 'inactive')).map((c) => c.userId)).not.toContain(id)
  })
})

describe('listas', () => {
  test('pendientes del más antiguo al más reciente, solo clientes, y su recuento', async () => {
    await db.delete(bookings)
    await db.delete(profiles)
    const old = await client({ createdAt: new Date('2026-10-01T10:00:00Z') })
    const recent = await client({ createdAt: new Date('2026-10-05T10:00:00Z') })
    await client({ role: 'coach', isCoach: true })
    await client({ status: 'active' })

    expect((await listClients(db, 'pending')).map((c) => c.userId)).toEqual([old, recent])
    expect((await listClients(db, 'pending', { limit: 1 })).map((c) => c.userId)).toEqual([old])
    expect(await countPendingClients(db)).toBe(2)
  })
  test('búsqueda por nombre sin distinguir mayúsculas, con los comodines como texto, y recuentos por estado', async () => {
    await db.delete(bookings)
    await db.delete(profiles)
    const ana = await client({ fullName: 'Ana García', status: 'active' })
    const mariana = await client({ fullName: 'Mariana López', status: 'inactive' })
    await client({ fullName: 'Luis Pérez', status: 'active' })
    await client({ fullName: '100% Ana', status: 'pending' })
    await client({ fullName: 'Ana Entrenadora', role: 'coach', isCoach: true, status: 'active' })
    await client({ fullName: 'Ana Borrada', status: 'inactive', deletedAt: new Date() })

    expect((await listClients(db, 'active', { query: '  aNa ' })).map((c) => c.userId)).toEqual([ana])
    expect((await listClients(db, 'inactive', { query: 'ana' })).map((c) => c.userId)).toEqual([mariana])
    expect(await countClientsByStatus(db, 'ana')).toEqual({ pending: 1, active: 1, inactive: 1 })
    expect(await countClientsByStatus(db, '%')).toEqual({ pending: 1, active: 0, inactive: 0 })
    expect(await countClientsByStatus(db, '_')).toEqual({ pending: 0, active: 0, inactive: 0 })
    expect(await countClientsByStatus(db)).toEqual({ pending: 1, active: 2, inactive: 1 })
  })
})
