import type { Metadata } from "next"
import { Page } from "@/components/app-shell/app-shell"
import { AnnouncementsScreen } from "@/components/announcements/announcements-screen"

export const metadata: Metadata = { title: "Avisos" }

// SPEC F10: los avisos del gimnasio, del más reciente al más antiguo
export default function AvisosPage() {
  return (
    <Page title="Avisos" backHref="/inicio">
      <AnnouncementsScreen />
    </Page>
  )
}
