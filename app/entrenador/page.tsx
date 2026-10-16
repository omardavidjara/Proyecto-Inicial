import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { IndividualSessionDialog } from "@/components/coach/individual-session-dialog"
import { getCoachWeek, listIndividualClassTypesForCoach } from "@/lib/dal"
import { addDays, formatDayNumber, formatWeekRange, formatWeekdayShort, startOfWeek, toDateKey, toTimeKey } from "@/lib/dates"
import { CLASS_COLOR_BG } from "@/lib/sessions"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Mi semana" }

// Inicio del entrenador: su semana de lunes a domingo; al tocar un día se abren sus clases (docs/SPEC.md F7)
export default async function CoachWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { semana } = await searchParams
  const [{ today, monday, sessions: all }, individualTypes] = await Promise.all([getCoachWeek(semana), listIndividualClassTypesForCoach()])
  const byDay = Map.groupBy(all, (s) => toDateKey(s.startsAt))
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((day) => ({ day, sessions: byDay.get(day) ?? [] }))
  // Las canceladas se ven tachadas, pero no cuentan como clases
  const total = all.filter((s) => s.status === "scheduled").length

  return (
    <Page title="Mi semana" wide actions={<IndividualSessionDialog classTypes={individualTypes} today={today} />}>
      <div className="flex items-center gap-2">
        <WeekLink monday={addDays(monday, -7)} label="Semana anterior" icon={<ChevronLeft />} />
        <div className="flex flex-1 flex-col items-center">
          <span className="font-semibold tabular-nums">{formatWeekRange(monday)}</span>
          <span className="text-sm text-muted-foreground">
            {total === 1 ? "1 clase" : `${total} clases`}
          </span>
        </div>
        <WeekLink monday={addDays(monday, 7)} label="Semana siguiente" icon={<ChevronRight />} />
      </div>
      {monday !== startOfWeek(today) && (
        <Link href="/entrenador" className="-mt-4 inline-flex min-h-11 items-center self-center text-sm font-medium text-primary">
          Volver a esta semana
        </Link>
      )}

      <ol className="grid gap-2 lg:grid-cols-7">
        {week.map(({ day, sessions }) => {
          const isToday = day === today
          const past = day < today
          return (
            <li key={day} className="min-w-0">
              <Link
                href={`/entrenador/dia/${day}`}
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
    </Page>
  )
}

function WeekLink({ monday, label, icon }: { monday: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={`/entrenador?semana=${monday}`}
      aria-label={label}
      className="flex size-11 items-center justify-center rounded-lg border bg-card outline-none hover:bg-muted active:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5"
    >
      <span aria-hidden="true">{icon}</span>
    </Link>
  )
}
