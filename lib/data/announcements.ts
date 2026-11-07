import { desc, eq, gt, sql } from "drizzle-orm"
import { z } from "zod"

import { announcements, profiles } from "@/db/schema"
import type { AnnouncementInput } from "@/lib/validation/announcements"

import type { Db } from "./db"

// Avisos generales del gimnasio (SPEC F10). Permisos en lib/dal.ts: publicar y eliminar, administración; leer,
// cualquier cuenta activa. Nunca se muestra quién lo ha publicado.

const columns = {
  id: announcements.id,
  title: announcements.title,
  body: announcements.body,
  publishedAt: announcements.publishedAt,
}

export type AnnouncementRow = { id: string; title: string; body: string; publishedAt: Date }

// El cursor es la última fila de la página anterior: «<publicación ISO>_<id del aviso>»
const cursorSchema = z
  .string()
  .max(80)
  .transform((value, ctx) => {
    const [iso, id] = value.split("_")
    const publishedAt = new Date(iso ?? "")
    if (!z.uuid().safeParse(id).success || Number.isNaN(publishedAt.getTime()) || publishedAt.toISOString() !== iso) {
      ctx.addIssue({ code: "custom", message: "Cursor no válido" })
      return z.NEVER
    }
    return { publishedAt, id: id as string }
  })

export const ANNOUNCEMENT_PAGE_SIZE = 20

export type AnnouncementPage = { items: AnnouncementRow[]; nextCursor: string | null }

/**
 * Avisos del más reciente al más antiguo, por páginas. `cursor` es el `nextCursor` de la página anterior; si no
 * es válido, se empieza por el principio.
 */
export async function listAnnouncements(
  db: Db,
  { cursor, limit = ANNOUNCEMENT_PAGE_SIZE }: { cursor?: unknown; limit?: number } = {},
): Promise<AnnouncementPage> {
  const after = cursor == null ? null : cursorSchema.safeParse(cursor)
  const size = Math.min(Math.max(limit, 1), 50)
  const rows = await db
    .select(columns)
    .from(announcements)
    .where(
      after?.success
        ? sql`(${announcements.publishedAt}, ${announcements.id}) < (${after.data.publishedAt.toISOString()}::timestamptz, ${after.data.id}::uuid)`
        : undefined,
    )
    .orderBy(desc(announcements.publishedAt), desc(announcements.id))
    .limit(size + 1)

  const items = rows.slice(0, size)
  const last = items.at(-1)
  return {
    items,
    nextCursor: rows.length > size && last ? `${last.publishedAt.toISOString()}_${last.id}` : null,
  }
}

/** La fecha va en milisegundos, como el cursor: si llevara microsegundos, el cursor podría saltarse filas */
export async function createAnnouncement(db: Db, createdBy: string, input: AnnouncementInput, now = new Date()) {
  const [created] = await db
    .insert(announcements)
    .values({ ...input, createdBy, publishedAt: now })
    .returning(columns)
  return created as AnnouncementRow
}

/** Quien ya recibió el push lo conserva en el móvil, pero el aviso desaparece de la app */
export async function deleteAnnouncement(db: Db, id: string) {
  const deleted = await db.delete(announcements).where(eq(announcements.id, id)).returning({ id: announcements.id })
  return deleted.length > 0
}

/** ¿Hay avisos posteriores a la última vez que los abrió? A una cuenta nueva no le cuentan los anteriores a ella */
export async function hasUnreadAnnouncements(db: Db, userId: string) {
  const [unread] = await db
    .select({ id: announcements.id })
    .from(announcements)
    .innerJoin(profiles, eq(profiles.userId, userId))
    .where(gt(announcements.publishedAt, sql`coalesce(${profiles.announcementsSeenAt}, ${profiles.createdAt})`))
    .limit(1)
  return unread !== undefined
}

export async function markAnnouncementsSeen(db: Db, userId: string) {
  await db.update(profiles).set({ announcementsSeenAt: sql`now()` }).where(eq(profiles.userId, userId))
}

/** Reciben el aviso todas las cuentas activas; el rol decide qué pantalla abre el push */
export async function listAnnouncementRecipients(db: Db) {
  return db.select({ userId: profiles.userId, role: profiles.role }).from(profiles).where(eq(profiles.status, "active"))
}
