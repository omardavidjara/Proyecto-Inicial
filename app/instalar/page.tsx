import type { Metadata } from "next"
import { Page } from "@/components/app-shell/app-shell"
import { InstallGuide } from "@/components/pwa/install-guide"

export const metadata: Metadata = {
  title: "Instalar la app",
  description: "Cómo instalar Athlos en tu móvil Android o iPhone.",
}

// Pública (lib/roles.ts): se puede enviar el enlace a quien aún no tiene cuenta. La app es una PWA (SPEC §6)
export default function InstallPage() {
  return (
    <Page title="Instalar la app" backHref="/">
      <InstallGuide />
    </Page>
  )
}
