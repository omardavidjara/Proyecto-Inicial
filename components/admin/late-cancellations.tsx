"use client"

import { useState } from "react"
import { CheckCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"

type LateCancellation = { id: string; client: string; session: string; when: string }

/** PROTOTIPO: decidir anulaciones tardías (F6). En la Fase 5 será una Server Action. */
export function LateCancellations({ initial }: { initial: LateCancellation[] }) {
  const [items, setItems] = useState(initial)

  function decide(item: LateCancellation, charge: boolean) {
    setItems((current) => current.filter((i) => i.id !== item.id))
    toast.success(charge ? `Clase descontada a ${item.client}` : `No se descuenta la clase a ${item.client}`)
  }

  if (items.length === 0) {
    return <EmptyState icon={<CheckCheck />} title="No hay anulaciones tardías pendientes" />
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
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
