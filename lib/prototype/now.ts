import { GYM_TIME_ZONE } from "@/lib/dates"

/** Hora actual "HH:MM" en el gimnasio (prototipo: cerrar sesiones ya empezadas) */
export function gymTimeNow(): string {
  return new Intl.DateTimeFormat("es-ES", { timeZone: GYM_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date())
}

export function isClosed(date: string, start: string, today: string, now: string): boolean {
  return date < today || (date === today && start <= now)
}
