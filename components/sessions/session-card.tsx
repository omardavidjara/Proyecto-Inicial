import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { CLASS_COLOR_BG, type ClassColor } from "@/lib/sessions"
import { SessionStatusBadge, type SessionStatusInput } from "./session-status"

export type SessionCardData = SessionStatusInput & {
  href: string
  start: string
  end: string
  className: string
  color: ClassColor
  /** Debajo del nombre: el entrenador (cliente) o la ocupación (entrenador) */
  subtitle: string
}

/** Tarjeta de sesión del calendario: toda la tarjeta es el objetivo táctil */
export function SessionCard({ session }: { session: SessionCardData }) {
  const cancelled = session.status === "cancelled"
  const mine = session.myBooking?.status === "confirmed"
  return (
    <Link
      href={session.href}
      className={cn(
        "relative flex min-h-20 items-center gap-4 overflow-hidden rounded-xl border bg-card py-3 pr-3 pl-5 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        mine && "border-primary",
        (session.closed || cancelled) && "opacity-60"
      )}
    >
      <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1.5", CLASS_COLOR_BG[session.color])} />
      <div className="flex w-14 shrink-0 flex-col">
        <span className="text-lg font-semibold tabular-nums">{session.start}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{session.end}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className={cn("truncate font-medium", cancelled && "line-through")}>{session.className}</span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm text-muted-foreground">{session.subtitle}</span>
          <SessionStatusBadge session={session} />
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}
