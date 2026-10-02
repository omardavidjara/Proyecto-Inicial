import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CalendarDays, Clock, Info, User, Users } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { PrototypeNotice } from "@/components/prototype-notice"
import { BookingActions } from "@/components/sessions/booking-actions"
import { SessionStatusBadge } from "@/components/sessions/session-status"
import { formatDayLong } from "@/lib/dates"
import { prototypeSession, prototypeToday } from "@/lib/prototype/data"
import { gymTimeNow, isClosed } from "@/lib/prototype/now"
import { CLASS_COLOR_BG, availability } from "@/lib/sessions"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Sesión" }

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const session = prototypeSession(sessionId)
  if (!session) notFound()

  const today = prototypeToday()
  const now = gymTimeNow()
  const closed = isClosed(session.date, session.start, today, now)
  const { remaining } = availability(session.capacity, session.booked)
  const percent = Math.min(100, Math.round((session.booked / session.capacity) * 100))
  const lateCancel = session.date === today && minutesUntil(session.start, now) < 120

  return (
    <Page title={session.classType.name} backHref={`/calendario?fecha=${session.date}`}>
      <PrototypeNotice />
      <section className="relative flex flex-col gap-4 overflow-hidden rounded-xl border bg-card p-5 pl-6">
        <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1.5", CLASS_COLOR_BG[session.classType.color])} />
        <SessionStatusBadge session={{ ...session, closed }} />
        <dl className="grid gap-3">
          <Row icon={<CalendarDays />} label="Día">
            <span className="first-letter:uppercase">{formatDayLong(session.date)}</span>
          </Row>
          <Row icon={<Clock />} label="Hora">
            <span className="tabular-nums">{session.start}–{session.end}</span>
          </Row>
          <Row icon={<User />} label="Entrenador">{session.coach}</Row>
          <Row icon={<Users />} label="Plazas">
            <span className="tabular-nums">
              {session.booked}/{session.capacity} ocupadas
              {session.waitlist > 0 && ` · ${session.waitlist} en espera`}
            </span>
          </Row>
        </dl>
        <div
          role="meter"
          aria-label="Ocupación"
          aria-valuemin={0}
          aria-valuemax={session.capacity}
          aria-valuenow={session.booked}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      </section>

      <p className="flex gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Puedes anular sin penalización hasta 2 horas antes. Si la clase está completa, entra en la lista de
        espera y te avisaremos si queda una plaza libre.
      </p>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] mt-auto lg:bottom-4">
        <BookingActions
          initial={session.myBooking?.status === "late_cancelled" ? "none" : (session.myBooking?.status ?? "none")}
          full={remaining === 0}
          lateCancel={lateCancel}
          disabledReason={
            session.status === "cancelled" ? "Sesión cancelada" : closed ? "Reservas cerradas" : undefined
          }
        />
      </div>
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

function minutesUntil(start: string, now: string): number {
  const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  return toMinutes(start) - toMinutes(now)
}
