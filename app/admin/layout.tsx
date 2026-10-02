import { AppShell } from "@/components/app-shell/app-shell"
import { adminNav } from "@/components/app-shell/nav"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell nav={adminNav} navLabel="Navegación de administración">
      {children}
    </AppShell>
  )
}
