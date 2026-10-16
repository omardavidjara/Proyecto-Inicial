"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { createContext, useContext, type ReactNode } from "react"
import { CircleUserRound } from "lucide-react"
import { cn } from "@/lib/utils"

// AppShell indica el perfil de su rol; las pantallas sin marco (p. ej. /instalar) no muestran el botón
const ProfileHrefContext = createContext<string | undefined>(undefined)

export function ProfileHrefProvider({ href, children }: { href?: string; children: ReactNode }) {
  return <ProfileHrefContext.Provider value={href}>{children}</ProfileHrefContext.Provider>
}

/** Botón de perfil arriba a la derecha de la cabecera de marca */
export function ProfileLink() {
  const href = useContext(ProfileHrefContext)
  const pathname = usePathname()
  if (!href) return null
  const active = pathname === href
  return (
    <Link
      href={href}
      aria-label="Mi perfil"
      aria-current={active ? "page" : undefined}
      className={cn(
        "-mr-2 flex size-11 items-center justify-center rounded-full outline-none hover:bg-muted active:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring",
        active ? "text-primary" : "text-foreground",
      )}
    >
      <CircleUserRound className="size-7" aria-hidden="true" />
    </Link>
  )
}
