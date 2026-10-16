import Link from "next/link"
import { CalendarDays, ChevronRight, User } from "lucide-react"
import { PriorityBadge, StatusBadge } from "@/components/incidents/incident-list"
import type { IncidentRow } from "@/lib/data/incidents"
import { formatDayLong, toDateKey, toTimeKey } from "@/lib/dates"

// Detalle de una incidencia (SPEC F9), compartido por administración y el entrenador. `children`: sus acciones

export function incidentWhen(date: Date, timeZone: string) {
  return `${formatDayLong(toDateKey(date, timeZone))} a las ${toTimeKey(date, timeZone)}`
}

export function IncidentDetail({
  incident,
  timeZone,
  clientHref,
  sessionHref,
  children,
}: {
  incident: IncidentRow
  timeZone: string
  /** Sin enlace, solo el nombre (el entrenador no ve fichas de clientes) */
  clientHref?: string
  sessionHref?: string
  children?: React.ReactNode
}) {
  const when = (date: Date) => incidentWhen(date, timeZone)
  const hasClient = incident.clientId && incident.clientName
  const hasSession = incident.sessionId && incident.sessionStartsAt

  return (
    <>
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
        {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      </section>

      {hasClient || hasSession ? (
        <section aria-labelledby="links-title" className="flex flex-col gap-3">
          <h2 id="links-title" className="text-lg font-semibold">
            Asociada a
          </h2>
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {hasClient ? (
              <li>
                <LinkRow href={clientHref} icon={<User />}>
                  <span className="font-medium">{incident.clientName}</span>
                </LinkRow>
              </li>
            ) : null}
            {hasSession ? (
              <li>
                <LinkRow href={sessionHref} icon={<CalendarDays />}>
                  <span className="font-medium">{incident.sessionClassName}</span>{" "}
                  <span className="text-sm text-muted-foreground">· {when(incident.sessionStartsAt!)}</span>
                </LinkRow>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </>
  )
}

function LinkRow({ href, icon, children }: { href?: string; icon: React.ReactNode; children: React.ReactNode }) {
  const content = (
    <>
      <span aria-hidden="true" className="text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span className="flex-1">{children}</span>
      {href ? <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
    </>
  )
  return href ? (
    <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
      {content}
    </Link>
  ) : (
    <div className="flex min-h-14 items-center gap-3 px-4 py-3">{content}</div>
  )
}
