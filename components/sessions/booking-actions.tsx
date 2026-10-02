"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
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

type State = "none" | "confirmed" | "waitlisted"

/**
 * PROTOTIPO: simula reservar / anular / lista de espera sin servidor.
 * En F5 cada acción será una Server Action con las reglas de docs/ARCHITECTURE.md §4.
 */
export function BookingActions({ initial, full, disabledReason, lateCancel }: {
  initial: State
  full: boolean
  /** Si la sesión no admite cambios (cerrada o cancelada), el motivo */
  disabledReason?: string
  /** Faltan menos de 2 h: anular será una anulación tardía */
  lateCancel: boolean
}) {
  const [state, setState] = useState<State>(initial)
  const [pending, startTransition] = useTransition()

  function run(next: State, message: string) {
    startTransition(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600))
      setState(next)
      toast.success(message)
    })
  }

  if (disabledReason) {
    return (
      <Button size="lg" className="w-full" disabled>
        {disabledReason}
      </Button>
    )
  }

  if (state === "confirmed" || state === "waitlisted") {
    const leaving = state === "waitlisted"
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button size="lg" variant="destructive" className="w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" />}
            {pending ? "Anulando…" : leaving ? "Salir de la lista de espera" : "Anular reserva"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{leaving ? "¿Salir de la lista de espera?" : "¿Anular la reserva?"}</DialogTitle>
            <DialogDescription>
              {leaving
                ? "Perderás tu puesto en la lista de espera."
                : lateCancel
                  ? "Faltan menos de 2 horas: será una anulación tardía y el gimnasio decidirá si descuenta la clase."
                  : "Se liberará tu plaza y no se descontará la clase."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Volver</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                variant="destructive"
                onClick={() => run("none", leaving ? "Has salido de la lista de espera" : "Reserva anulada")}
              >
                {leaving ? "Salir" : "Anular"}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Button
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={() =>
        full
          ? run("waitlisted", "Te has apuntado a la lista de espera")
          : run("confirmed", "Reserva confirmada")
      }
    >
      {pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" />}
      {pending ? "Reservando…" : full ? "Apuntarme a la lista de espera" : "Reservar"}
    </Button>
  )
}
