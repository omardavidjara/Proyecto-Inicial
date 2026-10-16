import Link from "next/link"
import type { PlanSummary } from "@/lib/data/memberships"
import { formatDateShort } from "@/lib/dates"
import { planLimitLabel } from "@/lib/validation/plans"

// Tarifa del cliente y clases que le quedan (SPEC F4): tarjetas en «Inicio» y franja en «Calendario»

const PERIOD_LEFT = { week: "esta semana", month: "este mes" } as const

function nextLine(summary: PlanSummary) {
  return summary.next ? `Desde el ${formatDateShort(summary.next.startsOn)}: ${summary.next.planName}` : null
}

/** «Inicio»: dos tarjetas (clases que quedan y tarifa) o un aviso si no tiene tarifa */
export function PlanSummaryTiles({ summary }: { summary: PlanSummary }) {
  const { current } = summary
  const next = nextLine(summary)

  if (!current) {
    return (
      <section aria-label="Tu tarifa" className="flex flex-col gap-1 rounded-xl border bg-card p-4">
        <span className="font-semibold">Aún no tienes tarifa</span>
        <span className="text-sm text-muted-foreground">
          {next ?? "Sin tarifa no puedes reservar. Pide en recepción que te asignen una."}
        </span>
      </section>
    )
  }

  return (
    <section aria-label="Tu tarifa" className="grid grid-cols-2 gap-2">
      <div className="flex flex-col gap-1 rounded-xl border bg-card bg-brand-glow p-4 shadow-soft">
        {current.remaining == null || current.period === "unlimited" ? (
          <>
            <span className="text-sm text-muted-foreground">Clases</span>
            <span className="text-2xl font-semibold">Ilimitadas</span>
          </>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">{`Te quedan ${PERIOD_LEFT[current.period]}`}</span>
            <span className="text-2xl font-semibold tabular-nums">
              <span className="text-primary">{current.remaining}</span> de {current.classesPerPeriod}
            </span>
          </>
        )}
      </div>
      <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-soft">
        <span className="text-sm text-muted-foreground">Tu tarifa</span>
        <span className="font-semibold">{current.planName}</span>
        <span className="text-xs text-muted-foreground">{planLimitLabel(current)}</span>
        {next ? <span className="text-xs text-muted-foreground">{next}</span> : null}
      </div>
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
      className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0 truncate text-sm text-muted-foreground">{label}</span>
      <span className="shrink-0 font-semibold tabular-nums">{value}</span>
    </Link>
  )
}
