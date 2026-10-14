import type { Metadata } from "next"
import Link from "next/link"
import { Bell, CalendarPlus, Ticket } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { EmptyState } from "@/components/empty-state"
import { PlanSummaryTiles } from "@/components/sessions/plan-summary"
import { SessionCard } from "@/components/sessions/session-card"
import { Button } from "@/components/ui/button"
import { getBookingSettings, getMyFirstName, getMyNextBooking, getMyPlanSummary } from "@/lib/dal"
import { formatDayLabel, toDateKey, toTimeKey } from "@/lib/dates"

export const metadata: Metadata = { title: "Inicio" }

// Los últimos avisos del gimnasio llegan con la F10 (SPEC: «Inicio» los muestra)
export default async function ClientHomePage() {
  const [name, next, plan, settings] = await Promise.all([
    getMyFirstName(),
    getMyNextBooking(),
    getMyPlanSummary(),
    getBookingSettings(),
  ])
  const { timeZone } = settings
  const today = toDateKey(new Date(), timeZone)

  return (
    <Page
      title={name ? `Hola, ${name}` : "Hola"}
      actions={
        <Link
          href="/avisos"
          aria-label="Avisos"
          className="-mr-3 flex size-11 items-center justify-center rounded-lg outline-none hover:bg-muted active:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell className="size-6" aria-hidden="true" />
        </Link>
      }
    >
      <section aria-labelledby="next-title" className="flex flex-col gap-3">
        <h2 id="next-title" className="text-lg font-semibold">
          Tu próxima clase
        </h2>
        {next ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-primary">{formatDayLabel(toDateKey(next.startsAt, timeZone), today)}</p>
            <SessionCard
              session={{
                href: `/calendario/${next.sessionId}`,
                start: toTimeKey(next.startsAt, timeZone),
                end: toTimeKey(next.endsAt, timeZone),
                className: next.className,
                color: next.color,
                subtitle: next.coachName ?? "Sin entrenador asignado",
                capacity: next.capacity,
                booked: next.booked,
                status: next.sessionStatus,
                closed: false,
                myBooking: { status: "confirmed" },
              }}
            />
          </div>
        ) : (
          <EmptyState icon={<Ticket />} title="No tienes clases reservadas" description="Reserva tu próxima clase desde el calendario." />
        )}
      </section>

      <PlanSummaryTiles summary={plan} />

      <Button asChild size="lg" className="w-full">
        <Link href="/calendario">
          <CalendarPlus data-icon="inline-start" aria-hidden="true" />
          Reservar clase
        </Link>
      </Button>

      <Link href="/reservas" className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-primary">
        Ver mis reservas
      </Link>
    </Page>
  )
}
