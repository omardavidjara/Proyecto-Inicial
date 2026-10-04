import { AppShell } from "@/components/app-shell/app-shell"
import { coachNav } from "@/components/app-shell/nav"

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell nav={coachNav} navLabel="Navegación del entrenador">
      {children}
    </AppShell>
  )
}
