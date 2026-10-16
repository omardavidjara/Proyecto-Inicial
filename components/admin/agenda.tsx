import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AGENDA_VIEWS, agendaHref, daysBetween, type AgendaRange, type AgendaView } from "@/lib/agenda"
import type { AgendaSession } from "@/lib/data/agenda"
import { formatDayLong, formatDayNumber, formatWeekdayShort, toDateKey, toTimeKey } from "@/lib/dates"
import { CLASS_COLOR_BG, type ClassColor } from "@/lib/sessions"
import { cn } from "@/lib/utils"

// Agenda del administrador (SPEC F6): componentes de servidor, las fechas no llegan al navegador.
// Cada sesión enlaza a su detalle (/admin/sesiones/[id]).

const linkFocus = "outline-none focus-visible:ring-2 focus-visible:ring-ring"

export const sessionHref = (id: string) => `/admin/sesiones/${id}`

/**
 * Pestañas Día / Semana / Mes, ‹ Hoy › y el título del periodo. El calendario del cliente la reutiliza con sus
 * enlaces (`hrefFor`) y sin ‹ cuando el periodo anterior ya ha pasado (`canGoBack`)
 */
export function AgendaToolbar({
  view,
  date,
  today,
  range,
  hrefFor = agendaHref,
  canGoBack = true,
}: {
  view: AgendaView
  date: string
  today: string
  range: AgendaRange
  hrefFor?: (view: AgendaView, date: string) => string
  canGoBack?: boolean
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav aria-label="Vista de la agenda" className="flex gap-1 rounded-xl bg-muted p-1 sm:w-72">
        {AGENDA_VIEWS.map((v) => (
          <Link
            key={v.param}
            href={hrefFor(v.param, date)}
            aria-current={v.param === view ? "page" : undefined}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-lg text-sm font-medium",
              linkFocus,
              v.param === view ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-1">
        {canGoBack ? (
          <NavLink href={hrefFor(view, range.prev)} label="Anterior">
            <ChevronLeft aria-hidden="true" className="size-5" />
          </NavLink>
        ) : (
          <span aria-hidden="true" className="flex size-11 items-center justify-center text-muted-foreground/40">
            <ChevronLeft className="size-5" />
          </span>
        )}
        <Link
          href={hrefFor(view, today)}
          className={cn("flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-muted", linkFocus)}
        >
          Hoy
        </Link>
        <NavLink href={hrefFor(view, range.next)} label="Siguiente">
          <ChevronRight aria-hidden="true" className="size-5" />
        </NavLink>
        <h2 className="ml-2 text-lg font-semibold first-letter:uppercase">{range.title}</h2>
      </div>
    </div>
  )
}

function NavLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} aria-label={label} className={cn("flex size-11 items-center justify-center rounded-lg hover:bg-muted", linkFocus)}>
      {children}
    </Link>
  )
}

function Dot({ color }: { color: ClassColor }) {
  return <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", CLASS_COLOR_BG[color])} />
}

/** "8/12" y, si hay lista de espera, "+3" */
function Occupancy({ session }: { session: AgendaSession }) {
  if (session.status === "cancelled") return <Badge variant="destructive">Cancelada</Badge>
  return (
    <span className="flex items-center justify-end gap-2">
      {session.waitlisted > 0 && (
        <Badge variant="warning" aria-label={`${session.waitlisted} en lista de espera`}>
          +{session.waitlisted}
        </Badge>
      )}
      <span className="tabular-nums" aria-label={`${session.booked} de ${session.capacity} plazas`}>
        {session.booked}/{session.capacity}
      </span>
    </span>
  )
}

