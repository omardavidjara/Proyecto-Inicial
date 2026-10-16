import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Clock, UserX } from "lucide-react"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { EmptyState } from "@/components/empty-state"
import { LegalLinks } from "@/components/legal/legal-links"
import { Button } from "@/components/ui/button"
import { getMyProfile } from "@/lib/dal"
import { COMPLETE_PROFILE_PATH, homePathFor, mustCompleteProfile } from "@/lib/roles"

export const metadata: Metadata = { title: "Cuenta pendiente" }

// Única pantalla, junto con /perfil y /completar-perfil, para cuentas pendientes de aprobar o dadas de baja
// (ARCHITECTURE §6). Sin nombre y apellidos o teléfono, antes pasan por /completar-perfil
export default async function PendingPage() {
  const { viewer } = await getMyProfile()
  if (mustCompleteProfile(viewer)) redirect(COMPLETE_PROFILE_PATH)
  if (viewer.status === "active") redirect(homePathFor(viewer))

  const inactive = viewer.status === "inactive"
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 pt-safe pb-safe">
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {inactive ? "Cuenta dada de baja" : "Cuenta pendiente de aprobación"}
      </h1>
      <EmptyState
        icon={inactive ? <UserX /> : <Clock />}
        title={`Hola, ${viewer.fullName}`}
        description={
          inactive
            ? "Tu cuenta está dada de baja en el gimnasio. Si crees que es un error, habla con recepción."
            : "El gimnasio tiene que aprobar tu cuenta antes de que puedas reservar. Te avisaremos cuando esté lista."
        }
      />
      <Button asChild variant="outline" size="lg" className="w-full">
        <Link href="/perfil">Mi perfil</Link>
      </Button>
      <SignOutButton />
      <LegalLinks />
    </main>
  )
}
