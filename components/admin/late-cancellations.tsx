"use client"

import { useOptimistic, useTransition } from "react"
import { CheckCheck } from "lucide-react"
import { toast } from "sonner"
import { decideLateCancellationAction } from "@/app/admin/anulaciones/actions"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"

/** DTO para el navegador: textos ya formateados en el servidor */
export type LateCancellationItem = { id: string; client: string; session: string; when: string }

/** Decidir anulaciones tardías (SPEC F6): la fila desaparece al momento y vuelve si la acción falla */
export function LateCancellations({ items }: { items: LateCancellationItem[] }) {
  const [shown, hide] = useOptimistic(items, (current, id: string) => current.filter((i) => i.id !== id))
  const [, startTransition] = useTransition()

  function decide(item: LateCancellationItem, charge: boolean) {
    startTransition(async () => {
      hide(item.id)
      const result = await decideLateCancellationAction(item.id, charge)
      if (result.ok) toast.success(`${result.message}: ${item.client}`)
      else toast.error(result.message)
    })
  }

  if (shown.length === 0) {
    return <EmptyState icon={<CheckCheck />} title="No hay anulaciones tardías pendientes" />
  }

  return (
    <ul className="flex flex-col gap-2">
      {shown.map((item) => (
        <li key={item.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="font-medium">{item.client}</span>
            <span className="text-sm text-muted-foreground">
              {item.session} · {item.when}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => decide(item, false)}>
              No descontar
            </Button>
            <Button variant="destructive" onClick={() => decide(item, true)}>
              Descontar
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
