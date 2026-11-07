import { formatDateShort, toDateKey } from "@/lib/dates"

// Lo que se muestra de cada aviso. La fecha se calcula en el servidor, con la zona del gimnasio.

export type AnnouncementEntry = { id: string; title: string; body: string; date: string }

export function toAnnouncementEntry(
  item: { id: string; title: string; body: string; publishedAt: Date },
  timeZone: string,
): AnnouncementEntry {
  return { id: item.id, title: item.title, body: item.body, date: formatDateShort(toDateKey(item.publishedAt, timeZone)) }
}
