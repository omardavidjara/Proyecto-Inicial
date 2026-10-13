import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CalendarDays, Clock, Info, User, Users } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { BookingActions } from "@/components/sessions/booking-actions"
import { SessionStatusBadge } from "@/components/sessions/session-status"
import { bookingOpensAt, bookingWindow, formatMinutes, isLateCancel } from "@/lib/booking"
import { getBookingSettings, getMyBookingToChange, getMyCalendarSession } from "@/lib/dal"
import { formatDayLabel, formatDayLong, toDateKey, toTimeKey } from "@/lib/dates"
import { CLASS_COLOR_BG, availability } from "@/lib/sessions"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Sesión" }

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const [{ sessionId }, { cambiar }] = await Promise.all([params, searchParams])
  const [session, settings, changing] = await Promise.all([
    getMyCalendarSession(sessionId),
    getBookingSettings(),
    cambiar ? getMyBookingToChange(cambiar) : null,
  ])
  if (!session) notFound()

  const { timeZone } = settings
  const now = new Date()
  const today = toDateKey(now, timeZone)
  const day = toDateKey(session.startsAt, timeZone)
  const state = bookingWindow(session.startsAt, now, settings)
  const { remaining } = availability(session.capacity, session.booked)
  const percent = Math.min(100, Math.round((session.booked / session.capacity) * 100))
  const deadline = formatMinutes(settings.cancelDeadlineMinutes)
  const live = session.myBooking && session.myBooking.status !== "late_cancelled" ? session.myBooking : null
  const opensAt = bookingOpensAt(session.startsAt, settings)
  const disabledReason =
    session.status === "cancelled"
      ? "Sesión cancelada"
      : state === "closed"
        ? "Reservas cerradas"
        : state === "not_open_yet"
          ? `Las reservas abren ${formatDayLabel(toDateKey(opensAt, timeZone), today).toLowerCase()} a las ${toTimeKey(opensAt, timeZone)}`
          : undefined
  // Cambiar a esta sesión desde otra reserva mía
  const changeFrom =
    changing && changing.sessionId !== session.id
      ? {
          bookingId: changing.id,
          label: `${changing.className} (${formatDayLabel(toDateKey(changing.startsAt, timeZone), today).toLowerCase()} a las ${toTimeKey(changing.startsAt, timeZone)})`,
          late: isLateCancel(changing.startsAt, now, settings),
        }
      : undefined

  return (
    <Page title={session.className} backHref={`/calendario?fecha=${day}${changeFrom ? `&cambiar=${changeFrom.bookingId}` : ""}`}>
      <section className="relative flex flex-col gap-4 overflow-hidden rounded-xl border bg-card p-5 pl-6">
        <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1.5", CLASS_COLOR_BG[session.color])} />
        <SessionStatusBadge
          session={{
            capacity: session.capacity,
            booked: session.booked,
            status: session.status,
            closed: state === "closed",
            myBooking: session.myBooking ?? undefined,
          }}
        />
        {session.status === "cancelled" && (
          <p className="text-sm text-muted-foreground">El gimnasio ha cancelado esta sesión.</p>
        )}
        <dl className="grid gap-3">
          <Row icon={<CalendarDays />} label="Día">
            <span className="first-letter:uppercase">{formatDayLong(day)}</span>
          </Row>
          <Row icon={<Clock />} label="Hora">
            <span className="tabular-nums">
              {toTimeKey(session.startsAt, timeZone)}–{toTimeKey(session.endsAt, timeZone)}
            </span>
          </Row>
          <Row icon={<User />} label="Entrenador">{session.coachName ?? "Sin entrenador asignado"}</Row>
          <Row icon={<Users />} label="Plazas">
            <span className="tabular-nums">
              {session.booked}/{session.capacity} ocupadas
              {session.waitlisted > 0 && ` · ${session.waitlisted} en espera`}
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
        Puedes anular sin penalización hasta {deadline} antes. Si la clase está completa, entra en la lista de
        espera: si queda una plaza libre, entrarás automáticamente.
      </p>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] mt-auto lg:bottom-4">
        <BookingActions
          sessionId={session.id}
          myBooking={live ? { id: live.id, status: live.status as "confirmed" | "waitlisted" } : null}
          full={remaining === 0}
          lateCancel={isLateCancel(session.startsAt, now, settings)}
          deadline={deadline}
          disabledReason={disabledReason}
          changeFrom={changeFrom}
          changeHref={live ? `/calendario?fecha=${day}&cambiar=${live.id}` : undefined}
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
