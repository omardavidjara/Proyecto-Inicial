import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CalendarX2 } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { EmptyState } from "@/components/empty-state"
import { PrototypeNotice } from "@/components/prototype-notice"
import { SessionCard } from "@/components/sessions/session-card"
import { formatDayLabel, formatDayLong, isDateKey, startOfWeek } from "@/lib/dates"
import { PROTOTYPE_COACH, prototypeCoachSessions, prototypeToday } from "@/lib/prototype/data"
import { gymTimeNow, isClosed } from "@/lib/prototype/now"

export const metadata: Metadata = { title: "Mis clases del día" }

export default async function CoachDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  if (!isDateKey(date)) notFound()

  const today = prototypeToday()
  const now = gymTimeNow()
  const sessions = prototypeCoachSessions(date, PROTOTYPE_COACH, today)
  const thisWeek = startOfWeek(date) === startOfWeek(today)

  return (
    <Page
      title={formatDayLabel(date, today)}
      backHref={thisWeek ? "/entrenador" : `/entrenador?semana=${startOfWeek(date)}`}
    >
      <PrototypeNotice />
      <p className="-mt-2 text-muted-foreground first-letter:uppercase">{formatDayLong(date)}</p>
      {sessions.length === 0 ? (
        <EmptyState icon={<CalendarX2 />} title="No tienes clases este día" />
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <SessionCard
                session={{
                  ...s,
                  myBooking: undefined,
                  href: `/entrenador/sesiones/${s.id}`,
                  className: s.classType.name,
                  color: s.classType.color,
                  subtitle: `${s.booked}/${s.capacity} asistentes${s.waitlist ? ` · ${s.waitlist} en espera` : ""}`,
                  closed: isClosed(s.date, s.start, today, now),
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
