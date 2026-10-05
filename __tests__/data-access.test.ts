// @vitest-environment node
// Fase 3: "test con dos usuarios: ninguno ve los datos del otro". Postgres real (PGlite) con las
// migraciones; las consultas son las de lib/data, las mismas que usa lib/dal.ts con la sesión.
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { bookings, classTypes, sessions } from '@/db/schema'
import { getBookingForViewer, listMyBookings } from '@/lib/data/bookings'
import { ensureProfile, initialFullName, type Viewer } from '@/lib/data/profiles'

import { createTestDb, type TestDb } from './helpers/test-db'

let db: TestDb
let close: () => Promise<void>
let ana: Viewer
let bruno: Viewer
let anaBookingId: string
let brunoBookingId: string

const activate = (viewer: Viewer): Viewer => ({ ...viewer, status: 'active' })

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
  ana = activate(await ensureProfile(db, { id: randomUUID(), name: 'Ana Prueba', email: 'ana@example.test' }))
  bruno = activate(await ensureProfile(db, { id: randomUUID(), name: 'Bruno Prueba', email: 'bruno@example.test' }))

  const [type] = await db.insert(classTypes).values({ name: 'Funcional', durationMinutes: 60, defaultCapacity: 10, color: 'orange' }).returning()
  const [session] = await db
    .insert(sessions)
    .values({ classTypeId: type.id, startsAt: new Date('2026-11-02T08:00:00Z'), endsAt: new Date('2026-11-02T09:00:00Z'), capacity: 10 })
    .returning()
  const [a] = await db.insert(bookings).values({ sessionId: session.id, userId: ana.userId, createdBy: ana.userId, status: 'confirmed' }).returning()
  const [b] = await db.insert(bookings).values({ sessionId: session.id, userId: bruno.userId, createdBy: bruno.userId, status: 'confirmed' }).returning()
  anaBookingId = a.id
  brunoBookingId = b.id
}, 60_000)

afterAll(async () => {
  await close()
})

describe('perfil en el primer inicio de sesión', () => {
  test('se crea como cliente pendiente con el nombre de la cuenta', async () => {
    const viewer = await ensureProfile(db, { id: randomUUID(), name: '  Carla  ', email: 'carla@example.test' })
    expect(viewer).toMatchObject({ fullName: 'Carla', role: 'client', status: 'pending', isCoach: false })
  })

  test('sin nombre usa la parte local del correo', () => {
    expect(initialFullName({ id: randomUUID(), name: null, email: 'dani.r@example.test' })).toBe('dani.r')
  })

  test('es idempotente: entrar dos veces (o a la vez) no duplica ni pisa el perfil', async () => {
    const user = { id: randomUUID(), name: 'Eva', email: 'eva@example.test' }
    const [first, second] = await Promise.all([ensureProfile(db, user), ensureProfile(db, user)])
    expect(first).toEqual(second)
    const again = await ensureProfile(db, { ...user, name: 'Otro nombre' })
    expect(again.fullName).toBe('Eva')
  })
})

describe('dos usuarios: ninguno ve los datos del otro', () => {
  test('cada uno lista solo sus reservas', async () => {
    const anaList = await listMyBookings(db, ana)
    const brunoList = await listMyBookings(db, bruno)
    expect(anaList.map((b) => b.id)).toEqual([anaBookingId])
    expect(brunoList.map((b) => b.id)).toEqual([brunoBookingId])
  })

  test('pedir la reserva del otro por su id devuelve lo mismo que si no existiera', async () => {
    expect(await getBookingForViewer(db, ana, brunoBookingId)).toBeNull()
    expect(await getBookingForViewer(db, bruno, anaBookingId)).toBeNull()
    expect(await getBookingForViewer(db, ana, randomUUID())).toBeNull()
    expect(await getBookingForViewer(db, ana, anaBookingId)).toMatchObject({ id: anaBookingId })
  })

  test('un id con formato inválido se rechaza sin consultar', async () => {
    expect(await getBookingForViewer(db, ana, "' or 1=1 --")).toBeNull()
    expect(await getBookingForViewer(db, ana, undefined)).toBeNull()
  })

  test('administración ve cualquier reserva, pero solo con la cuenta activa', async () => {
    const admin: Viewer = { ...ana, role: 'admin' }
    expect(await getBookingForViewer(db, admin, brunoBookingId)).toMatchObject({ id: brunoBookingId })
    expect(await getBookingForViewer(db, { ...admin, status: 'inactive' }, brunoBookingId)).toBeNull()
  })
})
