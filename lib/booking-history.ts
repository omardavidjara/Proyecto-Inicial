import type { MyBookingRow } from "@/lib/data/my-bookings"
import { addDays, formatDateShort, formatDayLabel, toDateKey, toTimeKey } from "@/lib/dates"
import type { ClassColor } from "@/lib/sessions"

// Historial de «Mis reservas» ya preparado para mostrar: la misma forma para la primera página (render del
// servidor) y para las siguientes (Server Action), así el navegador no necesita la zona horaria ni las reglas.

export type HistoryVariant = "secondary" | "destructive" | "success" | "warning" | "outline"

export type HistoryEntry = {
  id: string
  sessionId: string
  /** "Hoy", "Ayer", "lun 6 oct" o, de otro año, "6 oct 2025" */
  day: string
  time: string
  className: string
  color: ClassColor
  status: { label: string; variant: HistoryVariant }
  /** Tachado: la clase no llegó a hacerse para mí */
  struck: boolean
}

/** Estado de una reserva del historial, con texto (nunca solo color, DESIGN §2.2) */
export function historyStatus(row: Pick<MyBookingRow, "status" | "attendance" | "lateCancelCharged" | "sessionStatus">) {
  if (row.sessionStatus === "cancelled") return { label: "Sesión cancelada", variant: "outline" } as const
  switch (row.status) {
    case "cancelled":
      return { label: "Anulada", variant: "secondary" } as const
    case "late_cancelled":
      if (row.lateCancelCharged === true) return { label: "Anulación tardía · descontada", variant: "destructive" } as const
      if (row.lateCancelCharged === false) return { label: "Anulación tardía · sin descontar", variant: "secondary" } as const
      return { label: "Anulación tardía · pendiente", variant: "warning" } as const
    case "waitlisted":
      return { label: "Lista de espera caducada", variant: "secondary" } as const
    case "confirmed":
      if (row.attendance === "attended") return { label: "Asistida", variant: "success" } as const
      if (row.attendance === "no_show") return { label: "Falta sin avisar", variant: "destructive" } as const
      return { label: "Realizada", variant: "secondary" } as const
  }
}

export function toHistoryEntries(rows: MyBookingRow[], timeZone: string, today: string): HistoryEntry[] {
  const yesterday = addDays(today, -1)
  return rows.map((row) => {
    const key = toDateKey(row.startsAt, timeZone)
    const status = historyStatus(row)
    return {
      id: row.id,
      sessionId: row.sessionId,
      day:
        key === yesterday
          ? "Ayer"
          : key.slice(0, 4) === today.slice(0, 4)
            ? formatDayLabel(key, today)
            : formatDateShort(key),
      time: toTimeKey(row.startsAt, timeZone),
      className: row.className,
      color: row.color,
      status,
      struck: row.status !== "confirmed",
    }
  })
}
