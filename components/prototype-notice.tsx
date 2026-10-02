import { FlaskConical } from "lucide-react"

/** Franja que recuerda que la pantalla usa datos de ejemplo (se elimina en la Fase 5) */
export function PrototypeNotice() {
  return (
    <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
      <FlaskConical className="size-4 shrink-0" aria-hidden="true" />
      Prototipo con datos de ejemplo
    </p>
  )
}
