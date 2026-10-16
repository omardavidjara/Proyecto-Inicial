"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { ChevronRight, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { loadHistoryAction, type HistoryPageResult } from "@/app/(client)/reservas/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { HistoryEntry } from "@/lib/booking-history"
import { CLASS_COLOR_BG } from "@/lib/sessions"
import { cn } from "@/lib/utils"

type Props = {
  initial: HistoryEntry[]
  initialCursor: string | null
  /** Server Action de «Ver más»: por defecto, mi historial; en la ficha del cliente, el suyo */
  load?: (cursor: string | null) => Promise<HistoryPageResult>
  /** Ruta del detalle de cada sesión */
  sessionBase?: string
}

/** Historial de reservas: la primera página llega del servidor y «Ver más» añade las siguientes */
export function BookingHistory({ initial, initialCursor, load = loadHistoryAction, sessionBase = "/calendario" }: Props) {
  const [items, setItems] = useState(initial)
  const [cursor, setCursor] = useState(initialCursor)
  const [pending, startTransition] = useTransition()

  const loadMore = () =>
    startTransition(async () => {
      try {
        const page = await load(cursor)
        // Sin duplicados si se pulsa dos veces o cambia algo entre páginas
        setItems((current) => {
          const seen = new Set(current.map((item) => item.id))
          return [...current, ...page.items.filter((item) => !seen.has(item.id))]
        })
        setCursor(page.nextCursor)
      } catch {
        toast.error("No se ha podido cargar el historial. Inténtalo de nuevo.")
      }
    })

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`${sessionBase}/${item.sessionId}`}
              className="relative flex min-h-16 items-center gap-3 py-3 pr-3 pl-5 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden="true" className={cn("absolute inset-y-2 left-0 w-1 rounded-r", CLASS_COLOR_BG[item.color])} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={cn("truncate font-medium", item.struck && "line-through")}>{item.className}</span>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm text-muted-foreground">
                    {item.day} · <span className="tabular-nums">{item.time}</span>
                  </span>
                  <Badge variant={item.status.variant}>{item.status.label}</Badge>
                </div>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      {cursor && (
        <Button variant="outline" onClick={loadMore} disabled={pending}>
          {pending && <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" />}
          Ver más
        </Button>
      )}
    </div>
  )
}
