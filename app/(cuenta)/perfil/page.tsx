import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AppShell, Page } from "@/components/app-shell/app-shell"
import { clientNav } from "@/components/app-shell/nav"
import { ProfileView } from "@/components/profile/profile-view"
import { accountDeletion, getMyProfile } from "@/lib/dal"
import { canAccessArea, PENDING_PATH } from "@/lib/roles"

export const metadata: Metadata = { title: "Perfil" }

// Fuera de (client): las cuentas pendientes o de baja también abren su perfil (ARCHITECTURE §6).
// Con la cuenta activa, el marco del cliente; un entrenador, a su propio perfil.
export default async function PerfilPage() {
  const [profile, deletion] = await Promise.all([getMyProfile(), accountDeletion()])
  const { viewer } = profile

  if (viewer.status !== "active") {
    return (
      <Page title="Perfil" backHref={PENDING_PATH}>
        <ProfileView profile={profile} deletion={deletion} />
      </Page>
    )
  }
  if (!canAccessArea(viewer, "client")) redirect("/entrenador/perfil")
  return (
    <AppShell nav={clientNav} navLabel="Navegación principal" profileHref="/perfil">
      <Page title="Perfil">
        <ProfileView profile={profile} deletion={deletion} />
      </Page>
    </AppShell>
  )
}
