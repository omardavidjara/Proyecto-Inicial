// @vitest-environment node
// Fase 3: "test con dos usuarios: ninguno ve los datos del otro". Postgres real (PGlite) con las
// migraciones; las consultas son las de lib/data, las mismas que usa lib/dal.ts con la sesión.
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { eq } from 'drizzle-orm'

import { bookings, classTypes, profiles, sessions } from '@/db/schema'
import { getBookingForViewer } from '@/lib/data/bookings'
import { listBookingHistory, listUpcomingBookings } from '@/lib/data/my-bookings'
import { createSignUpProfile, ensureProfile, getMyProfile, initialFullName, setMyAvatar, updateMyProfile, type Viewer } from '@/lib/data/profiles'

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
    const before = new Date('2026-11-01T00:00:00Z')
    const after = new Date('2026-11-03T00:00:00Z')
    expect((await listUpcomingBookings(db, ana.userId, before)).map((b) => b.id)).toEqual([anaBookingId])
    expect((await listUpcomingBookings(db, bruno.userId, before)).map((b) => b.id)).toEqual([brunoBookingId])
    expect((await listBookingHistory(db, ana.userId, { now: after })).items.map((b) => b.id)).toEqual([anaBookingId])
    expect((await listBookingHistory(db, bruno.userId, { now: after })).items.map((b) => b.id)).toEqual([brunoBookingId])
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

describe('perfil del registro con correo (F1)', () => {
  test('queda pendiente, como cliente y con el teléfono; el primer inicio de sesión no lo duplica', async () => {
    const userId = randomUUID()
    await createSignUpProfile(db, { userId, fullName: 'Carla Prueba', phone: '600112233' })
    const viewer = await ensureProfile(db, { id: userId, name: 'Otro Nombre', email: 'carla@example.test' })
    expect(viewer).toMatchObject({ userId, fullName: 'Carla Prueba', role: 'client', status: 'pending', isCoach: false })
  })

  test('si el perfil ya existía, el registro no lo cambia', async () => {
    await createSignUpProfile(db, { userId: ana.userId, fullName: 'Suplantación', phone: '699999999' })
    const viewer = await ensureProfile(db, { id: ana.userId, name: null, email: 'ana@example.test' })
    expect(viewer.fullName).toBe('Ana Prueba')
  })
})

describe('editar el propio perfil (F1)', () => {
  test('cada uno cambia solo el suyo', async () => {
    await updateMyProfile(db, ana, { fullName: 'Ana Editada', phone: '611111111' })
    expect(await getMyProfile(db, ana)).toMatchObject({ fullName: 'Ana Editada', phone: '611111111' })
    expect((await getMyProfile(db, bruno))?.fullName).toBe('Bruno Prueba')
  })

  test('un perfil eliminado (anonimizado) no se puede volver a editar', async () => {
    const userId = randomUUID()
    await createSignUpProfile(db, { userId, fullName: 'Usuario eliminado', phone: '600000000' })
    await db.update(profiles).set({ deletedAt: new Date(), phone: null }).where(eq(profiles.userId, userId))
    const ghost = { userId, fullName: 'Usuario eliminado', role: 'client', isCoach: false, status: 'inactive', phone: null } as const
    await updateMyProfile(db, ghost, { fullName: 'Vuelvo', phone: '622222222' })
    expect(await getMyProfile(db, ghost)).toMatchObject({ fullName: 'Usuario eliminado', phone: null })
  })
})

describe('foto de perfil (F1)', () => {
  test('cambiarla devuelve la anterior (para borrar el archivo) y quitarla la deja vacía', async () => {
    expect(await setMyAvatar(db, bruno, 'https://x/avatars/bruno/1.webp')).toBeNull()
    expect(await setMyAvatar(db, bruno, 'https://x/avatars/bruno/2.webp')).toBe('https://x/avatars/bruno/1.webp')
    expect(await setMyAvatar(db, bruno, null)).toBe('https://x/avatars/bruno/2.webp')
    expect((await getMyProfile(db, bruno))?.avatarUrl).toBeNull()
  })
})
