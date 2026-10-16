import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { IncidentRow } from "@/lib/data/incidents"
import { formatDateShort, toDateKey } from "@/lib/dates"
import { PRIORITY_LABEL, STATUS_LABEL, type IncidentPriority, type IncidentStatus } from "@/lib/validation/incidents"

// Incidencias (SPEC F9): lista compartida por administración (lista y ficha del cliente) y el entrenador

const PRIORITY_VARIANT: Record<IncidentPriority, "destructive" | "warning" | "secondary"> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
}

const STATUS_VARIANT: Record<IncidentStatus, "warning" | "default" | "outline"> = {
  open: "warning",
  in_progress: "default",
  closed: "outline",
}

export function PriorityBadge({ priority }: { priority: IncidentPriority }) {
  return <Badge variant={PRIORITY_VARIANT[priority]}>Prioridad {PRIORITY_LABEL[priority].toLowerCase()}</Badge>
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
}

/** Cada incidencia enlaza a `${hrefBase}/${id}`. `showStatus` en listas que mezclan estados (ficha del cliente) */
export function IncidentList({
  items,
  hrefBase,
  showStatus = false,
  showClient = true,
}: {
  items: IncidentRow[]
  hrefBase: string
  showStatus?: boolean
  showClient?: boolean
}) {
  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {items.map((incident) => (
        <li key={incident.id}>
          <Link
            href={`${hrefBase}/${incident.id}`}
            className="flex min-h-16 items-center gap-3 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate font-medium">{incident.title}</span>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {showStatus ? <StatusBadge status={incident.status} /> : null}
                <PriorityBadge priority={incident.priority} />
                <span className="text-sm text-muted-foreground">
                  {[
                    formatDateShort(toDateKey(incident.createdAt)),
                    showClient && incident.clientName ? incident.clientName : null,
                    `por ${incident.createdByName}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
