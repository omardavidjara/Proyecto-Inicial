import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CalendarX2 } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { EmptyState } from "@/components/empty-state"
import { SessionCard } from "@/components/sessions/session-card"
import { getCoachDay } from "@/lib/dal"
import { formatDayLabel, formatDayLong, isDateKey, startOfWeek, toTimeKey } from "@/lib/dates"

export const metadata: Metadata = { title: "Mis clases del día" }

export default async function CoachDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  if (!isDateKey(date)) notFound()

  const now = new Date()
  const { today, sessions } = await getCoachDay(date)
  const thisWeek = startOfWeek(date) === startOfWeek(today)

  return (
    <Page
      title={formatDayLabel(date, today)}
      backHref={thisWeek ? "/entrenador" : `/entrenador?semana=${startOfWeek(date)}`}
    >
      <p className="-mt-2 text-muted-foreground first-letter:uppercase">{formatDayLong(date)}</p>
      {sessions.length === 0 ? (
        <EmptyState icon={<CalendarX2 />} title="No tienes clases este día" />
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <SessionCard
                session={{
                  href: `/entrenador/sesiones/${s.id}`,
                  start: toTimeKey(s.startsAt),
                  end: toTimeKey(s.endsAt),
                  className: s.className,
                  color: s.color,
                  capacity: s.capacity,
                  booked: s.booked,
                  status: s.status,
                  subtitle: `${s.booked}/${s.capacity} asistentes${s.waitlisted ? ` · ${s.waitlisted} en espera` : ""}`,
                  closed: s.startsAt <= now,
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
