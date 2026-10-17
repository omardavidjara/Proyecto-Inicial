import { SignOutButton } from "@/components/auth/sign-out-button"
import { LegalLinks } from "@/components/legal/legal-links"
import { InstallLink } from "@/components/pwa/install-link"
import { PushToggle } from "@/components/pwa/push-toggle"
import { AvatarField } from "./avatar-field"
import { DeleteAccount, type AccountDeletion } from "./delete-account"
import { ProfileForm } from "./profile-form"

type Profile = { viewer: { userId: string }; fullName: string; phone: string | null; email: string; avatarUrl: string | null }

/** Contenido de /perfil y /entrenador/perfil: datos editables, cerrar sesión y textos legales (requisito de las tiendas) */
/** `pushPublicKey`: clave VAPID de este entorno, o `null` si no tiene avisos push (F10) */
export function ProfileView({ profile, deletion, pushPublicKey }: { profile: Profile; deletion: AccountDeletion; pushPublicKey: string | null }) {
  return (
    <>
      <section aria-labelledby="datos-title" className="flex flex-col gap-4">
        <h2 id="datos-title" className="text-lg font-semibold">
          Tus datos
        </h2>
        <AvatarField userId={profile.viewer.userId} avatarUrl={profile.avatarUrl} name={profile.fullName} />
        <p className="-mt-2 text-sm text-muted-foreground">La foto es opcional y la ve el personal del gimnasio.</p>
        <ProfileForm fullName={profile.fullName} phone={profile.phone} email={profile.email} />
      </section>
      <PushToggle publicKey={pushPublicKey} />
      <InstallLink />
      <SignOutButton className="w-full" />
      <DeleteAccount deletion={deletion} />
      <LegalLinks />
    </>
  )
}
