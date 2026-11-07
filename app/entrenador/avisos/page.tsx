import type { Metadata } from "next"
import { Page } from "@/components/app-shell/app-shell"
import { AnnouncementsScreen } from "@/components/announcements/announcements-screen"

export const metadata: Metadata = { title: "Avisos" }

// SPEC F10: el entrenador no entra en la zona de cliente, así que lee los avisos del gimnasio aquí
export default function CoachAvisosPage() {
  return (
    <Page title="Avisos">
      <AnnouncementsScreen />
    </Page>
  )
}
