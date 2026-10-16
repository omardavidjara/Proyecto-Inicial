import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { AgendaMonth } from "@/components/admin/agenda"
import { coachPeriodHref, type CoachView } from "@/components/coach/taught-summary"
import type { AgendaRange } from "@/lib/agenda"
import type { AgendaSession } from "@/lib/data/agenda"
import { addDays, formatDayNumber, formatWeekRange, formatWeekdayShort, startOfMonth, startOfWeek, toDateKey, toTimeKey } from "@/lib/dates"
import { CLASS_COLOR_BG } from "@/lib/sessions"
import { cn } from "@/lib/utils"

// Calendario de un entrenador (SPEC F7): su semana de lunes a domingo o el mes; al tocar un día se abren sus clases.
// Lo usan «Mi semana» (`base` = /entrenador) y «Entrenadores» de administración. Componentes de servidor.

type PeriodProps = { view: CoachView; date: string; today: string; range: AgendaRange; base?: string }

/** ‹ periodo › y, si no es el actual, «Volver a esta semana / este mes» */
export function CoachPeriodNav({ view, date, today, range, base, subtitle }: PeriodProps & { subtitle?: string }) {
  const week = view === "semana"
  const isCurrent = week ? range.from === startOfWeek(today) : startOfMonth(date) === startOfMonth(today)
  return (
    <>
      <div className="flex items-center gap-2">
        <PeriodLink href={coachPeriodHref(view, range.prev, base)} label={week ? "Semana anterior" : "Mes anterior"} icon={<ChevronLeft />} />
        <div className="flex flex-1 flex-col items-center">
          <h2 className={cn("font-semibold first-letter:uppercase", week && "tabular-nums")}>{week ? formatWeekRange(range.from) : range.title}</h2>
          {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
        </div>
        <PeriodLink href={coachPeriodHref(view, range.next, base)} label={week ? "Semana siguiente" : "Mes siguiente"} icon={<ChevronRight />} />
      </div>
      {!isCurrent && (
        <Link href={coachPeriodHref(view, today, base)} className="-mt-4 inline-flex min-h-11 items-center self-center text-sm font-medium text-primary">
          {week ? "Volver a esta semana" : "Volver a este mes"}
        </Link>
      )}
    </>
  )
}

export function CoachCalendar({
  sessions,
  dayHref,
  ...period
}: PeriodProps & { sessions: AgendaSession[]; dayHref: (day: string) => string }) {
  if (period.view === "mes") {
    return (
      <>
        <CoachPeriodNav {...period} />
        <AgendaMonth range={period.range} date={period.date} sessions={sessions} today={period.today} dayHref={dayHref} />
      </>
    )
  }
  // Las canceladas se ven tachadas, pero no cuentan como clases
  const total = sessions.filter((s) => s.status === "scheduled").length
  return (
    <>
      <CoachPeriodNav {...period} subtitle={total === 1 ? "1 clase" : `${total} clases`} />
      <WeekGrid monday={period.range.from} today={period.today} sessions={sessions} dayHref={dayHref} />
    </>
  )
}

function WeekGrid({
  monday,
  today,
  sessions: all,
  dayHref,
}: {
  monday: string
  today: string
  sessions: AgendaSession[]
  dayHref: (day: string) => string
}) {
  const byDay = Map.groupBy(all, (s) => toDateKey(s.startsAt))
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((day) => ({ day, sessions: byDay.get(day) ?? [] }))

  return (
    <ol className="grid gap-2 lg:grid-cols-7">
      {week.map(({ day, sessions }) => {
        const isToday = day === today
        const past = day < today
        return (
          <li key={day} className="min-w-0">
            <Link
              href={dayHref(day)}
              className={cn(
                "flex min-h-16 min-w-0 gap-4 rounded-xl border bg-card p-3 outline-none transition-colors hover:bg-muted/50 active:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:h-full lg:min-h-48 lg:flex-col lg:gap-3",
                isToday && "border-primary",
                past && "bg-transparent"
              )}
            >
              <span className="flex w-12 shrink-0 flex-col items-center justify-center lg:w-auto lg:flex-row lg:justify-start lg:gap-2">
                <span className={cn("text-xs capitalize", isToday ? "font-semibold text-primary" : "text-muted-foreground")}>
                  {isToday ? "Hoy" : formatWeekdayShort(day)}
                </span>
                <span className="text-lg font-semibold tabular-nums">{formatDayNumber(day)}</span>
              </span>
              {sessions.length === 0 ? (
                <span className="flex flex-1 items-center text-sm text-muted-foreground lg:flex-none">Sin clases</span>
              ) : (
                <ul className="flex min-w-0 flex-1 flex-wrap content-center gap-1.5 lg:flex-col lg:flex-nowrap lg:content-stretch">
                  {sessions.map((s) => (
                    <li
                      key={s.id}
                      className={cn(
                        "flex min-w-0 items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-sm lg:flex-wrap",
                        s.status === "cancelled" && "line-through"
                      )}
                    >
                      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", CLASS_COLOR_BG[s.color])} />
                      <span className="font-medium tabular-nums">{toTimeKey(s.startsAt)}</span>
                      <span className="min-w-0 truncate text-muted-foreground lg:w-full lg:text-xs">{s.className}</span>
                    </li>
                  ))}
                </ul>
              )}
              <ChevronRight className="size-5 shrink-0 self-center text-muted-foreground lg:hidden" aria-hidden="true" />
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

function PeriodLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex size-11 items-center justify-center rounded-lg border bg-card outline-none hover:bg-muted active:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5"
    >
      <span aria-hidden="true">{icon}</span>
    </Link>
  )
}
