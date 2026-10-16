import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, Phone, Search, UserCheck, UserRoundX, Users } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { ClientActions } from "@/components/admin/client-actions"
import { EmptyState } from "@/components/empty-state"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CLIENT_MAX_LIMIT, CLIENT_PAGE_SIZE, type ClientRow } from "@/lib/data/clients"
import { formatDayLong, toDateKey } from "@/lib/dates"
import { countClientsForAdmin, listActivePlansForAdmin, listClientsForAdmin, listMembershipsForAdmin } from "@/lib/dal"
import type { ProfileStatus } from "@/lib/roles"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Clientes" }

// SPEC F1 y F8: altas pendientes, activos y bajas, con búsqueda por nombre (`?q=`) y «Ver más» (`?limite=`).
// Formulario GET sin JavaScript: buscar conserva la pestaña y cambiar de pestaña conserva la búsqueda
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
  const { estado, q, limite } = await searchParams
  const tab = TABS.find((t) => t.param === estado) ?? TABS[0]
  const query = typeof q === "string" ? q.trim().slice(0, 60) : ""
  const today = toDateKey(new Date())
  const [clients, counts, plans] = await Promise.all([
    listClientsForAdmin(tab.status, query, limite),
    countClientsForAdmin(query),
    listActivePlansForAdmin(),
  ])
  // El historial de tarifas solo se enseña (y se cambia) en los activos
  const histories = tab.status === "active" ? await listMembershipsForAdmin(clients.map((c) => c.userId)) : new Map()
  const href = (params: { estado: string; limite?: number }) => {
    const search = new URLSearchParams({ estado: params.estado })
    if (query) search.set("q", query)
    if (params.limite) search.set("limite", String(params.limite))
    return `/admin/clientes?${search}`
  }
  const hasMore = clients.length < counts[tab.status] && clients.length < CLIENT_MAX_LIMIT

  return (
    <Page title="Clientes" wide>
      <form action="/admin/clientes" role="search" className="flex gap-2">
        <input type="hidden" name="estado" value={tab.param} />
        <label htmlFor="client-search" className="sr-only">
          Buscar por nombre
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="client-search" type="search" name="q" defaultValue={query} maxLength={60} placeholder="Buscar por nombre" className="h-11 pl-9" />
        </div>
        <Button type="submit" variant="outline" className="h-11">
          Buscar
        </Button>
      </form>

      <nav aria-label="Estado de los clientes" className="flex gap-1 rounded-xl bg-muted p-1">
        {TABS.map((t) => (
          <Link
            key={t.param}
            href={href({ estado: t.param })}
            aria-current={t.param === tab.param ? "page" : undefined}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
              t.param === tab.param ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}{" "}
            <span className="text-xs text-muted-foreground tabular-nums">{counts[t.status]}</span>
          </Link>
        ))}
      </nav>

      {clients.length === 0 ? (
        query ? (
          <EmptyState icon={<Search />} title={`Ningún cliente coincide con «${query}»`} />
        ) : (
          <EmptyState icon={EMPTY[tab.status].icon} title={EMPTY[tab.status].title} />
        )
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {clients.map((client) => (
            <li key={client.userId} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Link
                  href={`/admin/clientes/${client.userId}`}
                  className="inline-flex min-h-11 items-center gap-1 self-start truncate font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0"
                >
                  <span className="truncate">{client.fullName}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
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

      {hasMore ? (
        <Link
          href={href({ estado: tab.param, limite: clients.length + CLIENT_PAGE_SIZE })}
          scroll={false}
          className={cn(buttonVariants({ variant: "outline" }), "h-11 self-center")}
        >
          Ver más ({clients.length} de {counts[tab.status]})
        </Link>
      ) : null}
    </Page>
  )
}

function dateLine(client: ClientRow) {
  const day = (date: Date) => formatDayLong(toDateKey(date))
  if (client.status === "pending") return `Solicitada el ${day(client.createdAt)}`
  if (client.status === "inactive" && client.deactivatedAt) return `De baja desde el ${day(client.deactivatedAt)}`
  return `Cliente desde el ${day(client.approvedAt ?? client.createdAt)}`
}
