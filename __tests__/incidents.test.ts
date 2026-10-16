// @vitest-environment node
// Incidencias (F9) sobre Postgres real (PGlite) con las migraciones.
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { classTypes, incidents, profiles, sessions } from '@/db/schema'
import {
  countIncidentsByStatus,
  createIncident,
  getIncident,
  listClientIncidents,
  listIncidents,
  searchClientsForIncident,
  setIncidentStatus,
  updateIncident,
} from '@/lib/data/incidents'

import type { NewIncidentInput } from '@/lib/validation/incidents'

import { createTestDb, type TestDb } from './helpers/test-db'

let db: TestDb
let close: () => Promise<void>
let adminId: string
let coachId: string
let sessionId: string

async function profile(overrides: Partial<typeof profiles.$inferInsert> = {}) {
  const userId = randomUUID()
  await db.insert(profiles).values({ userId, fullName: `Persona ${userId.slice(0, 4)}`, ...overrides })
  return userId
}

const base: NewIncidentInput = { title: 'Taquilla rota', description: 'La 12 no cierra', priority: 'medium', clientId: null, sessionId: null }

async function open(createdBy = adminId, extra: Partial<NewIncidentInput> = {}) {
  const result = await createIncident(db, createdBy, { ...base, ...extra })
  if (result.status !== 'created') throw new Error(result.status)
  return result.id
}

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
  adminId = await profile({ fullName: 'Admin Uno', role: 'admin', status: 'active' })
  coachId = await profile({ fullName: 'Coach Uno', role: 'coach', status: 'active', isCoach: true })
  const [type] = await db.insert(classTypes).values({ name: 'Funcional', durationMinutes: 60, defaultCapacity: 10, color: 'orange' }).returning()
  const startsAt = new Date('2026-11-02T09:00:00Z')
  const [session] = await db
    .insert(sessions)
    .values({ classTypeId: type.id, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000), capacity: 10 })
    .returning()
  sessionId = session.id
}, 60_000)

afterAll(async () => {
  await close()
})

describe('crear', () => {
  test('abierta, con cliente y sesión, y se lee con sus nombres', async () => {
    const clientId = await profile({ fullName: 'Ana Incidencia', status: 'active' })
    const id = await open(adminId, { clientId, sessionId, priority: 'high' })
    const row = await getIncident(db, id)
    expect(row).toMatchObject({
      status: 'open',
      priority: 'high',
      clientName: 'Ana Incidencia',
      sessionClassName: 'Funcional',
      createdByName: 'Admin Uno',
      closedAt: null,
    })
  })

  test('cliente inexistente, eliminado o que no es cliente: no se crea', async () => {
    const deleted = await profile({ deletedAt: new Date() })
    for (const clientId of [randomUUID(), deleted, coachId]) {
      expect(await createIncident(db, adminId, { ...base, clientId })).toEqual({ status: 'client_not_found' })
    }
    expect(await createIncident(db, adminId, { ...base, sessionId: randomUUID() })).toEqual({ status: 'session_not_found' })
  })

  test('un cliente de baja sí puede tener incidencias', async () => {
    const clientId = await profile({ status: 'inactive' })
    expect((await createIncident(db, adminId, { ...base, clientId })).status).toBe('created')
  })
})

describe('listas y recuentos', () => {
  test('por estado, la más reciente primero; el límite corta', async () => {
    const first = await open()
    const second = await open()
    const list = await listIncidents(db, 'open', { limit: 500 })
    expect(list.findIndex((i) => i.id === second)).toBeLessThan(list.findIndex((i) => i.id === first))
    expect(await listIncidents(db, 'open', { limit: 1 })).toHaveLength(1)
    expect((await listIncidents(db, 'closed')).some((i) => i.id === first)).toBe(false)
  })

  test('`createdBy` limita a las suyas: la de otra persona no existe', async () => {
    const mine = await open(coachId)
    const other = await open(adminId)
    expect(await getIncident(db, other, { createdBy: coachId })).toBeNull()
    expect((await getIncident(db, mine, { createdBy: coachId }))?.id).toBe(mine)
    const list = await listIncidents(db, 'open', { createdBy: coachId, limit: 500 })
    expect(list.every((i) => i.createdById === coachId)).toBe(true)
    const counts = await countIncidentsByStatus(db, { createdBy: coachId })
    expect(counts.open).toBe(list.length)
    expect((await countIncidentsByStatus(db)).open).toBeGreaterThan(counts.open)
  })

  test('del cliente: abiertas y en curso antes que cerradas', async () => {
    const clientId = await profile()
    const closed = await open(adminId, { clientId })
    await setIncidentStatus(db, closed, 'closed')
    const active = await open(adminId, { clientId })
    await open()
    const list = await listClientIncidents(db, clientId)
    expect(list.map((i) => i.id)).toEqual([active, closed])
  })

  test('id no válido o inexistente: null', async () => {
    expect(await getIncident(db, 'no-es-un-uuid')).toBeNull()
    expect(await getIncident(db, randomUUID())).toBeNull()
  })
})

describe('editar y cambiar de estado', () => {
  test('editar título, descripción y prioridad', async () => {
    const id = await open()
    expect(await updateIncident(db, id, { title: 'Nuevo título', description: 'Más detalle', priority: 'low' })).toBe(true)
    expect(await getIncident(db, id)).toMatchObject({ title: 'Nuevo título', description: 'Más detalle', priority: 'low' })
    expect(await updateIncident(db, randomUUID(), { title: 'x', description: 'y', priority: 'low' })).toBe(false)
  })

  test('cerrar guarda la fecha (y no la cambia si ya estaba cerrada); reabrir la borra', async () => {
    const id = await open()
    expect(await setIncidentStatus(db, id, 'in_progress')).toBe(true)
    expect((await getIncident(db, id))?.closedAt).toBeNull()
    await setIncidentStatus(db, id, 'closed')
    const closedAt = (await getIncident(db, id))?.closedAt
    expect(closedAt).toBeInstanceOf(Date)
    await setIncidentStatus(db, id, 'closed')
    expect((await getIncident(db, id))?.closedAt?.getTime()).toBe(closedAt?.getTime())
    await setIncidentStatus(db, id, 'open')
    const [row] = await db.select().from(incidents).where(eq(incidents.id, id))
    expect(row).toMatchObject({ status: 'open', closedAt: null })
    expect(await setIncidentStatus(db, 'x', 'closed')).toBe(false)
  })
})

describe('buscador de clientes', () => {
  test('clientes por nombre de cualquier estado, sin eliminados ni personal', async () => {
    const active = await profile({ fullName: 'Zoe Buscable', status: 'active' })
    const inactive = await profile({ fullName: 'Zoe Baja', status: 'inactive' })
    await profile({ fullName: 'Zoe Borrada', deletedAt: new Date() })
    await profile({ fullName: 'Zoe Coach', role: 'coach', isCoach: true })
    const found = await searchClientsForIncident(db, 'zoe')
    expect(found.map((c) => c.userId).sort()).toEqual([active, inactive].sort())
    expect(await searchClientsForIncident(db, 'z')).toEqual([])
  })
})
