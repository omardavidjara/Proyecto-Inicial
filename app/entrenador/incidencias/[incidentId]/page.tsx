import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Page } from "@/components/app-shell/app-shell"
import { IncidentDetail } from "@/components/incidents/incident-detail"
import { getIncidentForCoach } from "@/lib/dal"

export const metadata: Metadata = { title: "Incidencia" }

const BACK_TAB = { open: "abierta", in_progress: "en-curso", closed: "cerrada" } as const

// SPEC F9: una incidencia que abrió el entrenador, solo consulta (el estado lo lleva administración)
export default async function CoachIncidentPage({ params }: { params: Promise<{ incidentId: string }> }) {
  await connection()
  const { incidentId } = await params
  const data = await getIncidentForCoach(incidentId)
  if (!data) notFound()
  const { incident, timeZone } = data

  return (
    <Page title={incident.title} backHref={`/entrenador/incidencias?estado=${BACK_TAB[incident.status]}`}>
      <IncidentDetail incident={incident} timeZone={timeZone} sessionHref={`/entrenador/sesiones/${incident.sessionId}`} />
      <p className="text-sm text-muted-foreground">Administración la revisa y cambia su estado.</p>
    </Page>
  )
}
