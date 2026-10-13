"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftRight, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { bookSessionAction, cancelBookingAction, changeBookingAction, type BookingActionResult } from "@/app/(client)/calendario/actions"
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

type MyBooking = { id: string; status: "confirmed" | "waitlisted" }

/**
 * Reservar, apuntarse a la lista de espera, anular o cambiar de sesión (SPEC F5). Cada botón llama a una Server
 * Action; las reglas se comprueban en el servidor y aquí solo se muestra el resultado.
 */
export function BookingActions({ sessionId, myBooking, full, disabledReason, lateCancel, deadline, changeFrom, changeHref }: {
  sessionId: string
  /** Mi reserva viva en esta sesión */
  myBooking: MyBooking | null
  full: boolean
  /** Si la sesión no admite cambios (cerrada, cancelada o aún sin abrir), el motivo */
  disabledReason?: string
  /** Anular ahora sería una anulación tardía */
  lateCancel: boolean
  /** Plazo de anulación sin penalización, p. ej. "2 horas" */
  deadline: string
  /** Cambiando de sesión: la reserva de origen, su descripción y si anularla ahora sería tardío */
  changeFrom?: { bookingId: string; label: string; late: boolean }
  /** Enlace al calendario para elegir otra sesión */
  changeHref?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<BookingActionResult>, after?: () => void) {
    startTransition(async () => {
      try {
        const { ok, message } = await action()
        if (ok) {
          toast.success(message)
          after?.()
        } else {
          toast.error(message)
        }
      } catch {
        toast.error("No se ha podido completar. Comprueba la conexión e inténtalo de nuevo.")
      }
    })
  }

  const spinner = pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" />

  if (disabledReason) {
    return (
      <Button size="lg" className="w-full" disabled>
        {disabledReason}
      </Button>
    )
  }

  if (changeFrom && !myBooking) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          className="w-full"
          disabled={pending || full}
          onClick={() =>
            run(
              () => changeBookingAction(changeFrom.bookingId, sessionId),
              () => router.replace(`/calendario/${sessionId}`),
            )
          }
        >
          {spinner}
          {pending ? "Cambiando…" : full ? "Completa: elige otra sesión" : "Cambiar a esta sesión"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Se anulará tu reserva de {changeFrom.label}
          {changeFrom.late && ", y será una anulación tardía"}.
        </p>
      </div>
    )
  }

  if (myBooking) {
    const leaving = myBooking.status === "waitlisted"
    return (
      <div className="flex flex-col gap-2">
        {changeHref && (
          <Button size="lg" variant="outline" className="w-full" asChild>
            <Link href={changeHref}>
              <ArrowLeftRight data-icon="inline-start" aria-hidden="true" />
              Cambiar a otra sesión
            </Link>
          </Button>
        )}
        <Dialog>
          <DialogTrigger asChild>
            <Button size="lg" variant="destructive" className="w-full" disabled={pending}>
              {spinner}
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
                    ? `Faltan menos de ${deadline}: será una anulación tardía y el gimnasio decidirá si descuenta la clase.`
                    : "Se liberará tu plaza y no se descontará la clase."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Volver</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="destructive" onClick={() => run(() => cancelBookingAction(myBooking.id))}>
                  {leaving ? "Salir" : "Anular"}
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <Button size="lg" className="w-full" disabled={pending} onClick={() => run(() => bookSessionAction(sessionId))}>
      {spinner}
      {pending ? "Reservando…" : full ? "Apuntarme a la lista de espera" : "Reservar"}
    </Button>
  )
}
