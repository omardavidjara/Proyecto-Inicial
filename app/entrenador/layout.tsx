import { AppShell } from "@/components/app-shell/app-shell"
import { coachNav } from "@/components/app-shell/nav"
import { requireArea } from "@/lib/dal"

// Sesión, cuenta activa y rol (lib/dal.ts). Comprobación de entrada: cada consulta de datos vuelve a
// comprobar en la DAL, porque un layout no se vuelve a renderizar al navegar entre sus páginas.
export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  await requireArea("coach")
  return (
    <AppShell nav={coachNav} navLabel="Navegación del entrenador">
      {children}
    </AppShell>
  )
}
