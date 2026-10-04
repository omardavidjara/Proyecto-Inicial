import Link from "next/link"
import { cn } from "@/lib/utils"

const LINK = "inline-flex min-h-11 items-center underline-offset-4 hover:text-foreground hover:underline"

/** Enlaces a los textos legales: login, registro y perfil (exigido por RGPD, LSSI y las tiendas) */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Información legal" className={cn("flex justify-center gap-4 text-sm text-muted-foreground", className)}>
      <Link href="/privacidad" className={LINK}>
        Privacidad
      </Link>
      <Link href="/aviso-legal" className={LINK}>
        Aviso legal
      </Link>
    </nav>
  )
}
