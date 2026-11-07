"use server"

import { revalidatePath } from "next/cache"

import { toAnnouncementEntry, type AnnouncementEntry } from "@/lib/announcements"
import { getAnnouncementsTimeZone, listAnnouncements, markAnnouncementsSeen } from "@/lib/dal"

// Lectura de avisos (SPEC F10), compartida por las pantallas de cliente, entrenador y administración. La DAL exige
// una cuenta activa; el cursor se valida en la capa de datos.

export type AnnouncementPageResult = { items: AnnouncementEntry[]; nextCursor: string | null }

export async function loadAnnouncementsAction(cursor: unknown): Promise<AnnouncementPageResult> {
  const [page, timeZone] = await Promise.all([listAnnouncements(cursor), getAnnouncementsTimeZone()])
  return { items: page.items.map((item) => toAnnouncementEntry(item, timeZone)), nextCursor: page.nextCursor }
}

/** Desde el navegador, y no al pintar la página: un prefetch no debe dar los avisos por leídos */
export async function markAnnouncementsSeenAction() {
  await markAnnouncementsSeen()
  revalidatePath("/inicio")
}
