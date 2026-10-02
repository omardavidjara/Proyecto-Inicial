import type { Metadata } from "next"
import { connection } from "next/server"
import { Page } from "@/components/app-shell/app-shell"
import { LateCancellations } from "@/components/admin/late-cancellations"
import { PrototypeNotice } from "@/components/prototype-notice"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDayLong } from "@/lib/dates"
import { LATE_CANCELLATIONS, prototypeSessions, prototypeToday } from "@/lib/prototype/data"
import { gymTimeNow, isClosed } from "@/lib/prototype/now"
import { CLASS_COLOR_BG } from "@/lib/sessions"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Hoy" }

export default async function AdminTodayPage() {
  await connection() // "hoy" se calcula en cada petición, no al compilar
  const today = prototypeToday()
  const now = gymTimeNow()
  const sessions = prototypeSessions(today, today).filter((s) => s.status === "scheduled")
  const bookings = sessions.reduce((sum, s) => sum + s.booked, 0)
  const waitlist = sessions.reduce((sum, s) => sum + s.waitlist, 0)

  return (
    <Page title="Hoy" wide>
      <PrototypeNotice />
      <p className="-mt-2 text-muted-foreground first-letter:uppercase">{formatDayLong(today)}</p>

      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Sesiones" value={sessions.length} />
        <Stat label="Reservas" value={bookings} />
        <Stat label="En lista de espera" value={waitlist} />
        <Stat label="Altas pendientes" value={2} highlight />
      </dl>

      <section aria-labelledby="late-title" className="flex flex-col gap-3">
        <h2 id="late-title" className="text-lg font-semibold">
          Anulaciones tardías pendientes
        </h2>
        <LateCancellations initial={LATE_CANCELLATIONS} />
      </section>

      <section aria-labelledby="sessions-title" className="flex flex-col gap-3">
        <h2 id="sessions-title" className="text-lg font-semibold">
          Sesiones de hoy
        </h2>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground">Hoy no hay sesiones.</p>
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Hora</TableHead>
                  <TableHead>Clase</TableHead>
                  <TableHead className="hidden sm:table-cell">Entrenador</TableHead>
                  <TableHead className="pr-4 text-right">Ocupación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => {
                  const closed = isClosed(s.date, s.start, today, now)
                  return (
                    <TableRow key={s.id} className={cn("h-14", closed && "text-muted-foreground")}>
                      <TableCell className="pl-4 font-semibold tabular-nums">{s.start}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", CLASS_COLOR_BG[s.classType.color])} />
                          <span className="flex flex-col">
                            {s.classType.name}
                            <span className="text-xs text-muted-foreground sm:hidden">{s.coach}</span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{s.coach}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <span className="flex items-center justify-end gap-2">
                          {s.waitlist > 0 && <Badge variant="warning">+{s.waitlist}</Badge>}
                          <span className="tabular-nums">
                            {s.booked}/{s.capacity}
                          </span>
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </Page>
  )
}

function Stat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("text-2xl font-semibold tabular-nums", highlight && "text-primary")}>{value}</dd>
    </div>
  )
}
