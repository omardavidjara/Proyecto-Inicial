import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Clock, Phone, UserX } from "lucide-react"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { EmptyState } from "@/components/empty-state"
import { LegalLinks } from "@/components/legal/legal-links"
import { Button } from "@/components/ui/button"
import { getMyProfile } from "@/lib/dal"
import { homePathFor } from "@/lib/roles"

export const metadata: Metadata = { title: "Cuenta pendiente" }

// Única pantalla, junto con /perfil, para cuentas pendientes de aprobar o dadas de baja (ARCHITECTURE §6)
export default async function PendingPage() {
  const { viewer, phone } = await getMyProfile()
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
      {!phone && !inactive ? (
        // Quien entra con Google no da teléfono: el gimnasio lo necesita para contactar (SPEC F1)
        <p role="status" className="flex gap-3 rounded-lg bg-muted px-3 py-3 text-sm">
          <Phone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Añade tu teléfono en el perfil para que el gimnasio pueda contactar contigo.
          </span>
        </p>
      ) : null}
      <Button asChild variant="outline" size="lg" className="w-full">
        <Link href="/perfil">{!phone && !inactive ? "Completar mi perfil" : "Mi perfil"}</Link>
      </Button>
      <SignOutButton />
      <LegalLinks />
    </main>
  )
}
