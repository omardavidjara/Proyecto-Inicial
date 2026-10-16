import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { CalendarDays, Clock, User, Users } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { LateCancellations } from "@/components/admin/late-cancellations"
import { AddClientDialog, AttendeeList, WaitlistList } from "@/components/admin/session-detail"
import { SessionIncidents } from "@/components/incidents/session-incidents"
import { Badge } from "@/components/ui/badge"
import { agendaHref, lateCancellationItem } from "@/lib/agenda"
import { getSessionDetailForAdmin, listSessionIncidentsForAdmin } from "@/lib/dal"
import { formatDayLong, toDateKey, toTimeKey } from "@/lib/dates"
import { CLASS_COLOR_BG } from "@/lib/sessions"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Sesión" }

// SPEC F6: asistentes (con la asistencia), lista de espera, anulaciones tardías y añadir o quitar a mano
export default async function AdminSessionPage({ params }: PageProps<"/admin/sesiones/[sessionId]">) {
  await connection() // la asistencia y la lista de espera dependen de la hora actual
  const { sessionId } = await params
  const [session, incidents] = await Promise.all([getSessionDetailForAdmin(sessionId), listSessionIncidentsForAdmin(sessionId)])
  if (!session) notFound()

  const now = new Date()
  const today = toDateKey(now)
  const day = toDateKey(session.startsAt)
  const cancelled = session.status === "cancelled"
  const started = session.startsAt <= now
  const booked = session.attendees.length
  const count = (value: string) => session.attendees.filter((a) => a.attendance === value).length
  const pendingLate = session.lateCancellations.filter((l) => l.charged === null)
  const decidedLate = session.lateCancellations.filter((l) => l.charged !== null)

  return (
    <Page title={session.className} backHref={agendaHref("dia", day)} wide>
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
          <Row icon={<User />} label="Entrenador">{session.coachName ?? "Sin entrenador asignado"}</Row>
          <Row icon={<Users />} label="Plazas">
            <span className="tabular-nums">
              {booked}/{session.capacity} ocupadas
              {session.waitlist.length > 0 && ` · ${session.waitlist.length} en espera`}
            </span>
          </Row>
        </dl>
      </section>

      <section aria-labelledby="attendees-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="attendees-title" className="text-lg font-semibold">
            Asistentes
          </h2>
          {!cancelled && <AddClientDialog sessionId={session.id} />}
        </div>
        {!cancelled && booked > 0 && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {started
              ? `Asistieron ${count("attended")} · Faltaron ${count("no_show")} · Sin marcar ${count("pending")}`
              : "Podrás marcar la asistencia cuando empiece la sesión"}
          </p>
        )}
        <AttendeeList items={session.attendees} canMark={started} readOnly={cancelled} />
      </section>

      {session.waitlist.length > 0 && (
        <section aria-labelledby="waitlist-title" className="flex flex-col gap-3">
          <h2 id="waitlist-title" className="text-lg font-semibold">
            Lista de espera
          </h2>
          <WaitlistList sessionId={session.id} items={session.waitlist} readOnly={cancelled} />
        </section>
      )}

      {session.lateCancellations.length > 0 && (
        <section aria-labelledby="late-title" className="flex flex-col gap-3">
          <h2 id="late-title" className="text-lg font-semibold">
            Anulaciones tardías
          </h2>
          {pendingLate.length > 0 && (
            <LateCancellations
              items={pendingLate.map((l) =>
                lateCancellationItem(
                  { id: l.bookingId, clientName: l.fullName, className: session.className, startsAt: session.startsAt, cancelledAt: l.cancelledAt },
                  today,
                ),
              )}
            />
          )}
          {decidedLate.length > 0 && (
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {decidedLate.map((l) => (
                <li key={l.bookingId} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
                  <span className="font-medium">{l.fullName}</span>
                  <Badge variant={l.charged ? "destructive" : "secondary"}>{l.charged ? "Descontada" : "No descontada"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <SessionIncidents area="admin" session={session} items={incidents} />
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
