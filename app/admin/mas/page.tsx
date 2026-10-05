import type { Metadata } from "next"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { ComingSoon } from "@/components/coming-soon"
import { LegalLinks } from "@/components/legal/legal-links"

export const metadata: Metadata = { title: "Más opciones" }

export default function MasOpcionesPage() {
  return (
    <ComingSoon title="Más opciones" feature="F2, F3, F4, F10 y F11" wide>
      <SignOutButton className="w-full max-w-sm" />
      <LegalLinks />
    </ComingSoon>
  )
}
