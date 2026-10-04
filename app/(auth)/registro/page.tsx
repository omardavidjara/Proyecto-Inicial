import type { Metadata } from "next"
import Link from "next/link"
import { Construction } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { LegalLinks } from "@/components/legal/legal-links"
import { PrivacySummary } from "@/components/legal/privacy-summary"

export const metadata: Metadata = { title: "Registro" }

// PROTOTIPO: el registro llega con F1 (Fase 5). El formulario real debe mostrar PrivacySummary antes del botón de enviar
export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 pt-safe pb-safe">
      <h1 className="text-center text-2xl font-semibold tracking-tight">Crear cuenta</h1>
      <EmptyState
        icon={<Construction />}
        title="Próximamente"
        description="El registro llega con F1 · Registro, alta y perfil (Fase 5)."
        action={
          <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
            Volver a iniciar sesión
          </Link>
        }
      />
      <PrivacySummary />
      <LegalLinks />
    </main>
  )
}
