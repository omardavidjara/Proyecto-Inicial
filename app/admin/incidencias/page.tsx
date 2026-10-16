import type { Metadata } from "next"
import { Page } from "@/components/app-shell/app-shell"
import { IncidentIndex, incidentTab } from "@/components/incidents/incident-index"
import { IncidentDialog } from "@/components/incidents/incident-form"
import { countIncidentsForAdmin, listIncidentsForAdmin } from "@/lib/dal"

export const metadata: Metadata = { title: "Incidencias" }

// SPEC F9: todas las incidencias, por estado, con «Nueva incidencia» (cliente opcional)
export default async function IncidenciasPage({ searchParams }: PageProps<"/admin/incidencias">) {
  const { estado, limite } = await searchParams
  const tab = incidentTab(estado)
  const [items, counts] = await Promise.all([listIncidentsForAdmin(tab.status, limite), countIncidentsForAdmin()])

  return (
    <Page title="Incidencias" wide actions={<IncidentDialog />}>
      <IncidentIndex basePath="/admin/incidencias" tab={tab} items={items} counts={counts} />
    </Page>
  )
}
