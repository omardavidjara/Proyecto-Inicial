import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { LegalLinks } from "@/components/legal/legal-links"
import { ProfileForm } from "@/components/profile/profile-form"
import { getMyProfile } from "@/lib/dal"
import { homePathFor, mustCompleteProfile } from "@/lib/roles"

export const metadata: Metadata = { title: "Completa tus datos" }

// Primera entrada (sobre todo con Google, que no da teléfono): nombre y apellidos y teléfono obligatorios
// para que el gimnasio sepa quién es cada cliente. lib/dal.ts (requireArea) y /pendiente traen aquí.
export default async function CompleteProfilePage() {
  const { viewer, email, fullName, phone } = await getMyProfile()
  if (!mustCompleteProfile(viewer)) redirect(homePathFor(viewer))

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-6 pt-safe pb-safe">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Completa tus datos</h1>
        <p className="text-muted-foreground">
          El gimnasio necesita tu nombre y apellidos y un teléfono para saber quién eres y poder contactar contigo.
        </p>
      </div>
      <ProfileForm fullName={fullName} phone={phone} email={email} firstEntry />
      <SignOutButton />
      <LegalLinks />
    </main>
  )
}
