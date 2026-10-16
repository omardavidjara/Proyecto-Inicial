import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Page } from "@/components/app-shell/app-shell"
import { IncidentDetail } from "@/components/incidents/incident-detail"
import { IncidentDialog, IncidentStatusActions } from "@/components/incidents/incident-form"
import { getIncidentForAdmin } from "@/lib/dal"

export const metadata: Metadata = { title: "Incidencia" }

const BACK_TAB = { open: "abierta", in_progress: "en-curso", closed: "cerrada" } as const

// SPEC F9: datos de la incidencia, su cliente o sesión, quién la abrió, editar y cambiar de estado
export default async function AdminIncidentPage({ params }: PageProps<"/admin/incidencias/[incidentId]">) {
  await connection()
  const { incidentId } = await params
  const data = await getIncidentForAdmin(incidentId)
  if (!data) notFound()
  const { incident, timeZone } = data

  return (
    <Page title={incident.title} backHref={`/admin/incidencias?estado=${BACK_TAB[incident.status]}`} wide>
      <IncidentDetail
        incident={incident}
        timeZone={timeZone}
        clientHref={`/admin/clientes/${incident.clientId}`}
        sessionHref={`/admin/sesiones/${incident.sessionId}`}
      >
        <IncidentStatusActions id={incident.id} status={incident.status} />
        <IncidentDialog incident={incident} />
      </IncidentDetail>
    </Page>
  )
}
