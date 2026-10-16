import type { Metadata } from "next"
import Link from "next/link"
import { CalendarPlus, History, Ticket } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { EmptyState } from "@/components/empty-state"
import { BookingHistory } from "@/components/sessions/booking-history"
import { PlanSummaryTiles } from "@/components/sessions/plan-summary"
import { SessionTimeline } from "@/components/sessions/session-timeline"
import { Button } from "@/components/ui/button"
import { toHistoryEntries } from "@/lib/booking-history"
import type { MyBookingRow } from "@/lib/data/my-bookings"
import { getBookingSettings, getMyBookingHistory, getMyPlanSummary, getMyUpcomingBookings } from "@/lib/dal"
import { formatDayLabel, toDateKey, toTimeKey } from "@/lib/dates"

export const metadata: Metadata = { title: "Mis reservas" }

export default async function MisReservasPage() {
  const [settings, plan, upcoming, history] = await Promise.all([
    getBookingSettings(),
    getMyPlanSummary(),
    getMyUpcomingBookings(),
    getMyBookingHistory(),
  ])
  const { timeZone } = settings
  const today = toDateKey(new Date(), timeZone)

  // Próximas agrupadas por día (vienen ordenadas por hora)
  const days = new Map<string, MyBookingRow[]>()
  for (const booking of upcoming) {
    const key = toDateKey(booking.startsAt, timeZone)
    days.set(key, [...(days.get(key) ?? []), booking])
  }

  return (
    <Page title="Mis reservas">
      <PlanSummaryTiles summary={plan} />

      <section aria-labelledby="upcoming-title" className="flex flex-col gap-3">
        <h2 id="upcoming-title" className="text-lg font-semibold">
          Próximas
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState
            icon={<Ticket />}
            title="No tienes reservas próximas"
            description="Reserva tu próxima clase desde el calendario."
            action={
              <Button asChild>
                <Link href="/calendario">
                  <CalendarPlus data-icon="inline-start" aria-hidden="true" />
                  Reservar clase
                </Link>
              </Button>
            }
          />
        ) : (
          [...days].map(([day, bookings]) => (
            <div key={day} className="flex flex-col gap-1.5">
              <h3 className="text-sm font-medium text-primary">{formatDayLabel(day, today)}</h3>
              <SessionTimeline
                sessions={bookings.map((b) => ({
                  href: `/calendario/${b.sessionId}`,
                  start: toTimeKey(b.startsAt, timeZone),
                  end: toTimeKey(b.endsAt, timeZone),
                  className: b.className,
                  color: b.color,
                  subtitle: b.coachName ?? "Sin entrenador asignado",
                  capacity: b.capacity,
                  booked: b.booked,
                  status: b.sessionStatus,
                  closed: false,
                  myBooking: {
                    status: b.status as "confirmed" | "waitlisted",
                    waitlistPosition: b.waitlistPosition,
                  },
                }))}
              />
            </div>
          ))
        )}
      </section>

      <section aria-labelledby="history-title" className="flex flex-col gap-3">
        <h2 id="history-title" className="text-lg font-semibold">
          Historial
        </h2>
        {history.items.length === 0 ? (
          <EmptyState
            icon={<History />}
            title="Aún no hay historial"
            description="Aquí verás tus clases pasadas y las reservas que anules."
          />
        ) : (
          <BookingHistory initial={toHistoryEntries(history.items, timeZone, today)} initialCursor={history.nextCursor} />
        )}
      </section>
    </Page>
  )
}