/** Tabla de las sesiones de un día (también en «Hoy») */
export function SessionsTable({ sessions, now }: { sessions: AgendaSession[]; now: Date }) {
  return (
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
            const cancelled = s.status === "cancelled"
            return (
              <TableRow
                key={s.id}
                className={cn("relative h-14 focus-within:bg-muted/50", (cancelled || s.startsAt <= now) && "text-muted-foreground")}
              >
                <TableCell className={cn("pl-4 font-semibold tabular-nums", cancelled && "line-through")}>{toTimeKey(s.startsAt)}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <Dot color={s.color} />
                    <span className="flex flex-col">
                      {/* El enlace cubre toda la fila (after:absolute) */}
                      <Link href={sessionHref(s.id)} className={cn("outline-none after:absolute after:inset-0", cancelled && "line-through")}>
                        {s.className}
                      </Link>
                      <span className="text-xs text-muted-foreground sm:hidden">{s.coachName ?? "Sin entrenador"}</span>
                    </span>
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{s.coachName ?? "Sin entrenador"}</TableCell>
                <TableCell className="pr-4 text-right">
                  <Occupancy session={s} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function AgendaDay({ sessions, now }: { sessions: AgendaSession[]; now: Date }) {
  if (sessions.length === 0) return <p className="text-muted-foreground">Este día no hay sesiones.</p>
  return <SessionsTable sessions={sessions} now={now} />
}

const byDay = <T extends Pick<AgendaSession, "startsAt">>(sessions: T[]) => Map.groupBy(sessions, (s) => toDateKey(s.startsAt))

/** Lunes a domingo: en móvil, un bloque por día; desde 1024 px, siete columnas */
export function AgendaWeek({ range, sessions, today, now }: { range: AgendaRange; sessions: AgendaSession[]; today: string; now: Date }) {
  const groups = byDay(sessions)
  return (
    <div className="grid gap-4 lg:grid-cols-7 lg:gap-2">
      {daysBetween(range.from, range.to).map((day) => {
        const daySessions = groups.get(day) ?? []
        return (
          <section key={day} aria-label={formatDayLong(day)} className="flex flex-col gap-2">
            <Link
              href={agendaHref("dia", day)}
              aria-current={day === today ? "date" : undefined}
              className={cn(
                "flex items-baseline gap-2 rounded-lg px-2 py-1 text-sm hover:bg-muted lg:flex-col lg:items-center lg:gap-0",
                linkFocus,
                day === today && "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              <span className="capitalize">{formatWeekdayShort(day)}</span>
              <span className="text-lg font-semibold tabular-nums">{formatDayNumber(day)}</span>
            </Link>
            {daySessions.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground lg:text-center">Sin sesiones</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {daySessions.map((s) => {
                  const cancelled = s.status === "cancelled"
                  return (
                    <li key={s.id}>
                      <Link
                        href={sessionHref(s.id)}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-lg border bg-card px-2.5 py-2 text-sm hover:bg-muted/50 lg:flex-col lg:items-start lg:gap-1",
                          linkFocus,
                          (cancelled || s.startsAt <= now) && "text-muted-foreground",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Dot color={s.color} />
                          <span className={cn("font-semibold tabular-nums", cancelled && "line-through")}>{toTimeKey(s.startsAt)}</span>
                          <span className={cn("truncate", cancelled && "line-through")}>{s.className}</span>
                        </span>
                        <Occupancy session={s} />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

/**
 * Cuadrícula del mes: por día, cuántas sesiones hay (sin las canceladas) y un punto por tipo de clase. Cada día
 * lleva a la vista Día de la agenda, o a `dayHref` (el entrenador reutiliza la cuadrícula con sus días)
 */
export function AgendaMonth({
  range,
  date,
  sessions,
  today,
  dayHref = (day) => agendaHref("dia", day),
  minDay,
}: {
  range: AgendaRange
  date: string
  sessions: Pick<AgendaSession, "color" | "startsAt" | "status">[]
  today: string
  dayHref?: (day: string) => string
  /** Los días anteriores salen atenuados y sin enlace (el cliente no consulta días pasados) */
  minDay?: string
}) {
  const groups = byDay(sessions.filter((s) => s.status === "scheduled"))
  const days = daysBetween(range.from, range.to)
  const month = date.slice(0, 7)
  return (
    <div className="flex flex-col gap-1">
      <div aria-hidden="true" className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground capitalize">
        {days.slice(0, 7).map((day) => (
          <span key={day}>{formatWeekdayShort(day)}</span>
        ))}
      </div>
      <ul className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const daySessions = groups.get(day) ?? []
          const colors = [...new Set(daySessions.map((s) => s.color))]
          const count = daySessions.length
          const cell = "flex min-h-16 flex-col gap-1 rounded-lg border p-1.5 text-sm lg:min-h-24"
          if (minDay && day < minDay) {
            return (
              <li key={day}>
                <span className={cn(cell, "border-transparent text-muted-foreground")}>
                  <span className="flex size-7 items-center justify-center tabular-nums">{formatDayNumber(day)}</span>
                </span>
              </li>
            )
          }
          return (
            <li key={day}>
              <Link
                href={dayHref(day)}
                aria-current={day === today ? "date" : undefined}
                aria-label={`${formatDayLong(day)}: ${count === 1 ? "1 sesión" : `${count} sesiones`}`}
                className={cn(
                  cell,
                  "bg-card hover:bg-muted/50",
                  linkFocus,
                  !day.startsWith(month) && "bg-transparent text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full font-semibold tabular-nums",
                    day === today && "bg-primary text-primary-foreground",
                  )}
                >
                  {formatDayNumber(day)}
                </span>
                {count > 0 && (
                  <span className="flex flex-wrap items-center gap-1">
                    {colors.map((color) => (
                      <Dot key={color} color={color} />
                    ))}
                    <span className="hidden text-xs text-muted-foreground sm:inline">{count === 1 ? "1 sesión" : `${count} sesiones`}</span>
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
