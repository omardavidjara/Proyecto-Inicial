"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { Loader2, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { saveIncidentAction, searchIncidentClientsAction, setIncidentStatusAction } from "@/app/admin/incidencias/actions"
import { createCoachIncidentAction } from "@/app/entrenador/incidencias/actions"
import { FieldError, SELECT } from "@/components/admin/schedule-slot-form"
import { ClientInitial, ClientSearch, type ClientOption } from "@/components/client-search"
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
import type { IncidentRow } from "@/lib/data/incidents"
import type { IncidentFormState } from "@/lib/incident-form"
import { DESCRIPTION_MAX, INCIDENT_PRIORITIES, PRIORITY_LABEL, TITLE_MAX, type IncidentStatus } from "@/lib/validation/incidents"

// Incidencias (SPEC F9). Sin datos de salud (RGPD art. 9, ARCHITECTURE §7): el formulario lo recuerda.
// Administración crea y edita con cliente opcional (buscador); el entrenador solo crea, y solo asocia su sesión
// y a alguien apuntado a ella (lo comprueba el servidor)

const initialState: IncidentFormState = {}

export const TEXTAREA =
  "min-h-28 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30"

type Props = {
  area?: "admin" | "coach"
  /** Editar esta incidencia (solo administración; sin cambiar el cliente ni la sesión) */
  incident?: IncidentRow
  /** Nueva incidencia ya asociada a este cliente (desde su ficha) */
  client?: ClientOption
  /** Nueva incidencia asociada a esta sesión (desde su detalle) */
  session?: { id: string; label: string }
  /** Con `session`: los clientes apuntados, para elegir uno (opcional) */
  sessionClients?: ClientOption[]
}

