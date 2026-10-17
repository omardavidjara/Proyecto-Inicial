import type { Metadata } from "next"
import { Page } from "@/components/app-shell/app-shell"
import { ProfileView } from "@/components/profile/profile-view"
import { accountDeletion, getMyProfile } from "@/lib/dal"
import { pushPublicKey } from "@/lib/push"

export const metadata: Metadata = { title: "Perfil" }

// Mismo perfil que /perfil, con la navegación de administración (layout de admin/)
export default async function AdminPerfilPage() {
  const [profile, deletion] = await Promise.all([getMyProfile(), accountDeletion()])
  return (
    <Page title="Perfil" backHref="/admin/mas">
      <ProfileView profile={profile} deletion={deletion} pushPublicKey={pushPublicKey()} />
    </Page>
  )
}
