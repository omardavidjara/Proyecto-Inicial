import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { Bell, CalendarPlus, Megaphone, Ticket } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { EmptyState } from "@/components/empty-state"
import { PrototypeNotice } from "@/components/prototype-notice"
import { SessionCard } from "@/components/sessions/session-card"
import { Button } from "@/components/ui/button"
import { formatDayLabel } from "@/lib/dates"
import {
  ANNOUNCEMENTS,
  PROTOTYPE_CLIENT,
  prototypeNextBooking,
  prototypeToday,
} from "@/lib/prototype/data"
import { gymTimeNow } from "@/lib/prototype/now"

export const metadata: Metadata = { title: "Inicio" }

export default async function ClientHomePage() {
  await connection() // la próxima clase depende de la hora actual
  const today = prototypeToday()
  const now = gymTimeNow()
  const next = prototypeNextBooking(today, now)

  return (
    <Page
      title={`Hola, ${PROTOTYPE_CLIENT}`}
      actions={
        <Link
          href="/avisos"
          aria-label={`Avisos (${ANNOUNCEMENTS.length} nuevos)`}
          className="relative -mr-3 flex size-11 items-center justify-center rounded-lg outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell className="size-6" aria-hidden="true" />
          <span aria-hidden="true" className="absolute top-2.5 right-2.5 size-2.5 rounded-full bg-primary ring-2 ring-background" />
        </Link>
      }
    >
      <PrototypeNotice />

      <section aria-labelledby="next-title" className="flex flex-col gap-3">
        <h2 id="next-title" className="text-lg font-semibold">
          Tu próxima clase
        </h2>
        {next ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-primary">{formatDayLabel(next.date, today)}</p>
            <SessionCard
              session={{
                ...next,
                href: `/calendario/${next.id}`,
                className: next.classType.name,
                color: next.classType.color,
                subtitle: next.coach,
                closed: false,
              }}
            />
          </div>
        ) : (
          <EmptyState icon={<Ticket />} title="No tienes clases reservadas" description="Reserva tu próxima clase desde el calendario." />
        )}
      </section>

      <section aria-label="Tu tarifa" className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
          <span className="text-sm text-muted-foreground">Te quedan esta semana</span>
          <span className="text-2xl font-semibold tabular-nums">
            <span className="text-primary">1</span> de 3
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
          <span className="text-sm text-muted-foreground">Tu tarifa</span>
          <span className="font-semibold">3 clases / semana</span>
        </div>
      </section>

      <Button asChild size="lg" className="w-full">
        <Link href="/calendario">
          <CalendarPlus data-icon="inline-start" aria-hidden="true" />
          Reservar clase
        </Link>
      </Button>

      <section aria-labelledby="news-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="news-title" className="text-lg font-semibold">
            Avisos del gimnasio
          </h2>
          <Link href="/avisos" className="inline-flex min-h-11 items-center text-sm font-medium text-primary">
            Ver todos
          </Link>
        </div>
        <ul className="flex flex-col gap-2">
          {ANNOUNCEMENTS.map((a) => (
            <li key={a.id} className="flex gap-3 rounded-xl border bg-card p-4">
              <Megaphone className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <span className="font-medium">{a.title}</span>
                <span className="text-sm text-muted-foreground">{a.body}</span>
                <span className="text-xs text-muted-foreground">{a.date}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </Page>
  )
}
