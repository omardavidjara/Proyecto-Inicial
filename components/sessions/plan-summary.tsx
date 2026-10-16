import Link from "next/link"
import type { PlanSummary } from "@/lib/data/memberships"
import { formatDateShort } from "@/lib/dates"
import { planLimitLabel } from "@/lib/validation/plans"

// Tarifa del cliente y clases que le quedan (SPEC F4): tarjetas en «Inicio» y franja en «Calendario»

const PERIOD_LEFT = { week: "esta semana", month: "este mes" } as const

function nextLine(summary: PlanSummary) {
  return summary.next ? `Desde el ${formatDateShort(summary.next.startsOn)}: ${summary.next.planName}` : null
}

/**
 * «Inicio» y «Mis reservas»: clases que quedan con una barra que se llena al entrar, y la tarifa al lado.
 * Sin tarjeta: un bloque integrado en la pantalla, separado por una línea.
 */
export function PlanSummaryTiles({ summary }: { summary: PlanSummary }) {
  const { current } = summary
  const next = nextLine(summary)

  if (!current) {
    return (
      <section aria-label="Tu tarifa" className="flex flex-col gap-1 border-y py-4">
        <span className="font-semibold">Aún no tienes tarifa</span>
        <span className="text-sm text-muted-foreground">
          {next ?? "Sin tarifa no puedes reservar. Pide en recepción que te asignen una."}
        </span>
      </section>
    )
  }

  const limited = current.remaining != null && current.period !== "unlimited" && current.classesPerPeriod
  const left = limited ? Math.max(0, Math.min(1, current.remaining! / current.classesPerPeriod!)) : 1

  return (
    <section aria-label="Tu tarifa" className="flex flex-col gap-3 border-y py-4">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          {limited ? (
            <>
              <span className="text-sm text-muted-foreground">{`Te quedan ${PERIOD_LEFT[current.period as keyof typeof PERIOD_LEFT]}`}</span>
              <span className="text-2xl font-semibold tabular-nums">
                <span className="text-primary">{current.remaining}</span> de {current.classesPerPeriod}
              </span>
            </>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">Clases</span>
              <span className="text-2xl font-semibold">Ilimitadas</span>
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
          <span className="text-xs text-muted-foreground">Tu tarifa</span>
          <span className="font-semibold">{current.planName}</span>
          <span className="text-xs text-muted-foreground">{planLimitLabel(current)}</span>
        </div>
      </div>
      {/* Decorativa: el texto de arriba ya dice cuántas quedan */}
      <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full origin-left animate-grow rounded-full bg-brand-gradient"
          style={{ width: `${Math.round(left * 100)}%` }}
        />
      </div>
      {next ? <span className="text-xs text-muted-foreground">{next}</span> : null}
    </section>
  )
}

/** «Calendario»: una franja con la tarifa y las clases que quedan, enlazada a «Mis reservas» */
export function PlanSummaryBar({ summary }: { summary: PlanSummary }) {
  const { current } = summary
  let label: string
  let value: React.ReactNode
  if (!current) {
    label = "Sin tarifa"
    value = "No puedes reservar"
  } else if (current.remaining == null || current.period === "unlimited") {
    label = `Tarifa ${current.planName}`
    value = "Ilimitada"
  } else {
    label = `Tarifa ${current.planName}`
    value = (
      <>
        Te quedan <span className="text-primary">{current.remaining}</span> {PERIOD_LEFT[current.period]}
      </>
    )
  }

  return (
    <Link
      href="/reservas"
      className="flex min-h-11 items-center justify-between gap-3 rounded-full bg-muted px-4 py-2 outline-none transition-transform duration-150 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0 truncate text-sm text-muted-foreground">{label}</span>
      <span className="shrink-0 font-semibold tabular-nums">{value}</span>
    </Link>
  )
}
