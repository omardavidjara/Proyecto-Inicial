import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { ChevronRight, History, Mail, Phone, ShieldAlert, Ticket } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { ClientActions } from "@/components/admin/client-actions"
import { EmptyState } from "@/components/empty-state"
import { BookingHistory } from "@/components/sessions/booking-history"
import { Badge } from "@/components/ui/badge"
import { toHistoryEntries } from "@/lib/booking-history"
import type { ClientActivity, ClientRow } from "@/lib/data/clients"
import type { PlanSummary } from "@/lib/data/memberships"
import { CLIENT_ACTIVITY_DAYS, getClientProfileForAdmin, listActivePlansForAdmin } from "@/lib/dal"
import { formatDateShort, formatDayLabel, formatDayLong, toDateKey, toTimeKey } from "@/lib/dates"
import type { ProfileStatus } from "@/lib/roles"
import { CLASS_COLOR_BG } from "@/lib/sessions"
import { cn } from "@/lib/utils"
import { planLimitLabel } from "@/lib/validation/plans"
import { loadClientHistoryAction } from "./actions"

export const metadata: Metadata = { title: "Cliente" }

const STATUS: Record<ProfileStatus, { label: string; tab: string; variant: "warning" | "success" | "secondary" }> = {
  pending: { label: "Alta pendiente", tab: "pendiente", variant: "warning" },
  active: { label: "Activo", tab: "activo", variant: "success" },
  inactive: { label: "De baja", tab: "baja", variant: "secondary" },
}

