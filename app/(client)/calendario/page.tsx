import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftRight, CalendarX2 } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { AgendaMonth, AgendaToolbar } from "@/components/admin/agenda"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { DayPicker } from "@/components/sessions/day-picker"
import { PlanSummaryBar } from "@/components/sessions/plan-summary"
import { SessionTimeline } from "@/components/sessions/session-timeline"
import { daysBetween } from "@/lib/agenda"
import { calendarHref, clientCalendarPeriod, opensLabel } from "@/lib/client-calendar"
import type { CalendarSession } from "@/lib/data/calendar"
import { getBookingSettings, getMyBookingToChange, getMyCalendarBetween, getMyPlanSummary } from "@/lib/dal"
import { addDays, formatDayLabel, formatDayLong, toDateKey, toTimeKey } from "@/lib/dates"

export const metadata: Metadata = { title: "Calendario" }

// SPEC F5: Día (con el selector de los días que admiten reserva), Semana (de hoy al domingo) y Mes (todas las
// sesiones generadas; las que aún no admiten reserva llevan «Se abre …»)
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { vista, fecha, cambiar } = await searchParams
  const settings = await getBookingSettings()
  const { timeZone } = settings
  const now = new Date()
  const today = toDateKey(now, timeZone)
  const { view, date, range, canGoBack } = clientCalendarPeriod({ vista, fecha }, today)
  // Los días pasados no se consultan
  const from = view === "dia" ? date : range.from < today ? today : range.from

  const [sessions, plan, changing] = await Promise.all([
    getMyCalendarBetween(from, range.to),
    getMyPlanSummary(),
    cambiar ? getMyBookingToChange(cambiar) : null,
  ])
  const hrefFor = (v: typeof view, day: string) => calendarHref(v, day, changing?.id)
  const changeQuery = changing ? `?cambiar=${changing.id}` : ""
  const timeline = (daySessions: CalendarSession[]) => (
    <SessionTimeline
      sessions={daySessions.map((s) => ({
        href: `/calendario/${s.id}${changeQuery}`,
        start: toTimeKey(s.startsAt, timeZone),
        end: toTimeKey(s.endsAt, timeZone),
        className: s.className,
        color: s.color,
        subtitle: s.coachName ?? "Sin entrenador asignado",
        capacity: s.capacity,
        booked: s.booked,
        status: s.status,
        closed: s.startsAt <= now,
        opensLabel: opensLabel(s.startsAt, now, settings, timeZone),
        myBooking: s.myBooking ?? undefined,
      }))}
    />
  )
  const byDay = Map.groupBy(sessions, (s) => toDateKey(s.startsAt, timeZone))

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
            {formatDayLabel(toDateKey(changing.startsAt, timeZone), today).toLowerCase()} a las{" "}
            {toTimeKey(changing.startsAt, timeZone)}).
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href={calendarHref(view, date)}>No cambiar</Link>
          </Button>
        </section>
      )}
      <AgendaToolbar view={view} date={date} today={today} range={range} hrefFor={hrefFor} canGoBack={canGoBack} />

      {view === "dia" && (
        <>
          {/* Atajo a los días que ya admiten reserva */}
          <DayPicker
            days={Array.from({ length: settings.bookingWindowDays }, (_, i) => addDays(today, i))}
            selected={date}
            hrefFor={(day) => hrefFor("dia", day)}
          />
          <section aria-label={formatDayLong(date)} className="flex flex-col gap-3">
            {sessions.length === 0 ? (
              <EmptyState
                icon={<CalendarX2 />}
                title="No hay clases este día"
                description="No hay sesiones programadas. Elige otro día."
              />
            ) : (
              timeline(sessions)
            )}
          </section>
        </>
      )}

      {view === "semana" && (
        <div className="flex flex-col gap-6">
          {daysBetween(from, range.to).map((day) => {
            const daySessions = byDay.get(day) ?? []
            return (
              <section key={day} aria-labelledby={`day-${day}`} className="flex flex-col gap-1">
                <h3 id={`day-${day}`} className="font-semibold first-letter:uppercase">
                  <Link href={hrefFor("dia", day)} className="hover:underline">
                    {day === today || day === addDays(today, 1) ? `${formatDayLabel(day, today)} · ${formatDayLong(day)}` : formatDayLong(day)}
                  </Link>
                </h3>
                {daySessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin clases</p>
                ) : (
                  timeline(daySessions)
                )}
              </section>
            )
          })}
        </div>
      )}

      {view === "mes" && (
        <AgendaMonth range={range} date={date} sessions={sessions} today={today} dayHref={(day) => hrefFor("dia", day)} minDay={today} />
      )}
    </Page>
  )
}