/** Botón «Nueva incidencia» o «Editar» con el formulario en un diálogo. Se cierra al guardar */
export function IncidentDialog(props: Props) {
  const { incident } = props
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) setFormKey((k) => k + 1)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {incident ? (
          <Button variant="outline">
            <Pencil data-icon="inline-start" aria-hidden="true" />
            Editar
          </Button>
        ) : (
          <Button>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Nueva incidencia
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{incident ? "Editar incidencia" : "Nueva incidencia"}</DialogTitle>
          <DialogDescription>No escribas datos de salud (lesiones, enfermedades, medicación).</DialogDescription>
        </DialogHeader>
        <IncidentForm key={formKey} {...props} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function IncidentForm({ area = "admin", incident, client: fixedClient, session, sessionClients = [], onSaved }: Props & { onSaved: () => void }) {
  const [state, formAction, pending] = useActionState(area === "coach" ? createCoachIncidentAction : saveIncidentAction, initialState)
  const [client, setClient] = useState<ClientOption | null>(fixedClient ?? null)
  const errors = state.fieldErrors ?? {}

  useEffect(() => {
    if (state.saved) {
      toast.success(incident ? "Incidencia guardada" : "Incidencia abierta")
      onSaved()
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state, incident, onSaved])

  const describedBy = (field: keyof typeof errors) => (errors[field] ? `${field}-error` : undefined)
  const invalid = (field: keyof typeof errors) => (errors[field] ? true : undefined)

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {incident ? <input type="hidden" name="id" value={incident.id} /> : null}
      {session ? <input type="hidden" name="sessionId" value={session.id} /> : null}

      {session ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Sesión: <span className="font-medium">{session.label}</span>
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={TITLE_MAX}
          autoComplete="off"
          defaultValue={incident?.title}
          aria-invalid={invalid("title")}
          aria-describedby={describedBy("title")}
        />
        <FieldError id="title-error" message={errors.title} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Descripción</Label>
        <textarea
          id="description"
          name="description"
          required
          maxLength={DESCRIPTION_MAX}
          rows={4}
          defaultValue={incident?.description}
          className={TEXTAREA}
          aria-invalid={invalid("description")}
          aria-describedby={describedBy("description")}
        />
        <FieldError id="description-error" message={errors.description} />
      </div>

      <fieldset className="flex flex-col gap-2" aria-describedby={describedBy("priority")}>
        <legend className="mb-2 text-sm font-medium">Prioridad</legend>
        <div className="grid grid-cols-3 gap-2">
          {INCIDENT_PRIORITIES.map((p) => (
            <label
              key={p}
              className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border p-2 text-sm font-medium has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <input type="radio" name="priority" value={p} defaultChecked={p === (incident?.priority ?? "medium")} className="sr-only" />
              {PRIORITY_LABEL[p]}
            </label>
          ))}
        </div>
        <FieldError id="priority-error" message={errors.priority} />
      </fieldset>

      {incident ? null : fixedClient ? (
        <div className="flex flex-col gap-2">
          <input type="hidden" name="clientId" value={fixedClient.userId} />
          <span className="text-sm font-medium">Cliente</span>
          <div className="flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2">
            <ClientInitial name={fixedClient.fullName} />
            <span className="flex-1 font-medium">{fixedClient.fullName}</span>
          </div>
          <FieldError id="clientId-error" message={errors.clientId} />
        </div>
      ) : session ? (
        sessionClients.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="clientId">Cliente (opcional)</Label>
            <select
              id="clientId"
              name="clientId"
              className={SELECT}
              defaultValue=""
              aria-invalid={invalid("clientId")}
              aria-describedby={describedBy("clientId")}
            >
              <option value="">Ninguno</option>
              {sessionClients.map((c) => (
                <option key={c.userId} value={c.userId}>
                  {c.fullName}
                </option>
              ))}
            </select>
            <FieldError id="clientId-error" message={errors.clientId} />
          </div>
        ) : null
      ) : area === "admin" ? (
        <>
          <input type="hidden" name="clientId" value={client?.userId ?? ""} />
          {client ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Cliente</span>
              <div className="flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2">
                <ClientInitial name={client.fullName} />
                <span className="flex-1 font-medium">{client.fullName}</span>
                <Button type="button" variant="ghost" onClick={() => setClient(null)} aria-label={`Quitar el cliente ${client.fullName}`}>
                  Quitar
                </Button>
              </div>
              <FieldError id="clientId-error" message={errors.clientId} />
            </div>
          ) : (
            <ClientSearch search={searchIncidentClientsAction} onPick={setClient} error={errors.clientId} label="Cliente (opcional)" />
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Para asociarla a una sesión tuya o a uno de sus clientes, ábrela desde el detalle de esa sesión.
        </p>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" /> : null}
          {pending ? "Guardando…" : incident ? "Guardar" : "Abrir incidencia"}
        </Button>
      </DialogFooter>
    </form>
  )
}

const NEXT_STEPS: Record<IncidentStatus, { status: IncidentStatus; label: string; primary?: boolean }[]> = {
  open: [
    { status: "in_progress", label: "Marcar en curso", primary: true },
    { status: "closed", label: "Cerrar" },
  ],
  in_progress: [
    { status: "closed", label: "Cerrar", primary: true },
    { status: "open", label: "Volver a abierta" },
  ],
  closed: [{ status: "open", label: "Reabrir" }],
}

/** Botones para pasar de estado (solo administración): abierta → en curso → cerrada, y reabrir */
export function IncidentStatusActions({ id, status }: { id: string; status: IncidentStatus }) {
  const [pending, startTransition] = useTransition()

  function change(next: IncidentStatus) {
    startTransition(async () => {
      const result = await setIncidentStatusAction(id, next)
      if (result.ok) toast.success(result.message)
      else toast.error(result.message)
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {NEXT_STEPS[status].map((step) => (
        <Button
          key={step.status}
          variant={step.primary ? "default" : "outline"}
          disabled={pending}
          onClick={() => change(step.status)}
          className="h-11"
        >
          {step.label}
        </Button>
      ))}
    </div>
  )
}