// SPEC F8: ficha del cliente para administración. Las acciones son las mismas que en la lista (aprobar,
// rechazar, dar de baja, reactivar y cambiar tarifa); cada reserva lleva al detalle de su sesión
export default async function AdminClientPage({ params }: PageProps<"/admin/clientes/[userId]">) {
  await connection()
  const { userId } = await params
  const [data, plans] = await Promise.all([getClientProfileForAdmin(userId), listActivePlansForAdmin()])
  if (!data) notFound()
  const { client, email, plan, planHistory, upcoming, history, activity, today, timeZone } = data
  const status = STATUS[client.status]

  return (
    <Page title={client.fullName} backHref={`/admin/clientes?estado=${status.tab}`} wide>
      <section aria-label="Datos del cliente" className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Badge variant={status.variant} className="self-start">
            {status.label}
          </Badge>
          {email ? (
            <a href={`mailto:${email}`} className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm break-all text-muted-foreground hover:text-foreground sm:min-h-0">
              <Mail className="size-3.5 shrink-0" aria-hidden="true" />
              {email}
            </a>
          ) : null}
          {client.phone ? (
            <a href={`tel:${client.phone}`} className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-muted-foreground tabular-nums hover:text-foreground sm:min-h-0">
              <Phone className="size-3.5 shrink-0" aria-hidden="true" />
              {client.phone}
            </a>
          ) : (
            <span className="text-sm text-muted-foreground">Sin teléfono</span>
          )}
          {dateLines(client).map((line) => (
            <span key={line} className="text-xs text-muted-foreground first-letter:uppercase">
              {line}
            </span>
          ))}
        </div>
        <ClientActions
          userId={client.userId}
          name={client.fullName}
          status={client.status}
          plans={plans}
          history={client.status === "active" ? planHistory : undefined}
          today={today}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="plan-title" className="flex flex-col gap-3">
          <h2 id="plan-title" className="text-lg font-semibold">
            Tarifa
          </h2>
          <PlanCard summary={plan} />
          {planHistory.length > 0 ? (
            <ul aria-label="Historial de tarifas" className="flex flex-col divide-y rounded-xl border bg-card text-sm">
              {planHistory.map((m) => (
                <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5">
                  <span className="font-medium">{m.planName}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatDateShort(m.startsOn)} – {m.endsOn ? formatDateShort(m.endsOn) : "sin fin"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section aria-labelledby="activity-title" className="flex flex-col gap-3">
          <h2 id="activity-title" className="text-lg font-semibold">
            Últimos {CLIENT_ACTIVITY_DAYS} días
          </h2>
          <ActivityTiles activity={activity} />
          <div className="flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
            Incidencias: llegan con F9.
          </div>
        </section>
      </div>

      <section aria-labelledby="upcoming-title" className="flex flex-col gap-3">
        <h2 id="upcoming-title" className="text-lg font-semibold">
          Próximas reservas
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState icon={<Ticket />} title="Sin reservas próximas" />
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {upcoming.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/admin/sesiones/${b.sessionId}`}
                  className="relative flex min-h-16 items-center gap-3 py-3 pr-3 pl-5 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span aria-hidden="true" className={cn("absolute inset-y-2 left-0 w-1 rounded-r", CLASS_COLOR_BG[b.color])} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-medium">{b.className}</span>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm text-muted-foreground first-letter:uppercase">
                        {formatDayLabel(toDateKey(b.startsAt, timeZone), today)} ·{" "}
                        <span className="tabular-nums">{toTimeKey(b.startsAt, timeZone)}</span>
                      </span>
                      {b.status === "waitlisted" ? (
                        <Badge variant="warning">Lista de espera · {b.waitlistPosition}º</Badge>
                      ) : (
                        <Badge variant="success">Confirmada</Badge>
                      )}
                      {b.sessionStatus === "cancelled" ? <Badge variant="outline">Sesión cancelada</Badge> : null}
                    </div>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-title" className="flex flex-col gap-3">
        <h2 id="history-title" className="text-lg font-semibold">
          Historial
        </h2>
        {history.items.length === 0 ? (
          <EmptyState icon={<History />} title="Aún no hay historial" />
        ) : (
          <BookingHistory
            initial={toHistoryEntries(history.items, timeZone, today)}
            initialCursor={history.nextCursor}
            load={loadClientHistoryAction.bind(null, client.userId)}
            sessionBase="/admin/sesiones"
          />
        )}
      </section>
    </Page>
  )
}

function dateLines(client: ClientRow) {
  const day = (date: Date) => formatDayLong(toDateKey(date))
  const lines = [`Solicitó el alta el ${day(client.createdAt)}`]
  if (client.approvedAt) lines.push(`Cliente desde el ${day(client.approvedAt)}`)
  if (client.status === "inactive" && client.deactivatedAt) lines.push(`De baja desde el ${day(client.deactivatedAt)}`)
  return lines
}

const PERIOD_LEFT = { week: "esta semana", month: "este mes" } as const

function PlanCard({ summary }: { summary: PlanSummary }) {
  const { current, next } = summary
  const nextLine = next ? `Desde el ${formatDateShort(next.startsOn)}: ${next.planName}` : null
  if (!current) {
    return (
      <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
        <span className="font-semibold">Sin tarifa</span>
        <span className="text-sm text-muted-foreground">{nextLine ?? "No puede reservar hasta que se le asigne una."}</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="font-semibold">{current.planName}</span>
      <span className="text-sm text-muted-foreground">{planLimitLabel(current)}</span>
      {current.remaining != null && current.period !== "unlimited" ? (
        <span className="text-sm">
          Le quedan <span className="font-semibold text-primary tabular-nums">{current.remaining}</span> de{" "}
          <span className="tabular-nums">{current.classesPerPeriod}</span> {PERIOD_LEFT[current.period]}
        </span>
      ) : null}
      {nextLine ? <span className="text-xs text-muted-foreground">{nextLine}</span> : null}
    </div>
  )
}

function ActivityTiles({ activity }: { activity: ClientActivity }) {
  const tiles = [
    { label: "Asistidas", value: activity.attended },
    { label: "Faltas sin avisar", value: activity.noShow },
    { label: "Anulaciones tardías", value: activity.lateCancelled },
    { label: "Anuladas a tiempo", value: activity.cancelled },
  ]
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-1 rounded-xl border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{tile.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{tile.value}</dd>
          </div>
        ))}
      </dl>
      {activity.unmarked > 0 ? (
        <p className="text-xs text-muted-foreground">
          {activity.unmarked === 1 ? "1 clase confirmada sin asistencia marcada." : `${activity.unmarked} clases confirmadas sin asistencia marcada.`}
        </p>
      ) : null}
    </div>
  )
}
