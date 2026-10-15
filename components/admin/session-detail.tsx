"use client"

import { useEffect, useOptimistic, useState, useTransition } from "react"
import { Check, Search, UserMinus, UserPlus, Users, X } from "lucide-react"
import { toast } from "sonner"
import {
  addClientAction,
  removeBookingAction,
  searchClientsAction,
  setAttendanceAction,
  type ClientOption,
  type SessionActionResult,
} from "@/app/admin/sesiones/[sessionId]/actions"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Attendance } from "@/lib/data/session-detail"
import { cn } from "@/lib/utils"

// Detalle de sesión del administrador (SPEC F6): asistencia, quitar, confirmar desde la lista de espera y añadir
// a mano. Los textos llegan formateados del servidor; cada cambio es una Server Action que recarga la página.

export type AttendeeItem = { bookingId: string; fullName: string; attendance: Attendance; addedByStaff: boolean }
export type WaitlistItem = { bookingId: string; userId: string; fullName: string }

const ATTENDANCE_TOAST: Record<Attendance, string> = { attended: "asistió", no_show: "faltó", pending: "sin marcar" }

/**
 * Asistentes confirmados. Con `canMark` (la sesión ha empezado) se marca asistió / faltó; pulsar otra vez lo deja sin
 * marcar. El entrenador (F7) pasa su propia acción de asistencia y `canRemove={false}`.
 */
export function AttendeeList({
  items,
  canMark,
  readOnly,
  markAction = setAttendanceAction,
  canRemove = true,
}: {
  items: AttendeeItem[]
  canMark: boolean
  readOnly: boolean
  markAction?: (bookingId: string, attendance: Attendance) => Promise<SessionActionResult>
  canRemove?: boolean
}) {
  const [shown, setOptimistic] = useOptimistic(items, (current, { id, attendance }: { id: string; attendance: Attendance }) =>
    current.map((a) => (a.bookingId === id ? { ...a, attendance } : a)),
  )
  const [, startTransition] = useTransition()

  function mark(item: AttendeeItem, value: Attendance) {
    const next = item.attendance === value ? "pending" : value
    startTransition(async () => {
      setOptimistic({ id: item.bookingId, attendance: next })
      const result = await markAction(item.bookingId, next)
      if (result.ok) toast.success(`${item.fullName}: ${ATTENDANCE_TOAST[next]}`)
      else toast.error(result.message)
    })
  }

  if (shown.length === 0) return <EmptyState icon={<Users />} title="Nadie tiene plaza en esta sesión" />

  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {shown.map((a) => (
        <li key={a.bookingId} className="flex min-h-14 flex-wrap items-center gap-3 px-4 py-2">
          <Initial name={a.fullName} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{a.fullName}</span>
            {a.addedByStaff && <span className="text-xs text-muted-foreground">Añadido a mano</span>}
          </span>
          <div className="flex gap-1">
            {canMark && !readOnly && (
              <div className="flex gap-1" role="group" aria-label={`Asistencia de ${a.fullName}`}>
                <MarkButton active={a.attendance === "attended"} tone="success" label="Asistió" onClick={() => mark(a, "attended")}>
                  <Check />
                </MarkButton>
                <MarkButton active={a.attendance === "no_show"} tone="destructive" label="Faltó" onClick={() => mark(a, "no_show")}>
                  <X />
                </MarkButton>
              </div>
            )}
            {!readOnly && canRemove && <RemoveButton bookingId={a.bookingId} name={a.fullName} what="su plaza" />}
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Lista de espera por orden de llegada: confirmar la plaza a mano (aunque esté completa) o quitar */
export function WaitlistList({ sessionId, items, readOnly }: { sessionId: string; items: WaitlistItem[]; readOnly: boolean }) {
  const [pending, startTransition] = useTransition()

  function confirm(item: WaitlistItem) {
    startTransition(async () => {
      const result = await addClientAction(sessionId, item.userId)
      if (result.ok) toast.success(`${result.message}: ${item.fullName}`)
      else toast.error(result.message)
    })
  }

  return (
    <ol className="flex flex-col divide-y rounded-xl border bg-card">
      {items.map((w, index) => (
        <li key={w.bookingId} className="flex min-h-14 flex-wrap items-center gap-3 px-4 py-2">
          <span aria-hidden="true" className="w-5 text-center text-sm font-semibold text-muted-foreground tabular-nums">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{w.fullName}</span>
          {!readOnly && (
            <div className="flex gap-1">
              <Button variant="outline" disabled={pending} onClick={() => confirm(w)}>
                Confirmar plaza
              </Button>
              <RemoveButton bookingId={w.bookingId} name={w.fullName} what="su puesto en la lista de espera" />
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

function RemoveButton({ bookingId, name, what }: { bookingId: string; name: string; what: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function remove() {
    startTransition(async () => {
      const result = await removeBookingAction(bookingId)
      if (result.ok) toast.success(`${result.message}: ${name}`)
      else toast.error(result.message)
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Quitar a ${name}`}>
          <UserMinus />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quitar a {name}</DialogTitle>
          <DialogDescription>
            Se anula {what} sin descontar la clase de su tarifa. Si deja una plaza libre, entrará el primero de la lista
            de espera.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Volver</Button>
          </DialogClose>
          <Button variant="destructive" disabled={pending} onClick={remove}>
            Quitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Buscar un cliente activo por nombre y añadirlo, saltándose cupo, ventana y aforo */
export function AddClientDialog({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ClientOption[] | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    let stale = false
    const timer = setTimeout(async () => {
      const found = await searchClientsAction(sessionId, q)
      if (!stale) setResults(found)
    }, 250)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [query, sessionId])

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setQuery("")
      setResults(null)
    }
  }

  function add(option: ClientOption) {
    startTransition(async () => {
      const result = await addClientAction(sessionId, option.userId)
      if (result.ok) {
        toast.success(`${result.message}: ${option.fullName}`)
        setOpen(false)
      } else toast.error(result.message)
    })
  }

  const shown = query.trim().length < 2 ? null : results

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus />
          Añadir cliente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir cliente</DialogTitle>
          <DialogDescription>
            Se salta el cupo de su tarifa, la ventana de reserva y el aforo. Si estaba en la lista de espera, pasa a
            tener plaza.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="client-search">Nombre del cliente</Label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="client-search"
              type="search"
              autoComplete="off"
              className="pl-9"
              placeholder="Escribe al menos 2 letras"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div aria-live="polite" className="min-h-24">
          {shown && shown.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Ningún cliente activo sin plaza con ese nombre</p>}
          {shown && shown.length > 0 && (
            <ul className="flex max-h-72 flex-col divide-y overflow-y-auto rounded-xl border">
              {shown.map((option) => (
                <li key={option.userId}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => add(option)}
                    className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted disabled:opacity-50"
                  >
                    <Initial name={option.fullName} />
                    <span className="flex-1 font-medium">{option.fullName}</span>
                    {option.waitlisted && <span className="text-xs text-warning">En lista de espera</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Initial({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

function MarkButton({ active, tone, label, onClick, children }: {
  active: boolean
  tone: "success" | "destructive"
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-11 items-center justify-center rounded-lg border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5",
        !active && "text-muted-foreground hover:bg-muted active:bg-muted/70",
        active && tone === "success" && "border-success bg-success/15 text-success",
        active && tone === "destructive" && "border-destructive bg-destructive/15 text-destructive",
      )}
    >
      {children}
    </button>
  )
}
