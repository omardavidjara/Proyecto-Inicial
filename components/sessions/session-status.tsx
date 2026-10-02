import { Check, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { availability } from "@/lib/sessions"

export type SessionStatusInput = {
  capacity: number
  booked: number
  status: "scheduled" | "cancelled"
  closed: boolean
  myBooking?: { status: "confirmed" | "waitlisted" | "late_cancelled"; waitlistPosition?: number }
}

/** Insignia de estado de una sesión (docs/DESIGN.md §2.2): color + texto, nunca solo color */
export function SessionStatusBadge({ session }: { session: SessionStatusInput }) {
  if (session.status === "cancelled") return <Badge variant="outline">Cancelada</Badge>
  if (session.myBooking?.status === "confirmed")
    return (
      <Badge>
        <Check data-icon="inline-start" aria-hidden="true" />
        Reservada
      </Badge>
    )
  if (session.myBooking?.status === "waitlisted")
    return (
      <Badge variant="warning">
        <Clock data-icon="inline-start" aria-hidden="true" />
        En espera · nº {session.myBooking.waitlistPosition}
      </Badge>
    )
  if (session.myBooking?.status === "late_cancelled") return <Badge variant="destructive">Anulación tardía</Badge>
  if (session.closed) return <Badge variant="secondary">Cerrada</Badge>

  const { kind, label } = availability(session.capacity, session.booked)
  if (kind === "full") return <Badge variant="secondary">Completa · lista de espera</Badge>
  return <Badge variant={kind === "few" ? "warning" : "success"}>{label}</Badge>
}
