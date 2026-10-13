import type { Metadata } from "next"
import { CalendarX2 } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { EmptyState } from "@/components/empty-state"
import { PrototypeNotice } from "@/components/prototype-notice"
import { DayPicker } from "@/components/sessions/day-picker"
import { PlanSummaryBar } from "@/components/sessions/plan-summary"
import { SessionCard } from "@/components/sessions/session-card"
import { getMyPlanSummary } from "@/lib/dal"
import { formatDayLong, isDateKey } from "@/lib/dates"
import { prototypeSessions, prototypeToday, prototypeWeek } from "@/lib/prototype/data"
import { gymTimeNow, isClosed } from "@/lib/prototype/now"

export const metadata: Metadata = { title: "Calendario" }

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const today = prototypeToday()
  const week = prototypeWeek(today)
  const { fecha } = await searchParams
  const selected = isDateKey(fecha) && week.includes(fecha) ? fecha : today
  const now = gymTimeNow()
  const sessions = prototypeSessions(selected, today)
  const plan = await getMyPlanSummary()

  return (
    <Page title="Calendario">
      <PrototypeNotice />
      <PlanSummaryBar summary={plan} />
      <DayPicker days={week} selected={selected} hrefFor={(day) => `/calendario?fecha=${day}`} />
      <section aria-labelledby="day-title" className="flex flex-col gap-3">
        <h2 id="day-title" className="text-lg font-semibold first-letter:uppercase">
          {formatDayLong(selected)}
        </h2>
        {sessions.length === 0 ? (
          <EmptyState
            icon={<CalendarX2 />}
            title="No hay clases este día"
            description="El gimnasio cierra los domingos. Elige otro día."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <SessionCard
                  session={{
                    ...s,
                    href: `/calendario/${s.id}`,
                    className: s.classType.name,
                    color: s.classType.color,
                    subtitle: s.coach,
                    closed: isClosed(s.date, s.start, today, now),
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  )
}
