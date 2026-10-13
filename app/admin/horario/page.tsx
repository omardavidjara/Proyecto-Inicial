import type { Metadata } from "next"
import Link from "next/link"
import { CalendarClock, CalendarX } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { ScheduleSlotActions, ScheduleSlotDialog } from "@/components/admin/schedule-slot-form"
import { CancelSessionDialog, SessionDialog } from "@/components/admin/session-form"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ScheduleSlotRow, SessionRow } from "@/lib/data/schedule"
import { formatDayLabel, formatDayLong, toDateKey, toTimeKey } from "@/lib/dates"
import { getScheduleForAdmin, getUpcomingSessionsForAdmin } from "@/lib/dal"
import { CLASS_COLOR_BG } from "@/lib/sessions"
import { cn } from "@/lib/utils"
import { WEEKDAYS } from "@/lib/validation/schedule"

export const metadata: Metadata = { title: "Horario" }

const TABS = [
  { param: "plantilla", label: "Horario semanal" },
  { param: "sesiones", label: "Próximas sesiones" },
] as const

// SPEC F3: plantilla semanal (cada franja crea sus sesiones de las próximas 4 semanas, y el cron, cada día) y
// próximas sesiones (sueltas, mover, cambiar entrenador o aforo, cancelar)
export default async function HorarioPage({ searchParams }: PageProps<"/admin/horario">) {
  const { vista } = await searchParams
  const tab = TABS.find((t) => t.param === vista) ?? TABS[0]
  const tabs = (
    <nav aria-label="Vista del horario" className="flex gap-1 rounded-xl bg-muted p-1">
      {TABS.map((t) => (
        <Link
          key={t.param}
          href={`/admin/horario?vista=${t.param}`}
          aria-current={t.param === tab.param ? "page" : undefined}
          className={cn(
            "flex min-h-11 flex-1 items-center justify-center rounded-lg text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
            t.param === tab.param ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
  // Los datos se cargan aquí: la DAL comprueba el rol antes de devolver nada
  return tab.param === "sesiones" ? (
    <SessionsView tabs={tabs} {...await getUpcomingSessionsForAdmin()} />
  ) : (
    <TemplateView tabs={tabs} {...await getScheduleForAdmin()} />
  )
}

function TemplateView({ tabs, slots, classTypes, coaches }: { tabs: React.ReactNode } & Awaited<ReturnType<typeof getScheduleForAdmin>>) {
  const options = { classTypes, coaches }
  const canCreate = classTypes.some((t) => t.isActive)
  const days = WEEKDAYS.map((name, weekday) => ({ name, slots: slots.filter((s) => s.weekday === weekday) })).filter(
    (day) => day.slots.length > 0,
  )

  return (
    <Page title="Horario" backHref="/admin/mas" wide actions={canCreate ? <ScheduleSlotDialog {...options} /> : null}>
      {tabs}
      {!canCreate && slots.length === 0 ? (
        <NeedsClassTypes />
      ) : days.length === 0 ? (
        <EmptyState
          icon={<CalendarClock />}
          title="El horario está vacío"
          description="Añade las clases que se repiten cada semana. Las sesiones se crean solas con 4 semanas de antelación."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <section key={day.name} aria-labelledby={`dia-${day.name}`} className="flex flex-col gap-2">
              <h2 id={`dia-${day.name}`} className="text-sm font-semibold text-muted-foreground">
                {day.name}
              </h2>
              <ul className="grid gap-2 lg:grid-cols-2">
                {day.slots.map((slot) => (
                  <li
                    key={slot.id}
                    className="relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 pl-5 sm:flex-row sm:items-center"
                  >
                    <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1.5", CLASS_COLOR_BG[slot.color])} />
                    <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", !slot.isActive && "opacity-60")}>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium tabular-nums">{timeRange(slot)}</span>
                        <span className="truncate font-medium">{slot.className}</span>
                        {slot.isActive ? null : <Badge variant="outline">Inactiva</Badge>}
                        {slot.classTypeActive ? null : <Badge variant="outline">Tipo inactivo</Badge>}
                      </span>
                      <span className="text-sm text-muted-foreground">{summary(slot)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ScheduleSlotDialog slot={slot} {...options} />
                      <ScheduleSlotActions slot={slot} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Page>
  )
}

/** "09:00 – 10:00" */
function timeRange(slot: ScheduleSlotRow) {
  const [h, m] = slot.startTime.split(":").map(Number)
  const end = (h * 60 + m + slot.durationMinutes) % (24 * 60)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${slot.startTime} – ${pad(Math.floor(end / 60))}:${pad(end % 60)}`
}

function summary(slot: ScheduleSlotRow) {
  const places = slot.kind === "individual" ? "Individual" : `${slot.capacity} plazas`
  return `${places} · ${slot.coachName ?? "Sin entrenador"}`
}

function NeedsClassTypes() {
  return (
    <EmptyState
      icon={<CalendarClock />}
      title="Primero, los tipos de clase"
      description="Para montar el horario necesitas al menos un tipo de clase activo."
      action={
        <Button asChild variant="outline">
          <Link href="/admin/tipos-clase">Ir a tipos de clase</Link>
        </Button>
      }
    />
  )
}

function SessionsView({
  tabs,
  sessions,
  classTypes,
  coaches,
}: { tabs: React.ReactNode } & Awaited<ReturnType<typeof getUpcomingSessionsForAdmin>>) {
  const today = toDateKey(new Date())
  const options = { classTypes, coaches, today }
  const canCreate = classTypes.some((t) => t.isActive)
  const days = new Map<string, SessionRow[]>()
  for (const session of sessions) {
    const key = toDateKey(session.startsAt)
    days.set(key, [...(days.get(key) ?? []), session])
  }

  return (
    <Page title="Horario" backHref="/admin/mas" wide actions={canCreate ? <SessionDialog {...options} /> : null}>
      {tabs}
      {!canCreate && sessions.length === 0 ? (
        <NeedsClassTypes />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<CalendarX />}
          title="No hay sesiones próximas"
          description="Se crean solas a partir del horario semanal. También puedes crear una sesión suelta."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {[...days].map(([key, daySessions]) => (
            <section key={key} aria-labelledby={`dia-${key}`} className="flex flex-col gap-2">
              <h2 id={`dia-${key}`} className="text-sm font-semibold text-muted-foreground first-letter:uppercase">
                {dayHeading(key, today)}
              </h2>
              <ul className="grid gap-2 lg:grid-cols-2">
                {daySessions.map((session) => {
                  const cancelled = session.status === "cancelled"
                  return (
                    <li
                      key={session.id}
                      className="relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 pl-5 sm:flex-row sm:items-center"
                    >
                      <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1.5", CLASS_COLOR_BG[session.color])} />
                      <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", cancelled && "opacity-60")}>
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium tabular-nums">{`${toTimeKey(session.startsAt)} – ${toTimeKey(session.endsAt)}`}</span>
                          <span className={cn("truncate font-medium", cancelled && "line-through")}>{session.className}</span>
                          {cancelled ? <Badge variant="destructive">Cancelada</Badge> : null}
                          {session.isOneOff ? <Badge variant="outline">Suelta</Badge> : null}
                          {session.isCustomized && !cancelled ? <Badge variant="outline">Cambiada</Badge> : null}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {cancelled ? (session.cancelReason ?? "Sin motivo") : sessionSummary(session)}
                        </span>
                      </div>
                      {cancelled ? null : (
                        <div className="flex items-center gap-1">
                          <SessionDialog session={session} {...options} />
                          <CancelSessionDialog session={session} today={today} />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Page>
  )
}

/** "Hoy · martes, 13 de octubre" o "martes, 20 de octubre" */
function dayHeading(key: string, today: string) {
  const label = formatDayLabel(key, today)
  return label === "Hoy" || label === "Mañana" ? `${label} · ${formatDayLong(key)}` : formatDayLong(key)
}

/** "5/12 reservas · 2 en espera · Laura Coach" */
function sessionSummary(session: SessionRow) {
  const places =
    session.kind === "individual" ? (session.booked > 0 ? "Reservada" : "Libre") : `${session.booked}/${session.capacity} reservas`
  const waitlist = session.waitlisted > 0 ? ` · ${session.waitlisted} en espera` : ""
  return `${places}${waitlist} · ${session.coachName ?? "Sin entrenador"}`
}
