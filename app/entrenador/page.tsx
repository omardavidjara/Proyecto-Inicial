import type { Metadata } from "next"
import { Page } from "@/components/app-shell/app-shell"
import { CoachCalendar } from "@/components/coach/coach-calendar"
import { IndividualSessionDialog } from "@/components/coach/individual-session-dialog"
import { CoachSummaryTiles, CoachViewTabs, TaughtTable } from "@/components/coach/taught-summary"
import { getCoachPeriod, listIndividualClassTypesForCoach } from "@/lib/dal"

export const metadata: Metadata = { title: "Mi semana" }

// Inicio del entrenador: su semana de lunes a domingo (o el mes en calendario); al tocar un día se abren sus clases.
// Debajo, el resumen del periodo y las clases ya impartidas (docs/SPEC.md F7)
export default async function CoachWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const [{ today, view, date, range, sessions, summary }, individualTypes] = await Promise.all([
    getCoachPeriod(await searchParams),
    listIndividualClassTypesForCoach(),
  ])

  return (
    <Page title="Mi semana" wide actions={<IndividualSessionDialog classTypes={individualTypes} today={today} />}>
      <CoachViewTabs view={view} date={date} />
      <CoachCalendar view={view} date={date} today={today} range={range} sessions={sessions} dayHref={(day) => `/entrenador/dia/${day}`} />
      <CoachSummaryTiles summary={summary} />
      <TaughtTable sessions={summary.taughtSessions} />
    </Page>
  )
}
