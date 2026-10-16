import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CoachSummary } from "@/lib/coach-summary"
import { formatDateShort, toDateKey, toTimeKey } from "@/lib/dates"
import { CLASS_COLOR_BG } from "@/lib/sessions"
import { cn } from "@/lib/utils"

// Clases impartidas del entrenador (SPEC F7): selector Semana | Mes, resumen del periodo y tabla de las ya dadas.
// Componentes de servidor: las fechas no llegan al navegador.

const linkFocus = "outline-none focus-visible:ring-2 focus-visible:ring-ring"

export type CoachView = "semana" | "mes"

export const coachPeriodHref = (view: CoachView, date: string) =>
  view === "semana" ? `/entrenador?semana=${date}` : `/entrenador?vista=mes&fecha=${date}`

export function CoachViewTabs({ view, date }: { view: CoachView; date: string }) {
  const views = [
    { param: "semana", label: "Semana" },
    { param: "mes", label: "Mes" },
  ] as const
  return (
    <nav aria-label="Periodo" className="flex gap-1 rounded-xl bg-muted p-1 sm:w-56">
      {views.map((v) => (
        <Link
          key={v.param}
          href={coachPeriodHref(v.param, date)}
          aria-current={v.param === view ? "page" : undefined}
          className={cn(
            "flex min-h-11 flex-1 items-center justify-center rounded-lg text-sm font-medium",
            linkFocus,
            v.param === view ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v.label}
        </Link>
      ))}
    </nav>
  )
}

/** «Impartidas · Programadas · Canceladas» del periodo */
export function CoachSummaryTiles({ summary }: { summary: CoachSummary }) {
  const tiles = [
    { label: "Impartidas", value: summary.taught },
    { label: "Programadas", value: summary.scheduled },
    { label: "Canceladas", value: summary.cancelled },
  ]
  return (
    <dl className="grid grid-cols-3 gap-2">
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col-reverse items-center gap-0.5 rounded-xl border bg-card p-3">
          <dt className="text-xs text-muted-foreground sm:text-sm">{t.label}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{t.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Clases ya dadas del periodo: fecha, hora, tipo y asistieron/reservaron; cada fila lleva a su detalle */
export function TaughtTable({ sessions }: { sessions: CoachSummary["taughtSessions"] }) {
  return (
    <section aria-labelledby="taught-title" className="flex flex-col gap-2">
      <h2 id="taught-title" className="text-lg font-semibold">
        Clases impartidas
      </h2>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no has dado clases en este periodo.</p>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Fecha</TableHead>
                <TableHead>Clase</TableHead>
                <TableHead className="pr-4 text-right">Asistieron</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.id} className="relative h-14 focus-within:bg-muted/50">
                  <TableCell className="pl-4 tabular-nums">
                    <span className="flex flex-col">
                      <span>{formatDateShort(toDateKey(s.startsAt))}</span>
                      <span className="text-xs text-muted-foreground">{toTimeKey(s.startsAt)}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", CLASS_COLOR_BG[s.color])} />
                      {/* El enlace cubre toda la fila (after:absolute) */}
                      <Link href={`/entrenador/sesiones/${s.id}`} className="outline-none after:absolute after:inset-0">
                        {s.className}
                      </Link>
                    </span>
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums" aria-label={`${s.attended} de ${s.booked} asistieron`}>
                    {s.attended}/{s.booked}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
