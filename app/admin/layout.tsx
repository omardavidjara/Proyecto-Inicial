import { AppShell } from "@/components/app-shell/app-shell"
import { adminNav } from "@/components/app-shell/nav"
import { requireArea } from "@/lib/dal"

// Sesión, cuenta activa y rol (lib/dal.ts). Comprobación de entrada: cada consulta de datos vuelve a
// comprobar en la DAL, porque un layout no se vuelve a renderizar al navegar entre sus páginas.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireArea("admin")
  return (
    <AppShell nav={adminNav} navLabel="Navegación de administración">
      {children}
    </AppShell>
  )
}
