"use client"

import { useEffect, useState, useTransition, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { loadAnnouncementsAction, markAnnouncementsSeenAction } from "@/app/(client)/avisos/actions"
import { Button } from "@/components/ui/button"
import type { AnnouncementEntry } from "@/lib/announcements"

/** Los avisos como tarjetas. `actions`: botones de cada aviso (eliminar, en administración) */
export function AnnouncementCards({ items, actions }: { items: AnnouncementEntry[]; actions?: (item: AnnouncementEntry) => ReactNode }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-2 rounded-xl border bg-card p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="font-medium [overflow-wrap:anywhere]">{item.title}</h3>
            <p className="text-sm whitespace-pre-line [overflow-wrap:anywhere]">{item.body}</p>
            <p className="text-xs text-muted-foreground">{item.date}</p>
          </div>
          {actions?.(item)}
        </li>
      ))}
    </ul>
  )
}

type Props = {
  initial: AnnouncementEntry[]
  initialCursor: string | null
  actions?: (item: AnnouncementEntry) => ReactNode
}

/** Lista completa: la primera página llega del servidor y «Ver más» añade las siguientes */
export function AnnouncementList({ initial, initialCursor, actions }: Props) {
  const [extra, setExtra] = useState<AnnouncementEntry[]>([])
  const [cursor, setCursor] = useState(initialCursor)
  const [pending, startTransition] = useTransition()

  const loadMore = () =>
    startTransition(async () => {
      try {
        const page = await loadAnnouncementsAction(cursor)
        setExtra((current) => [...current, ...page.items])
        setCursor(page.nextCursor)
      } catch {
        toast.error("No se han podido cargar los avisos. Inténtalo de nuevo.")
      }
    })

  // La primera página manda: un aviso eliminado o recién publicado se refleja sin perder lo ya cargado
  const seen = new Set(initial.map((item) => item.id))
  const items = [...initial, ...extra.filter((item) => !seen.has(item.id) && seen.add(item.id))]

  return (
    <div className="flex flex-col gap-3">
      <AnnouncementCards items={items} actions={actions} />
      {cursor && (
        <Button variant="outline" onClick={loadMore} disabled={pending}>
          {pending && <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" />}
          Ver más
        </Button>
      )}
    </div>
  )
}

/** Al abrir la pantalla de avisos, deja de haberlos sin leer */
export function MarkAnnouncementsSeen() {
  useEffect(() => {
    markAnnouncementsSeenAction().catch(() => {})
  }, [])
  return null
}
