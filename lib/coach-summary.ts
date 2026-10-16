// Clases impartidas del entrenador (SPEC F7): resumen de un periodo calculado en el servidor.
import type { AgendaSession } from "@/lib/data/agenda"
import { toDateKey } from "@/lib/dates"

export type CoachSummary = {
  /** Terminadas y no canceladas */
  taught: number
  /** No canceladas que aún no han terminado */
  scheduled: number
  cancelled: number
  /** Las impartidas, de la más reciente a la más antigua */
  taughtSessions: AgendaSession[]
}

/** Resumen de las sesiones que empiezan entre `from` y `to` (incluidos, en la zona del gimnasio) */
export function summarizeCoachPeriod(sessions: AgendaSession[], from: string, to: string, now: Date): CoachSummary {
  const inPeriod = sessions.filter((s) => {
    const day = toDateKey(s.startsAt)
    return day >= from && day <= to
  })
  const active = inPeriod.filter((s) => s.status === "scheduled")
  const taughtSessions = active.filter((s) => s.endsAt <= now).sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
  return {
    taught: taughtSessions.length,
    scheduled: active.length - taughtSessions.length,
    cancelled: inPeriod.length - active.length,
    taughtSessions,
  }
}
