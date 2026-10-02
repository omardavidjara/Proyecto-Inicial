import type { ReactNode } from "react"

/** Estado vacío: icono suave + frase + acción opcional (docs/DESIGN.md §6) */
export function EmptyState({ icon, title, description, action }: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
      <div className="text-muted-foreground [&_svg]:size-8" aria-hidden="true">{icon}</div>
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
