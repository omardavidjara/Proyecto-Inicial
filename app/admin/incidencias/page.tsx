import type { Metadata } from "next"
import Link from "next/link"
import { CircleCheck, Hourglass, TriangleAlert } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { IncidentDialog } from "@/components/admin/incident-form"
import { EmptyState } from "@/components/empty-state"
import { IncidentList } from "@/components/incidents/incident-list"
import { buttonVariants } from "@/components/ui/button"
import { countIncidentsForAdmin, listIncidentsForAdmin } from "@/lib/dal"
import { cn } from "@/lib/utils"
import { INCIDENT_MAX_LIMIT, INCIDENT_PAGE_SIZE, type IncidentStatus } from "@/lib/validation/incidents"

export const metadata: Metadata = { title: "Incidencias" }

// SPEC F9: abiertas, en curso y cerradas (`?estado=`), la más reciente primero, con «Ver más» (`?limite=`)
const TABS = [
  { param: "abierta", status: "open", label: "Abiertas" },
  { param: "en-curso", status: "in_progress", label: "En curso" },
  { param: "cerrada", status: "closed", label: "Cerradas" },
] as const satisfies readonly { param: string; status: IncidentStatus; label: string }[]

const EMPTY: Record<IncidentStatus, { icon: React.ReactNode; title: string }> = {
  open: { icon: <TriangleAlert />, title: "No hay incidencias abiertas" },
  in_progress: { icon: <Hourglass />, title: "No hay incidencias en curso" },
  closed: { icon: <CircleCheck />, title: "Aún no hay incidencias cerradas" },
}

export default async function IncidenciasPage({ searchParams }: PageProps<"/admin/incidencias">) {
  const { estado, limite } = await searchParams
  const tab = TABS.find((t) => t.param === estado) ?? TABS[0]
  const [items, counts] = await Promise.all([listIncidentsForAdmin(tab.status, limite), countIncidentsForAdmin()])
  const href = (params: { estado: string; limite?: number }) => {
    const search = new URLSearchParams({ estado: params.estado })
    if (params.limite) search.set("limite", String(params.limite))
    return `/admin/incidencias?${search}`
  }
  const hasMore = items.length < counts[tab.status] && items.length < INCIDENT_MAX_LIMIT

  return (
    <Page title="Incidencias" wide actions={<IncidentDialog />}>
      <nav aria-label="Estado de las incidencias" className="flex gap-1 rounded-xl bg-muted p-1">
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

      {items.length === 0 ? (
        <EmptyState icon={EMPTY[tab.status].icon} title={EMPTY[tab.status].title} />
      ) : (
        <IncidentList items={items} hrefBase="/admin/incidencias" />
      )}

      {hasMore ? (
        <Link
          href={href({ estado: tab.param, limite: items.length + INCIDENT_PAGE_SIZE })}
          scroll={false}
          className={cn(buttonVariants({ variant: "outline" }), "h-11 self-center")}
        >
          Ver más ({items.length} de {counts[tab.status]})
        </Link>
      ) : null}
    </Page>
  )
}
