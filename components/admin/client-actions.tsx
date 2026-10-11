"use client"

import { useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { decideClientAction } from "@/app/admin/clientes/actions"
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
import type { ProfileStatus } from "@/lib/roles"

type Decision = "approve" | "reject" | "deactivate" | "reactivate"

/** Botones de cada cliente según su estado. Rechazar y dar de baja piden confirmación */
export function ClientActions({ userId, name, status }: { userId: string; name: string; status: ProfileStatus }) {
  const [pending, startTransition] = useTransition()

  function run(decision: Decision) {
    startTransition(async () => {
      const result = await decideClientAction(decision, userId)
      if (result.ok) toast.success(`${result.message}: ${name}`)
      else toast.error(result.message)
    })
  }

  const spinner = pending ? <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" /> : null

  if (status === "pending") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Confirm
          title={`¿Rechazar el alta de ${name}?`}
          description="La cuenta quedará de baja y no podrá reservar. No se borra: si fue un error, podrás reactivarla."
          confirm="Rechazar"
          onConfirm={() => run("reject")}
        >
          <Button variant="outline" disabled={pending}>
            Rechazar
          </Button>
        </Confirm>
        <Button onClick={() => run("approve")} disabled={pending}>
          {spinner}
          Aprobar
        </Button>
      </div>
    )
  }
  if (status === "active") {
    return (
      <Confirm
        title={`¿Dar de baja a ${name}?`}
        description="No podrá reservar y se anularán sus reservas futuras, sin descontar. Sus datos y su historial se conservan y podrás reactivarlo."
        confirm="Dar de baja"
        onConfirm={() => run("deactivate")}
      >
        <Button variant="destructive" disabled={pending}>
          {spinner}
          Dar de baja
        </Button>
      </Confirm>
    )
  }
  return (
    <Button variant="outline" onClick={() => run("reactivate")} disabled={pending}>
      {spinner}
      Reactivar
    </Button>
  )
}

function Confirm({ title, description, confirm, onConfirm, children }: {
  title: string
  description: string
  confirm: string
  onConfirm: () => void
  children: React.ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Volver</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" onClick={onConfirm}>
              {confirm}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
