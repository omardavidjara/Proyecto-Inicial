import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { CLASS_COLOR_BG, type ClassColor } from "@/lib/sessions"

export type NextClass = {
  href: string
  /** «Hoy», «Mañana», «lun 20 oct» */
  dayLabel: string
  start: string
  end: string
  className: string
  color: ClassColor
  coachName: string | null
  /** «Empieza en 25 min»; null si falta mucho */
  startsIn: string | null
  /** Falta menos de una hora: el aviso late */
  soon: boolean
}

/**
 * «Inicio»: franja de bienvenida de lado a lado con la próxima clase (docs/DESIGN.md §1.4 y §4).
 * Un degradado suave y un brillo de marca que flota despacio; sin tarjeta.
 */
export function NextClassHero({ next }: { next: NextClass | null }) {
  return (
    <section
      aria-labelledby="next-title"
      className="relative -mx-4 -mt-2 flex flex-col gap-3 overflow-hidden bg-brand-hero px-4 py-5"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-12 size-48 animate-float rounded-full bg-brand/25 blur-3xl"
      />
      <h2 id="next-title" className="relative text-sm font-medium text-muted-foreground">
        Tu próxima clase
      </h2>
      {next ? (
        <Link
          href={next.href}
          className="group relative -mx-2 flex items-center gap-4 rounded-xl px-2 py-1 outline-none transition-transform duration-150 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex shrink-0 flex-col">
            <span className="text-sm font-medium text-primary">{next.dayLabel}</span>
            <span className="text-4xl font-semibold tracking-tight tabular-nums">{next.start}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 border-l pl-4">
            <span className="flex items-center gap-2 text-lg font-semibold">
              <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", CLASS_COLOR_BG[next.color])} />
              <span className="truncate">{next.className}</span>
            </span>
            <span className="truncate text-sm text-muted-foreground tabular-nums">
              {`${next.start}–${next.end} · ${next.coachName ?? "Sin entrenador asignado"}`}
            </span>
          </div>
          <ChevronRight
            className="size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      ) : (
        <p className="relative text-muted-foreground">No tienes clases reservadas. Reserva la próxima desde el calendario.</p>
      )}
      {next?.startsIn ? (
        <p className="relative flex items-center gap-2 text-sm font-medium text-primary">
          <span aria-hidden="true" className="relative flex size-2">
            {next.soon ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" /> : null}
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          {next.startsIn}
        </p>
      ) : null}
    </section>
  )
}
