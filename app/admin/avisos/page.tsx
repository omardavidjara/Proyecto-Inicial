import type { Metadata } from "next"
import { Bell } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { AnnouncementDialog, AdminAnnouncementList } from "@/components/admin/announcement-form"
import { EmptyState } from "@/components/empty-state"
import { toAnnouncementEntry } from "@/lib/announcements"
import { getAnnouncementsTimeZone, listAnnouncements } from "@/lib/dal"

export const metadata: Metadata = { title: "Avisos" }

// SPEC F10: publicar avisos generales (llegan por push) y eliminarlos. No se editan: el push no se puede cambiar
export default async function AdminAvisosPage() {
  const [page, timeZone] = await Promise.all([listAnnouncements(), getAnnouncementsTimeZone()])

  return (
    <Page title="Avisos" backHref="/admin/mas" actions={<AnnouncementDialog />}>
      {page.items.length === 0 ? (
        <EmptyState icon={<Bell />} title="Aún no hay avisos" description="Publica un aviso para que lo vea todo el gimnasio." />
      ) : (
        <AdminAnnouncementList initial={page.items.map((item) => toAnnouncementEntry(item, timeZone))} initialCursor={page.nextCursor} />
      )}
    </Page>
  )
}
