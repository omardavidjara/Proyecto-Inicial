import Link from "next/link"
import type { ReactNode } from "react"
import { ChevronLeft, TriangleAlert } from "lucide-react"
import { LegalLinks } from "./legal-links"
import { LEGAL, isLegalComplete } from "@/lib/legal"

/**
 * Marco de las páginas legales públicas (/privacidad, /aviso-legal): se abren sin iniciar sesión.
 * "Volver" lleva a "/", que envía al login o al inicio de cada rol (ARCHITECTURE §5).
 */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <Link
        href="/"
        className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
        Volver
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">Última actualización: {LEGAL.updatedAt}</p>
      </div>
      {!isLegalComplete && (
        <p role="note" className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Borrador: faltan los datos del titular (entre corchetes). Se completan antes de publicar la app.
        </p>
      )}
      <div className="flex flex-col gap-6 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_section]:flex [&_section]:flex-col [&_section]:gap-2 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </div>
      <LegalLinks className="border-t pt-4" />
    </main>
  )
}
