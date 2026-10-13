import type { Metadata } from "next"
import Link from "next/link"
import { Phone, UserCheck, UserRoundX, Users } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { ClientActions } from "@/components/admin/client-actions"
import { EmptyState } from "@/components/empty-state"
import type { ClientRow } from "@/lib/data/clients"
import { formatDayLong, toDateKey } from "@/lib/dates"
import { listActivePlansForAdmin, listClientsForAdmin, listMembershipsForAdmin } from "@/lib/dal"
import type { ProfileStatus } from "@/lib/roles"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Clientes" }

// SPEC F1: altas pendientes, activos y bajas. La búsqueda, los filtros y la ficha llegan con F8
const TABS = [
  { param: "pendiente", status: "pending", label: "Pendientes" },
  { param: "activo", status: "active", label: "Activos" },
  { param: "baja", status: "inactive", label: "Baja" },
] as const satisfies readonly { param: string; status: ProfileStatus; label: string }[]

const EMPTY: Record<ProfileStatus, { icon: React.ReactNode; title: string }> = {
  pending: { icon: <UserCheck />, title: "No hay altas pendientes" },
  active: { icon: <Users />, title: "Aún no hay clientes activos" },
  inactive: { icon: <UserRoundX />, title: "No hay clientes de baja" },
}

export default async function ClientesPage({ searchParams }: PageProps<"/admin/clientes">) {
  const { estado } = await searchParams
  const tab = TABS.find((t) => t.param === estado) ?? TABS[0]
  const today = toDateKey(new Date())
  const [clients, plans] = await Promise.all([listClientsForAdmin(tab.status), listActivePlansForAdmin()])
  // El historial de tarifas solo se enseña (y se cambia) en los activos
  const histories = tab.status === "active" ? await listMembershipsForAdmin(clients.map((c) => c.userId)) : new Map()

  return (
    <Page title="Clientes" wide>
      <nav aria-label="Estado de los clientes" className="flex gap-1 rounded-xl bg-muted p-1">
        {TABS.map((t) => (
          <Link
            key={t.param}
            href={`/admin/clientes?estado=${t.param}`}
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

      {clients.length === 0 ? (
        <EmptyState icon={EMPTY[tab.status].icon} title={EMPTY[tab.status].title} />
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {clients.map((client) => (
            <li key={client.userId} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{client.fullName}</span>
                {client.phone ? (
                  <a href={`tel:${client.phone}`} className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-muted-foreground tabular-nums hover:text-foreground sm:min-h-0">
                    <Phone className="size-3.5" aria-hidden="true" />
                    {client.phone}
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">Sin teléfono</span>
                )}
                {client.status === "active" ? (
                  <span className={cn("text-sm", client.planName ? "text-foreground" : "text-muted-foreground")}>
                    {client.planName ? `Tarifa: ${client.planName}` : "Sin tarifa"}
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground first-letter:uppercase">{dateLine(client)}</span>
              </div>
              <ClientActions
                userId={client.userId}
                name={client.fullName}
                status={client.status}
                plans={plans}
                history={histories.get(client.userId)}
                today={today}
              />
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

function dateLine(client: ClientRow) {
  const day = (date: Date) => formatDayLong(toDateKey(date))
  if (client.status === "pending") return `Solicitada el ${day(client.createdAt)}`
  if (client.status === "inactive" && client.deactivatedAt) return `De baja desde el ${day(client.deactivatedAt)}`
  return `Cliente desde el ${day(client.approvedAt ?? client.createdAt)}`
}
