import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Users } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { AttendanceList } from "@/components/coach/attendance-list"
import { EmptyState } from "@/components/empty-state"
import { PrototypeNotice } from "@/components/prototype-notice"
import { Badge } from "@/components/ui/badge"
import { formatDayLabel } from "@/lib/dates"
import { prototypeAttendees, prototypeSession, prototypeToday } from "@/lib/prototype/data"
import { gymTimeNow, isClosed } from "@/lib/prototype/now"
import { CLASS_COLOR_BG } from "@/lib/sessions"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Asistentes" }

export default async function CoachSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const session = prototypeSession(sessionId)
  if (!session) notFound()

  const today = prototypeToday()
  const started = isClosed(session.date, session.start, today, gymTimeNow())
  const attendees = prototypeAttendees(session)

  return (
    <Page title={session.classType.name} backHref={`/entrenador/dia/${session.date}`}>
      <PrototypeNotice />
      <section className="relative flex flex-wrap items-center gap-x-4 gap-y-2 overflow-hidden rounded-xl border bg-card p-4 pl-5">
        <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1.5", CLASS_COLOR_BG[session.classType.color])} />
        <span className="font-semibold">
          {formatDayLabel(session.date, today)} · <span className="tabular-nums">{session.start}–{session.end}</span>
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {session.booked}/{session.capacity} asistentes
        </span>
        {session.waitlist > 0 && <Badge variant="warning">{session.waitlist} en lista de espera</Badge>}
        {session.status === "cancelled" && <Badge variant="outline">Cancelada</Badge>}
      </section>

      <section aria-labelledby="attendees-title" className="flex flex-col gap-3">
        <h2 id="attendees-title" className="text-lg font-semibold">
          Asistentes
        </h2>
        {attendees.length === 0 ? (
          <EmptyState icon={<Users />} title="Aún no hay nadie apuntado" />
        ) : (
          <AttendanceList attendees={attendees} canMark={started && session.status === "scheduled"} />
        )}
      </section>
    </Page>
  )
}
