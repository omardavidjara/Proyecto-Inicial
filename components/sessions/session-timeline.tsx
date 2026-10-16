import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { CLASS_COLOR_BG } from "@/lib/sessions"
import type { SessionCardData } from "./session-card"
import { SessionStatusBadge } from "./session-status"

/**
 * Sesiones del cliente como línea de tiempo (docs/DESIGN.md §7): hora a la izquierda y un punto del color
 * de la clase sobre una línea vertical. Sin tarjetas: cada fila entera es el objetivo táctil.
 */
export function SessionTimeline({ sessions }: { sessions: SessionCardData[] }) {
  return (
    <ul className="stagger flex flex-col">
      {sessions.map((session, i) => {
        const cancelled = session.status === "cancelled"
        const mine = session.myBooking?.status === "confirmed"
        const off = session.closed || cancelled
        return (
          <li key={session.href} className="relative">
            {/* Tramo de la línea vertical: empieza en el primer punto y acaba en el último */}
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-[5.125rem] w-px bg-border",
                i === 0 ? "top-1/2" : "top-0",
                i === sessions.length - 1 ? "bottom-1/2" : "bottom-0",
                sessions.length === 1 && "hidden"
              )}
            />
            <Link
              href={session.href}
              className={cn(
                "relative flex min-h-18 items-center gap-3 rounded-xl py-3 pr-2 pl-1 outline-none transition-[background-color,transform] duration-150 hover:bg-muted/60 active:scale-[0.98] active:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                off && "text-muted-foreground"
              )}
            >
              <div className="flex w-14 shrink-0 flex-col items-end">
                <span className="text-lg font-semibold tabular-nums">{session.start}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{session.end}</span>
              </div>
              <span aria-hidden="true" className="flex w-5 shrink-0 justify-center">
                <span
                  className={cn(
                    "rounded-full ring-4 ring-background",
                    // Reservada: punto mayor con halo (además de la insignia «Reservada»)
                    mine ? "size-4 animate-pop ring-primary/25" : "size-3",
                    off ? "bg-muted-foreground/50" : CLASS_COLOR_BG[session.color]
                  )}
                />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={cn("truncate font-medium", mine && "text-primary", cancelled && "line-through")}>{session.className}</span>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm text-muted-foreground">{session.subtitle}</span>
                  <SessionStatusBadge session={session} />
                </div>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
