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
    // --shell-offset: ancho de la barra lateral (≥ 1024 px), que la cabecera de marca recupera para ocupar todo el ancho
    <div className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60 lg:[--shell-offset:15rem]">
      <a
        href="#contenido"
        className="sr-only z-[60] rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-[calc(env(safe-area-inset-top)+0.5rem)] focus:left-2 focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Saltar al contenido
      </a>
      {children}
      <BottomNav items={nav} label={navLabel} />
    </div>
  )
}

/**
 * Pantalla: cabecera fija de marca (logo + "Athlos", lleva al inicio de cada rol a través de "/")
 * y, en el contenido, el título (un h1 por pantalla) con "Volver" y las acciones.
 */
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
      <header className="sticky top-0 z-30 border-b bg-background/95 pt-safe backdrop-blur lg:-ml-[var(--shell-offset,0px)]">
        <div className={cn("mx-auto flex h-14 items-center px-4 lg:max-w-none lg:px-6", width)}>
          <Link
            href="/"
            aria-label="Athlos, ir al inicio"
            className="-ml-2 flex min-h-11 items-center gap-2 rounded-lg px-2 text-lg font-semibold tracking-tight outline-none hover:bg-muted active:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Image src="/logo.png" alt="" width={32} height={32} className="size-8" priority />
            Athlos
          </Link>
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className={cn("mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-4 outline-none", width)}>
        <div className="flex min-h-11 items-center gap-1">
          {backHref && (
            <Link
              href={backHref}
              aria-label="Volver"
              className="-ml-3 flex size-11 shrink-0 items-center justify-center rounded-lg outline-none hover:bg-muted active:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="size-6" aria-hidden="true" />
            </Link>
          )}
          <h1 className="flex-1 truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {actions}
        </div>
        {children}
      </main>
    </>
  )
}
