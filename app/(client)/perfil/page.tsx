import type { Metadata } from "next"
import { ComingSoon } from "@/components/coming-soon"
import { LegalLinks } from "@/components/legal/legal-links"

export const metadata: Metadata = { title: "Perfil" }

export default function PerfilPage() {
  return (
    <ComingSoon title="Perfil" feature="F1 · Registro, alta y perfil">
      <LegalLinks />
    </ComingSoon>
  )
}
