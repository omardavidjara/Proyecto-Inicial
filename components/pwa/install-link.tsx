"use client"

import Link from "next/link"
import { ChevronRight, Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStandalone } from "./use-standalone"

/** Enlace a /instalar en «Inicio» y «Perfil». No se pinta si la app ya se abre instalada */
export function InstallLink({ className }: { className?: string }) {
  const standalone = useStandalone()
  if (standalone !== false) return null
  return (
    <Link
      href="/instalar"
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl border px-4 py-3 outline-none hover:bg-muted active:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Smartphone className="size-6 shrink-0 text-primary" aria-hidden="true" />
      <span className="flex flex-1 flex-col">
        <span className="font-medium">Instala la app en tu móvil</span>
        <span className="text-sm text-muted-foreground">Ábrela desde un icono, como cualquier otra app</span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}
