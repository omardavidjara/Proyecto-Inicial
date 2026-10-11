"use client"

import { useActionState } from "react"
import { LoaderCircle, UserX } from "lucide-react"
import { deleteAccount, type DeleteAccountState } from "@/app/(cuenta)/perfil/actions"
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
import { DELETE_CONFIRMATION } from "@/lib/validation/auth"

export type AccountDeletion = "available" | "developer" | "unavailable"

const initialState: DeleteAccountState = {}

/** "Eliminar mi cuenta" (SPEC F1): obligatorio por el RGPD y para publicar en las tiendas */
export function DeleteAccount({ deletion }: { deletion: AccountDeletion }) {
  const [state, formAction, pending] = useActionState(deleteAccount, initialState)

  return (
    <section aria-labelledby="delete-title" className="flex flex-col gap-3 rounded-xl border border-destructive/30 p-4">
      <h2 id="delete-title" className="font-semibold">
        Eliminar mi cuenta
      </h2>
      <p className="text-sm text-muted-foreground">
        Se borra tu acceso y tus datos personales (nombre, teléfono y foto) y se anulan tus reservas futuras. Tu historial
        de reservas se conserva sin datos que te identifiquen. No se puede deshacer.
      </p>
      {deletion === "developer" ? (
        <p className="text-sm">El rol de desarrollador no se puede eliminar desde la app.</p>
      ) : deletion === "unavailable" ? (
        <p className="text-sm">No disponible en este entorno de pruebas.</p>
      ) : (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" className="self-start">
              <UserX data-icon="inline-start" aria-hidden="true" />
              Eliminar mi cuenta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form action={formAction} className="flex flex-col gap-4" noValidate>
              <DialogHeader>
                <DialogTitle>¿Eliminar tu cuenta?</DialogTitle>
                <DialogDescription>
                  Perderás el acceso y se anularán tus reservas futuras. Para confirmar, escribe {DELETE_CONFIRMATION}.
                </DialogDescription>
              </DialogHeader>
              {state.error ? (
                <p role="alert" className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
                  {state.error}
                </p>
              ) : null}
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmation">Escribe {DELETE_CONFIRMATION}</Label>
                <Input id="confirmation" name="confirmation" autoComplete="off" autoCapitalize="characters" required />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Volver
                  </Button>
                </DialogClose>
                <Button type="submit" variant="destructive" disabled={pending}>
                  {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                  {pending ? "Eliminando…" : "Eliminar definitivamente"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}
