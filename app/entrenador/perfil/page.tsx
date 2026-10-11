import type { Metadata } from "next"
import { Page } from "@/components/app-shell/app-shell"
import { ProfileView } from "@/components/profile/profile-view"
import { getMyProfile } from "@/lib/dal"

export const metadata: Metadata = { title: "Perfil" }

// Mismo perfil que /perfil, con la navegación del entrenador (layout de entrenador/)
export default async function CoachPerfilPage() {
  return (
    <Page title="Perfil">
      <ProfileView profile={await getMyProfile()} />
    </Page>
  )
}
