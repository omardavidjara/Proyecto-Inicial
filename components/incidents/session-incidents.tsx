import { TriangleAlert } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { IncidentDialog } from "@/components/incidents/incident-form"
import { IncidentList } from "@/components/incidents/incident-list"
import type { IncidentRow } from "@/lib/data/incidents"
import { formatDayLong, toDateKey, toTimeKey } from "@/lib/dates"

type SessionPeople = {
  id: string
  className: string
  startsAt: Date
  attendees: { userId: string; fullName: string }[]
  waitlist: { userId: string; fullName: string }[]
}

// Incidencias de una sesión en su detalle (SPEC F9): administración ve todas; el entrenador, las suyas.
// «Nueva incidencia» ya va asociada a la sesión y deja elegir a alguien apuntado
export function SessionIncidents({
  area,
  session,
  items,
}: {
  area: "admin" | "coach"
  session: SessionPeople
  items: IncidentRow[]
}) {
  const people = new Map([...session.attendees, ...session.waitlist].map((p) => [p.userId, { userId: p.userId, fullName: p.fullName }]))
  const label = `${session.className} · ${formatDayLong(toDateKey(session.startsAt))}, ${toTimeKey(session.startsAt)}`

  return (
    <section aria-labelledby="incidents-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="incidents-title" className="text-lg font-semibold">
          Incidencias
        </h2>
        <IncidentDialog area={area} session={{ id: session.id, label }} sessionClients={[...people.values()]} />
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<TriangleAlert />} title="Sin incidencias" />
      ) : (
        <IncidentList items={items} hrefBase={area === "admin" ? "/admin/incidencias" : "/entrenador/incidencias"} showStatus />
      )}
    </section>
  )
}
