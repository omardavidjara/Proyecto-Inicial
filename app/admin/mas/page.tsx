import type { Metadata } from "next"
import Link from "next/link"
import { Bell, CalendarClock, ChevronRight, Dumbbell, Settings, Tags, UserRound } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { LegalLinks } from "@/components/legal/legal-links"

export const metadata: Metadata = { title: "Más opciones" }

type Option = { label: string; icon: React.ReactNode } & ({ href: string } | { comingIn: string })

// Menú "Más" (ARCHITECTURE §5). Las opciones aún sin pantalla indican con qué funcionalidad llegan
const OPTIONS: Option[] = [
  { label: "Tipos de clase", href: "/admin/tipos-clase", icon: <Dumbbell /> },
  { label: "Horario", href: "/admin/horario", icon: <CalendarClock /> },
  { label: "Tarifas", href: "/admin/tarifas", icon: <Tags /> },
  { label: "Avisos", comingIn: "F10", icon: <Bell /> },
  { label: "Ajustes", comingIn: "F11", icon: <Settings /> },
  { label: "Mi perfil", href: "/admin/perfil", icon: <UserRound /> },
]

const ROW = "flex min-h-14 items-center gap-3 px-4 py-3 [&>svg:first-child]:size-5 [&>svg:first-child]:text-muted-foreground"

export default function MasOpcionesPage() {
  return (
    <Page title="Más opciones">
      <nav aria-label="Más opciones">
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {OPTIONS.map((option) => (
            <li key={option.label}>
              {"href" in option ? (
                <Link href={option.href} className={`${ROW} outline-none hover:bg-muted focus-visible:bg-muted`}>
                  {option.icon}
                  <span className="flex-1 font-medium">{option.label}</span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              ) : (
                <div className={ROW} aria-disabled="true">
                  {option.icon}
                  <span className="flex-1 text-muted-foreground">{option.label}</span>
                  <span className="text-xs text-muted-foreground">Próximamente</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <SignOutButton className="w-full" />
      <LegalLinks />
    </Page>
  )
}
