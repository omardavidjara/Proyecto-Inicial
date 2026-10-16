import type { Metadata } from "next"
import { Page } from "@/components/app-shell/app-shell"
import { IncidentIndex, incidentTab } from "@/components/incidents/incident-index"
import { IncidentDialog } from "@/components/incidents/incident-form"
import { countIncidentsForCoach, listIncidentsForCoach } from "@/lib/dal"

export const metadata: Metadata = { title: "Incidencias" }

// SPEC F9: las incidencias que ha abierto el entrenador, por estado, y abrir una nueva
export default async function CoachIncidenciasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { estado, limite } = await searchParams
  const tab = incidentTab(estado)
  const [items, counts] = await Promise.all([listIncidentsForCoach(tab.status, limite), countIncidentsForCoach()])

  return (
    <Page title="Incidencias" actions={<IncidentDialog area="coach" />}>
      <IncidentIndex basePath="/entrenador/incidencias" tab={tab} items={items} counts={counts} />
    </Page>
  )
}
