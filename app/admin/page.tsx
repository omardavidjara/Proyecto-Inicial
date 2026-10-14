import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { Page } from "@/components/app-shell/app-shell"
import { LateCancellations } from "@/components/admin/late-cancellations"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { lateCancellationItem } from "@/lib/agenda"
import { countPendingClientsForAdmin, getAdminToday } from "@/lib/dal"
import { formatDayLong, toTimeKey } from "@/lib/dates"
import { CLASS_COLOR_BG } from "@/lib/sessions"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Hoy" }

/** Anulaciones tardías que se ven en «Hoy»; el resto, en /admin/anulaciones */
const LATE_PREVIEW = 5

export default async function AdminTodayPage() {
  await connection() // "hoy" se calcula en cada petición, no al compilar
  const [{ today, sessions: daySessions, late, lateCount }, pendingClients] = await Promise.all([
    getAdminToday(LATE_PREVIEW),
    countPendingClientsForAdmin(),
  ])
  const now = new Date()
  const sessions = daySessions.filter((s) => s.status === "scheduled")
  const bookings = sessions.reduce((sum, s) => sum + s.booked, 0)
  const waitlist = sessions.reduce((sum, s) => sum + s.waitlisted, 0)

  return (
    <Page title="Hoy" wide>
      <p className="-mt-2 text-muted-foreground first-letter:uppercase">{formatDayLong(today)}</p>

      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Sesiones" value={sessions.length} />
        <Stat label="Reservas" value={bookings} />
        <Stat label="En lista de espera" value={waitlist} />
        <Stat label="Altas pendientes" value={pendingClients} highlight={pendingClients > 0} href="/admin/clientes?estado=pendiente" />
      </dl>

      <section aria-labelledby="late-title" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="late-title" className="text-lg font-semibold">
            Anulaciones tardías pendientes
          </h2>
          {lateCount > late.length && (
            <Link href="/admin/anulaciones" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Ver las {lateCount}
            </Link>
          )}
        </div>
        <LateCancellations items={late.map((row) => lateCancellationItem(row, today))} />
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
                  const closed = s.startsAt <= now
                  return (
                    <TableRow key={s.id} className={cn("h-14", closed && "text-muted-foreground")}>
                      <TableCell className="pl-4 font-semibold tabular-nums">{toTimeKey(s.startsAt)}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", CLASS_COLOR_BG[s.color])} />
                          <span className="flex flex-col">
                            {s.className}
                            <span className="text-xs text-muted-foreground sm:hidden">{s.coachName ?? "Sin entrenador"}</span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{s.coachName ?? "Sin entrenador"}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <span className="flex items-center justify-end gap-2">
                          {s.waitlisted > 0 && <Badge variant="warning">+{s.waitlisted}</Badge>}
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

function Stat({ label, value, highlight = false, href }: { label: string; value: number; highlight?: boolean; href?: string }) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-1 rounded-xl border bg-card p-4",
        href && "transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-muted/50",
      )}
    >
      <dt className="text-sm text-muted-foreground">
        {href ? (
          // El enlace cubre toda la tarjeta (after:absolute) sin meter dt/dd dentro de un <a>
          <Link href={href} className="outline-none after:absolute after:inset-0 after:rounded-xl">
            {label}
          </Link>
        ) : (
          label
        )}
      </dt>
      <dd className={cn("text-2xl font-semibold tabular-nums", highlight && "text-primary")}>{value}</dd>
    </div>
  )
}
