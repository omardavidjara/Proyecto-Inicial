"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type NavItem = {
  href: string
  label: string
  icon: ReactNode
  /** Solo activo en la ruta exacta (p. ej. "/admin", que es prefijo de las demás) */
  exact?: boolean
}

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">) {
  if (pathname === item.href) return true
  return !item.exact && pathname.startsWith(item.href + "/")
}

/**
 * Navegación principal: barra inferior en móvil y barra lateral en pantallas ≥ 1024 px.
 * docs/DESIGN.md §5: icono + etiqueta siempre visibles, 64 px + safe area.
 */
export function BottomNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-safe shadow-[0_-1px_8px_rgb(0_0_0/0.06)] backdrop-blur lg:inset-y-0 lg:right-auto lg:w-60 lg:border-t-0 lg:border-r lg:pt-safe lg:shadow-none"
    >
      <ul className="mx-auto flex h-16 max-w-2xl lg:mt-20 lg:h-auto lg:flex-col lg:gap-1 lg:px-3">
        {items.map((item) => {
          const active = isActive(pathname, item)
          return (
            <li key={item.href} className="flex-1 lg:flex-none">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-6",
                  "lg:h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm lg:[&_svg]:size-5",
                  active
                    ? "text-primary lg:bg-primary/10"
                    : "hover:text-foreground lg:hover:bg-muted"
                )}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
