"use server"

import type { HistoryPageResult } from "@/app/(client)/reservas/actions"
import { toHistoryEntries } from "@/lib/booking-history"
import { getClientHistoryForAdmin } from "@/lib/dal"
import { toDateKey } from "@/lib/dates"

// «Ver más» del historial en la ficha del cliente (SPEC F8). La DAL exige el rol de administración y valida el id
// del cliente; el cursor se valida en la capa de datos.
export async function loadClientHistoryAction(userId: unknown, cursor: unknown): Promise<HistoryPageResult> {
  const { page, timeZone } = await getClientHistoryForAdmin(userId, cursor)
  return { items: toHistoryEntries(page.items, timeZone, toDateKey(new Date(), timeZone)), nextCursor: page.nextCursor }
}
