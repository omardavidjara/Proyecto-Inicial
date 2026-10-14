// Textos de la agenda del administrador (SPEC F6), calculados en el servidor para no enviar fechas al navegador.
import { formatMinutes } from "@/lib/booking"
import { formatDayLabel, toDateKey, toTimeKey } from "@/lib/dates"

type LateRow = { id: string; clientName: string; className: string; startsAt: Date; cancelledAt: Date }

/** "Funcional · Hoy 18:00" y "anulada 45 minutos antes" */
export function lateCancellationItem(row: LateRow, today: string) {
  const minutesBefore = Math.max(0, Math.round((row.startsAt.getTime() - row.cancelledAt.getTime()) / 60_000))
  return {
    id: row.id,
    client: row.clientName,
    session: `${row.className} · ${formatDayLabel(toDateKey(row.startsAt), today)} ${toTimeKey(row.startsAt)}`,
    when: `anulada ${formatMinutes(minutesBefore)} antes`,
  }
}
