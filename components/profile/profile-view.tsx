import { SignOutButton } from "@/components/auth/sign-out-button"
import { LegalLinks } from "@/components/legal/legal-links"
import { ProfileForm } from "./profile-form"

type Profile = { fullName: string; phone: string | null; email: string }

/** Contenido de /perfil y /entrenador/perfil: datos editables, cerrar sesión y textos legales (requisito de las tiendas) */
export function ProfileView({ profile }: { profile: Profile }) {
  return (
    <>
      <section aria-labelledby="datos-title" className="flex flex-col gap-4">
        <h2 id="datos-title" className="text-lg font-semibold">
          Tus datos
        </h2>
        <ProfileForm fullName={profile.fullName} phone={profile.phone} email={profile.email} />
      </section>
      <SignOutButton className="w-full" />
      <LegalLinks />
    </>
  )
}
