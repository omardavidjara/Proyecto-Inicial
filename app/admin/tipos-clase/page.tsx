import type { Metadata } from "next"
import { Dumbbell } from "lucide-react"
import { Page } from "@/components/app-shell/app-shell"
import { ClassTypeActions, ClassTypeDialog } from "@/components/admin/class-type-form"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import type { ClassTypeRow } from "@/lib/data/class-types"
import { listClassTypesForAdmin } from "@/lib/dal"
import { CLASS_COLOR_BG, CLASS_COLOR_LABEL } from "@/lib/sessions"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Tipos de clase" }

// SPEC F2: nombre, modalidad, duración, aforo por defecto, color y activo/inactivo
export default async function TiposClasePage() {
  const types = await listClassTypesForAdmin()

  return (
    <Page title="Tipos de clase" backHref="/admin/mas" wide actions={<ClassTypeDialog />}>
      {types.length === 0 ? (
        <EmptyState
          icon={<Dumbbell />}
          title="Aún no hay tipos de clase"
          description="Crea los tipos de clase del gimnasio para poder usarlos en el horario."
        />
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {types.map((type) => (
            <li
              key={type.id}
              className="relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 pl-5 sm:flex-row sm:items-center"
            >
              <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1.5", CLASS_COLOR_BG[type.color])} />
              <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", !type.isActive && "opacity-60")}>
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{type.name}</span>
                  {type.isActive ? null : <Badge variant="outline">Inactivo</Badge>}
                </span>
                <span className="text-sm text-muted-foreground">{summary(type)}</span>
              </div>
              <div className="flex items-center gap-1">
                <ClassTypeDialog classType={type} />
                <ClassTypeActions classType={type} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

function summary(type: ClassTypeRow) {
  const kind = type.kind === "individual" ? "Individual" : `Grupal · ${type.defaultCapacity} plazas`
  return `${kind} · ${type.durationMinutes} min · ${CLASS_COLOR_LABEL[type.color]}`
}
