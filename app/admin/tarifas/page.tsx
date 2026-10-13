import type { Metadata } from "next"
import { Tags } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { PlanActions, PlanDialog } from "@/components/admin/plan-form"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import type { PlanRow } from "@/lib/data/plans"
import { listPlansForAdmin } from "@/lib/dal"
import { cn } from "@/lib/utils"
import { planLimitLabel } from "@/lib/validation/plans"

export const metadata: Metadata = { title: "Tarifas" }

// SPEC F4: nombre y límite (N clases por semana, N por mes o ilimitada). El cobro va fuera de la app
export default async function TarifasPage() {
  const plans = await listPlansForAdmin()

  return (
    <Page title="Tarifas" backHref="/admin/mas" wide actions={<PlanDialog />}>
      {plans.length === 0 ? (
        <EmptyState
          icon={<Tags />}
          title="Aún no hay tarifas"
          description="Crea las tarifas del gimnasio para asignarlas a los clientes y limitar sus reservas."
        />
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {plans.map((plan) => (
            <li key={plan.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
              <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", !plan.isActive && "opacity-60")}>
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{plan.name}</span>
                  {plan.isActive ? null : <Badge variant="outline">Inactiva</Badge>}
                </span>
                <span className="text-sm text-muted-foreground">{summary(plan)}</span>
              </div>
              <div className="flex items-center gap-1">
                <PlanDialog plan={plan} />
                <PlanActions plan={plan} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

function summary(plan: PlanRow) {
  const clients = plan.clients === 1 ? "1 cliente" : `${plan.clients} clientes`
  return `${planLimitLabel(plan)} · ${clients}`
}
