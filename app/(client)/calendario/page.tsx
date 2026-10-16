import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftRight, CalendarX2 } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { DayPicker } from "@/components/sessions/day-picker"
import { PlanSummaryBar } from "@/components/sessions/plan-summary"
import { SessionTimeline } from "@/components/sessions/session-timeline"
import { getBookingSettings, getMyBookingToChange, getMyCalendarDay, getMyPlanSummary } from "@/lib/dal"
import { addDays, formatDayLabel, formatDayLong, isDateKey, toDateKey, toTimeKey } from "@/lib/dates"

export const metadata: Metadata = { title: "Calendario" }

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { fecha, cambiar } = await searchParams
  const settings = await getBookingSettings()
  const now = new Date()
  const today = toDateKey(now, settings.timeZone)
  // Los días con reservas abiertas: de hoy a la ventana de reserva
  const days = Array.from({ length: settings.bookingWindowDays }, (_, i) => addDays(today, i))
  const selected = isDateKey(fecha) && days.includes(fecha) ? fecha : today

  const [sessions, plan, changing] = await Promise.all([
    getMyCalendarDay(selected),
    getMyPlanSummary(),
    cambiar ? getMyBookingToChange(cambiar) : null,
  ])
  const changeQuery = changing ? `cambiar=${changing.id}` : ""
  const withChange = (path: string, hasQuery = false) =>
    changeQuery ? `${path}${hasQuery ? "&" : "?"}${changeQuery}` : path

  return (
    <Page title="Calendario">
      <PlanSummaryBar summary={plan} />
      {changing && (
        <section
          aria-label="Cambiar de sesión"
          className="flex flex-col gap-3 rounded-xl border border-primary bg-card p-4 sm:flex-row sm:items-center"
        >
          <ArrowLeftRight className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="flex-1 text-sm">
            Elige la sesión a la que quieres cambiar tu reserva de <strong>{changing.className}</strong> (
            {formatDayLabel(toDateKey(changing.startsAt, settings.timeZone), today).toLowerCase()} a las{" "}
            {toTimeKey(changing.startsAt, settings.timeZone)}).
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/calendario?fecha=${selected}`}>No cambiar</Link>
          </Button>
        </section>
      )}
      <DayPicker days={days} selected={selected} hrefFor={(day) => withChange(`/calendario?fecha=${day}`, true)} />
      <section aria-labelledby="day-title" className="flex flex-col gap-3">
        <h2 id="day-title" className="text-lg font-semibold first-letter:uppercase">
          {formatDayLong(selected)}
        </h2>
        {sessions.length === 0 ? (
          <EmptyState
            icon={<CalendarX2 />}
            title="No hay clases este día"
            description="No hay sesiones programadas. Elige otro día."
          />
        ) : (
          <SessionTimeline
            sessions={sessions.map((s) => ({
              href: withChange(`/calendario/${s.id}`),
              start: toTimeKey(s.startsAt, settings.timeZone),
              end: toTimeKey(s.endsAt, settings.timeZone),
              className: s.className,
              color: s.color,
              subtitle: s.coachName ?? "Sin entrenador asignado",
              capacity: s.capacity,
              booked: s.booked,
              status: s.status,
              closed: s.startsAt <= now,
              myBooking: s.myBooking ?? undefined,
            }))}
          />
        )}
      </section>
    </Page>
  )
}
