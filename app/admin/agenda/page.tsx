import type { Metadata } from "next"
import { connection } from "next/server"
import { Page } from "@/components/app-shell/app-shell"
import { AgendaDay, AgendaMonth, AgendaToolbar, AgendaWeek } from "@/components/admin/agenda"
import { getAdminAgenda } from "@/lib/dal"

export const metadata: Metadata = { title: "Agenda" }

// SPEC F6: todas las sesiones por día, semana o mes, con ocupación y lista de espera (canceladas incluidas)
export default async function AgendaPage({ searchParams }: PageProps<"/admin/agenda">) {
  await connection() // "hoy" se calcula en cada petición, no al compilar
  const { today, view, date, range, sessions } = await getAdminAgenda(await searchParams)
  const now = new Date()

  return (
    <Page title="Agenda" wide>
      <AgendaToolbar view={view} date={date} today={today} range={range} />
      {view === "dia" && <AgendaDay sessions={sessions} now={now} />}
      {view === "semana" && <AgendaWeek range={range} sessions={sessions} today={today} now={now} />}
      {view === "mes" && <AgendaMonth range={range} date={date} sessions={sessions} today={today} />}
    </Page>
  )
}
