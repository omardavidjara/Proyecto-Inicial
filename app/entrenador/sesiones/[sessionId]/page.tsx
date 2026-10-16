import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { CalendarDays, Clock, Users } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { AttendeeList, WaitlistList } from "@/components/admin/session-detail"
import { SessionIncidents } from "@/components/incidents/session-incidents"
import { Badge } from "@/components/ui/badge"
import { getSessionDetailForCoach, listSessionIncidentsForCoach } from "@/lib/dal"
import { formatDayLong, toDateKey, toTimeKey } from "@/lib/dates"
import { CLASS_COLOR_BG } from "@/lib/sessions"
import { cn } from "@/lib/utils"

import { setCoachAttendanceAction } from "./actions"

export const metadata: Metadata = { title: "Asistentes" }

// SPEC F7: asistentes de una sesión que imparte, con la asistencia y su resumen (quién reservó y no vino).
// Mismo diseño que el detalle del administrador, sin añadir ni quitar clientes ni anulaciones tardías.
export default async function CoachSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  await connection() // la asistencia y la lista de espera dependen de la hora actual
  const { sessionId } = await params
  const [session, incidents] = await Promise.all([getSessionDetailForCoach(sessionId), listSessionIncidentsForCoach(sessionId)])
  if (!session) notFound()

  const now = new Date()
  const day = toDateKey(session.startsAt)
  const cancelled = session.status === "cancelled"
  const started = session.startsAt <= now
  const booked = session.attendees.length
  const count = (value: string) => session.attendees.filter((a) => a.attendance === value).length

  return (
    <Page title={session.className} backHref={`/entrenador/dia/${day}`}>
      <section className="relative flex flex-col gap-4 overflow-hidden rounded-xl border bg-card p-5 pl-6">
        <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1.5", CLASS_COLOR_BG[session.color])} />
        {cancelled && (
          <div className="flex flex-col gap-1">
            <Badge variant="destructive">Cancelada</Badge>
            {session.cancelReason && <p className="text-sm text-muted-foreground">Motivo: {session.cancelReason}</p>}
          </div>
        )}
        <dl className="grid gap-3 sm:grid-cols-2">
          <Row icon={<CalendarDays />} label="Día">
            <span className="first-letter:uppercase">{formatDayLong(day)}</span>
          </Row>
          <Row icon={<Clock />} label="Hora">
            <span className="tabular-nums">
              {toTimeKey(session.startsAt)}–{toTimeKey(session.endsAt)}
            </span>
          </Row>
          <Row icon={<Users />} label="Plazas">
            <span className="tabular-nums">
              {booked}/{session.capacity} ocupadas
              {session.waitlist.length > 0 && ` · ${session.waitlist.length} en espera`}
            </span>
          </Row>
        </dl>
      </section>

      <section aria-labelledby="attendees-title" className="flex flex-col gap-3">
        <h2 id="attendees-title" className="text-lg font-semibold">
          Asistentes
        </h2>
        {!cancelled && booked > 0 && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {started
              ? `Asistieron ${count("attended")} · Faltaron ${count("no_show")} · Sin marcar ${count("pending")}`
              : "Podrás marcar la asistencia cuando empiece la sesión"}
          </p>
        )}
        <AttendeeList items={session.attendees} canMark={started} readOnly={cancelled} markAction={setCoachAttendanceAction} canRemove={false} />
      </section>

      {session.waitlist.length > 0 && (
        <section aria-labelledby="waitlist-title" className="flex flex-col gap-3">
          <h2 id="waitlist-title" className="text-lg font-semibold">
            Lista de espera
          </h2>
          <WaitlistList sessionId={session.id} items={session.waitlist} readOnly />
        </section>
      )}

      <SessionIncidents area="coach" session={session} items={incidents} />
    </Page>
  )
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <dt className="text-muted-foreground [&_svg]:size-5">
        <span aria-hidden="true">{icon}</span>
        <span className="sr-only">{label}</span>
      </dt>
      <dd>{children}</dd>
    </div>
  )
}
