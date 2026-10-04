import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { ChevronLeft } from "lucide-react"
import { BottomNav, type NavItem } from "./bottom-nav"
import { cn } from "@/lib/utils"

/** Marco de las secciones con navegación (cliente, admin, entrenador). */
export function AppShell({
  nav,
  navLabel,
  children,
}: {
  nav: NavItem[]
  navLabel: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60">
      <a
        href="#contenido"
        className="sr-only z-[60] rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-[calc(env(safe-area-inset-top)+0.5rem)] focus:left-2 focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Saltar al contenido
      </a>
      <Link
        href="/"
        className="fixed top-0 left-0 z-50 hidden h-20 w-60 items-center gap-3 px-6 pt-safe font-semibold tracking-tight lg:flex"
      >
        <Image src="/logo.png" alt="" width={40} height={40} className="size-10" />
        Athlos
      </Link>
      {children}
      <BottomNav items={nav} label={navLabel} />
    </div>
  )
}

/** Pantalla: cabecera fija con el título (un h1 por pantalla) y contenido centrado. */
export function Page({
  title,
  backHref,
  actions,
  wide = false,
  children,
}: {
  title: string
  /** Muestra la flecha "Volver" hacia esta ruta */
  backHref?: string
  actions?: ReactNode
  /** Contenido ancho (admin) en lugar de columna de lectura (cliente) */
  wide?: boolean
  children: ReactNode
}) {
  const width = wide ? "max-w-6xl" : "max-w-2xl"
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/95 pt-safe backdrop-blur">
        <div className={cn("mx-auto flex h-14 items-center gap-1 px-4", width)}>
          {backHref && (
            <Link
              href={backHref}
              aria-label="Volver"
              className="-ml-3 flex size-11 items-center justify-center rounded-lg outline-none hover:bg-muted active:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="size-6" aria-hidden="true" />
            </Link>
          )}
          <h1 className="flex-1 truncate text-xl font-semibold tracking-tight">{title}</h1>
          {actions}
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className={cn("mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-4 outline-none", width)}>
        {children}
      </main>
    </>
  )
}
