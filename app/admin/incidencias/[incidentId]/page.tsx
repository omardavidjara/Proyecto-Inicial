import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { CalendarDays, ChevronRight, User } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { IncidentDialog, IncidentStatusActions } from "@/components/admin/incident-form"
import { PriorityBadge, StatusBadge } from "@/components/incidents/incident-list"
import { getIncidentForAdmin } from "@/lib/dal"
import { formatDayLong, toDateKey, toTimeKey } from "@/lib/dates"

export const metadata: Metadata = { title: "Incidencia" }

const BACK_TAB = { open: "abierta", in_progress: "en-curso", closed: "cerrada" } as const

// SPEC F9: datos de la incidencia, su cliente o sesión, quién la abrió, editar y cambiar de estado
export default async function AdminIncidentPage({ params }: PageProps<"/admin/incidencias/[incidentId]">) {
  await connection()
  const { incidentId } = await params
  const data = await getIncidentForAdmin(incidentId)
  if (!data) notFound()
  const { incident, timeZone } = data
  const when = (date: Date) => `${formatDayLong(toDateKey(date, timeZone))} a las ${toTimeKey(date, timeZone)}`

  return (
    <Page title={incident.title} backHref={`/admin/incidencias?estado=${BACK_TAB[incident.status]}`} wide>
      <section aria-label="Incidencia" className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={incident.status} />
          <PriorityBadge priority={incident.priority} />
        </div>
        <p className="whitespace-pre-line break-words">{incident.description}</p>
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <span className="first-letter:uppercase">
            Abierta por {incident.createdByName} el {when(incident.createdAt)}
          </span>
          {incident.closedAt ? <span className="first-letter:uppercase">Cerrada el {when(incident.closedAt)}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IncidentStatusActions id={incident.id} status={incident.status} />
          <IncidentDialog incident={incident} />
        </div>
      </section>

      {incident.clientId || incident.sessionId ? (
        <section aria-labelledby="links-title" className="flex flex-col gap-3">
          <h2 id="links-title" className="text-lg font-semibold">
            Asociada a
          </h2>
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {incident.clientId ? (
              <li>
                <Link
                  href={`/admin/clientes/${incident.clientId}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <User className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="flex-1 font-medium">{incident.clientName}</span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ) : null}
            {incident.sessionId && incident.sessionStartsAt ? (
              <li>
                <Link
                  href={`/admin/sesiones/${incident.sessionId}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="flex-1">
                    <span className="font-medium">{incident.sessionClassName}</span>{" "}
                    <span className="text-sm text-muted-foreground">· {when(incident.sessionStartsAt)}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </Page>
  )
}
