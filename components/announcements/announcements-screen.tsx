import { Bell } from "lucide-react"

import { AnnouncementList, MarkAnnouncementsSeen } from "@/components/announcements/announcement-list"
import { EmptyState } from "@/components/empty-state"
import { toAnnouncementEntry } from "@/lib/announcements"
import { getAnnouncementsTimeZone, listAnnouncements } from "@/lib/dal"

/** Lo que ve quien lee los avisos (cliente y entrenador). Abrirla los da por leídos */
export async function AnnouncementsScreen() {
  const [page, timeZone] = await Promise.all([listAnnouncements(), getAnnouncementsTimeZone()])

  return (
    <>
      <MarkAnnouncementsSeen />
      {page.items.length === 0 ? (
        <EmptyState icon={<Bell />} title="No hay avisos" description="Aquí verás los avisos que publique el gimnasio." />
      ) : (
        <AnnouncementList initial={page.items.map((item) => toAnnouncementEntry(item, timeZone))} initialCursor={page.nextCursor} />
      )}
    </>
  )
}
