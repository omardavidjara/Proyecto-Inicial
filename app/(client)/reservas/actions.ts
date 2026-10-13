"use server"

import { toHistoryEntries, type HistoryEntry } from "@/lib/booking-history"
import { getBookingSettings, getMyBookingHistory } from "@/lib/dal"
import { toDateKey } from "@/lib/dates"

// «Ver más» del historial (SPEC F5): la siguiente página desde el cursor de la anterior. La DAL exige la sesión
// y la zona de cliente; el cursor se valida en la capa de datos.

export type HistoryPageResult = { items: HistoryEntry[]; nextCursor: string | null }

export async function loadHistoryAction(cursor: unknown): Promise<HistoryPageResult> {
  const [page, settings] = await Promise.all([getMyBookingHistory(cursor), getBookingSettings()])
  return {
    items: toHistoryEntries(page.items, settings.timeZone, toDateKey(new Date(), settings.timeZone)),
    nextCursor: page.nextCursor,
  }
}
