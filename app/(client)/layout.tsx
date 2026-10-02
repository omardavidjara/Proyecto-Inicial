import { AppShell } from "@/components/app-shell/app-shell"
import { clientNav } from "@/components/app-shell/nav"

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell nav={clientNav} navLabel="Navegación principal">
      {children}
    </AppShell>
  )
}
