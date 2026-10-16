import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Page } from "@/components/app-shell/app-shell"
import { CoachCalendar } from "@/components/coach/coach-calendar"
import { CoachSummaryTiles, CoachViewTabs, TaughtTable, coachPeriodHref } from "@/components/coach/taught-summary"
import { agendaHref } from "@/lib/agenda"
import { getCoachPeriodForAdmin } from "@/lib/dal"

export const metadata: Metadata = { title: "Entrenador" }

// SPEC F7: el calendario de un entrenador con su resumen y las clases que ha impartido. Solo consulta:
// cada día lleva a la agenda y cada clase a su detalle de administración
export default async function AdminCoachPage({ params, searchParams }: PageProps<"/admin/entrenadores/[coachId]">) {
  await connection()
  const { coachId } = await params
  const data = await getCoachPeriodForAdmin(coachId, await searchParams)
  if (!data) notFound()
  const { coach, today, view, date, range, sessions, summary } = data
  const base = `/admin/entrenadores/${coach.userId}`

  return (
    <Page title={coach.fullName} backHref={coachPeriodHref(view, date, "/admin/entrenadores")} wide>
      <CoachViewTabs view={view} date={date} base={base} />
      <CoachCalendar view={view} date={date} today={today} range={range} base={base} sessions={sessions} dayHref={(day) => agendaHref("dia", day)} />
      <CoachSummaryTiles summary={summary} />
      <TaughtTable sessions={summary.taughtSessions} sessionHref={(id) => `/admin/sesiones/${id}`} emptyText="No ha dado clases en este periodo." />
    </Page>
  )
}
