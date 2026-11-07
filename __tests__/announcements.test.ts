// @vitest-environment node
// Avisos generales (F10): validación, capa de datos sobre Postgres real (PGlite) y texto del push.
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { announcements, profiles } from '@/db/schema'
import {
  ANNOUNCEMENT_PAGE_SIZE,
  createAnnouncement,
  deleteAnnouncement,
  hasUnreadAnnouncements,
  listAnnouncementRecipients,
  listAnnouncements,
  markAnnouncementsSeen,
} from '@/lib/data/announcements'
import { announcementMessage } from '@/lib/notification-messages'
import { ANNOUNCEMENT_BODY_MAX, ANNOUNCEMENT_TITLE_MAX, announcementSchema } from '@/lib/validation/announcements'

import { createTestDb, type TestDb } from './helpers/test-db'

let db: TestDb
let close: () => Promise<void>

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
}, 60_000)

afterAll(async () => {
  await close()
})

beforeEach(async () => {
  await db.delete(announcements)
})

const input = { title: 'Cerrado el lunes', body: 'El gimnasio cierra por festivo.' }
const at = (minutes: number) => new Date(Date.UTC(2026, 10, 7, 10, minutes))

async function person(overrides: Partial<typeof profiles.$inferInsert> = {}) {
  const userId = randomUUID()
  await db.insert(profiles).values({ userId, fullName: 'Persona de prueba', status: 'active', createdAt: at(0), ...overrides })
  return userId
}

describe('validación del formulario', () => {
  test('recorta los espacios', () => {
    expect(announcementSchema.parse({ title: '  Hola ', body: ' Texto\n' })).toEqual({ title: 'Hola', body: 'Texto' })
  })

  test('título y texto son obligatorios, también si solo hay espacios', () => {
    expect(announcementSchema.safeParse({ title: '   ', body: 'Texto' }).success).toBe(false)
    expect(announcementSchema.safeParse({ title: 'Hola', body: '   ' }).success).toBe(false)
    expect(announcementSchema.safeParse({ title: null, body: null }).success).toBe(false)
  })

  test('rechaza los textos demasiado largos', () => {
    expect(announcementSchema.safeParse({ title: 'x'.repeat(ANNOUNCEMENT_TITLE_MAX + 1), body: 'Texto' }).success).toBe(false)
    expect(announcementSchema.safeParse({ title: 'Hola', body: 'x'.repeat(ANNOUNCEMENT_BODY_MAX + 1) }).success).toBe(false)
  })
})

describe('listado', () => {
  test('del más reciente al más antiguo y sin decir quién lo publicó', async () => {
    const author = await person()
    await createAnnouncement(db, author, { ...input, title: 'Antiguo' }, at(1))
    await createAnnouncement(db, author, { ...input, title: 'Reciente' }, at(2))
    const { items, nextCursor } = await listAnnouncements(db)
    expect(items.map((item) => item.title)).toEqual(['Reciente', 'Antiguo'])
    expect(nextCursor).toBeNull()
    expect(Object.keys(items[0]).sort()).toEqual(['body', 'id', 'publishedAt', 'title'])
  })

  test('por páginas: sin repetir ni saltarse filas, aunque coincidan en la fecha', async () => {
    const author = await person()
    const total = ANNOUNCEMENT_PAGE_SIZE + 3
    for (let i = 0; i < total; i++) await createAnnouncement(db, author, { ...input, title: `Aviso ${i}` }, at(1))
    const first = await listAnnouncements(db)
    expect(first.items).toHaveLength(ANNOUNCEMENT_PAGE_SIZE)
    expect(first.nextCursor).not.toBeNull()
    const second = await listAnnouncements(db, { cursor: first.nextCursor })
    expect(second.items).toHaveLength(3)
    expect(second.nextCursor).toBeNull()
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(total)
  })

  test('un cursor no válido empieza por el principio', async () => {
    const author = await person()
    await createAnnouncement(db, author, input, at(1))
    for (const cursor of ['basura', "2026-11-07T10:00:00.000Z_' or 1=1 --", 42]) {
      expect((await listAnnouncements(db, { cursor })).items).toHaveLength(1)
    }
  })
})

describe('eliminar', () => {
  test('desaparece del listado; uno que no existe devuelve false', async () => {
    const author = await person()
    const created = await createAnnouncement(db, author, input, at(1))
    expect(await deleteAnnouncement(db, created.id)).toBe(true)
    expect((await listAnnouncements(db)).items).toEqual([])
    expect(await deleteAnnouncement(db, created.id)).toBe(false)
  })
})

describe('sin leer', () => {
  test('sin avisos no hay nada sin leer', async () => {
    expect(await hasUnreadAnnouncements(db, await person())).toBe(false)
  })

  test('a una cuenta nueva no le cuentan los avisos anteriores a ella', async () => {
    const author = await person()
    await createAnnouncement(db, author, input, at(1))
    const newcomer = await person({ createdAt: at(2) })
    expect(await hasUnreadAnnouncements(db, newcomer)).toBe(false)
    await createAnnouncement(db, author, input, at(3))
    expect(await hasUnreadAnnouncements(db, newcomer)).toBe(true)
  })

  test('abrirlos solo marca los de quien los abre', async () => {
    const author = await person()
    const ana = await person()
    const luis = await person()
    await createAnnouncement(db, author, input, at(1))
    await markAnnouncementsSeen(db, ana)
    expect(await hasUnreadAnnouncements(db, ana)).toBe(false)
    expect(await hasUnreadAnnouncements(db, luis)).toBe(true)
  })

  test('un aviso posterior a abrirlos vuelve a salir sin leer', async () => {
    const author = await person()
    const ana = await person({ announcementsSeenAt: at(5) })
    await createAnnouncement(db, author, input, at(4))
    expect(await hasUnreadAnnouncements(db, ana)).toBe(false)
    await createAnnouncement(db, author, input, at(6))
    expect(await hasUnreadAnnouncements(db, ana)).toBe(true)
  })
})

describe('destinatarios', () => {
  test('todas las cuentas activas, de cualquier rol; ni pendientes ni de baja', async () => {
    const client = await person()
    const coach = await person({ role: 'coach', isCoach: true })
    const admin = await person({ role: 'admin' })
    const pending = await person({ status: 'pending' })
    const inactive = await person({ status: 'inactive' })
    const recipients = await listAnnouncementRecipients(db)
    const ids = recipients.map((r) => r.userId)
    expect(ids).toEqual(expect.arrayContaining([client, coach, admin]))
    expect(ids).not.toContain(pending)
    expect(ids).not.toContain(inactive)
  })
})

describe('mensaje del push', () => {
  test('lleva el título y el texto del aviso', () => {
    expect(announcementMessage(input, 'client')).toEqual({ ...input, url: '/avisos' })
  })

  test('quien solo es entrenador abre su zona; administración, la de cliente', () => {
    expect(announcementMessage(input, 'coach').url).toBe('/entrenador/avisos')
    expect(announcementMessage(input, 'admin').url).toBe('/avisos')
    expect(announcementMessage(input, 'developer').url).toBe('/avisos')
  })
})
