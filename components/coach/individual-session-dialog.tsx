"use client"

import { useActionState, useEffect, useState } from "react"
import { Loader2, Search, UserPlus } from "lucide-react"
import { toast } from "sonner"
import {
  createIndividualSessionAction,
  searchCoachClientsAction,
  type CoachClientOption,
  type IndividualSessionFormState,
} from "@/app/entrenador/actions"
import { FieldError, SELECT } from "@/components/admin/schedule-slot-form"
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
import type { IndividualClassType } from "@/lib/data/individual-sessions"

// Sesión individual del entrenador (SPEC F7): tipo individual, día, hora y un cliente. Al crearla se abre su detalle

const initialState: IndividualSessionFormState = {}

export function IndividualSessionDialog({ classTypes, today }: { classTypes: IndividualClassType[]; today: string }) {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) setFormKey((k) => k + 1)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus data-icon="inline-start" aria-hidden="true" />
          Sesión individual
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva sesión individual</DialogTitle>
          <DialogDescription>
            La impartes tú, para un cliente. Gasta una clase de su tarifa, aunque esté fuera de la ventana de reserva.
          </DialogDescription>
        </DialogHeader>
        {classTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay tipos de clase individuales activos. Pide a administración que cree uno.
          </p>
        ) : (
          <IndividualSessionForm key={formKey} classTypes={classTypes} today={today} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function IndividualSessionForm({ classTypes, today }: { classTypes: IndividualClassType[]; today: string }) {
  const [state, formAction, pending] = useActionState(createIndividualSessionAction, initialState)
  const [client, setClient] = useState<CoachClientOption | null>(null)
  const errors = state.fieldErrors ?? {}

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  const describedBy = (field: keyof typeof errors) => (errors[field] ? `${field}-error` : undefined)
  const invalid = (field: keyof typeof errors) => (errors[field] ? true : undefined)

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="classTypeId">Tipo de clase</Label>
        <select
          id="classTypeId"
          name="classTypeId"
          className={SELECT}
          defaultValue={classTypes[0].id}
          aria-invalid={invalid("classTypeId")}
          aria-describedby={describedBy("classTypeId")}
        >
          {classTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {`${t.name} · ${t.durationMinutes} min`}
            </option>
          ))}
        </select>
        <FieldError id="classTypeId-error" message={errors.classTypeId} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="date">Día</Label>
          <Input
            id="date"
            name="date"
            type="date"
            min={today}
            required
            defaultValue={today}
            aria-invalid={invalid("date")}
            aria-describedby={describedBy("date")}
          />
          <FieldError id="date-error" message={errors.date} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="startTime">Hora de inicio</Label>
          <Input
            id="startTime"
            name="startTime"
            type="time"
            step={300}
            required
            defaultValue="09:00"
            aria-invalid={invalid("startTime")}
            aria-describedby={describedBy("startTime")}
          />
          <FieldError id="startTime-error" message={errors.startTime} />
        </div>
      </div>

      <input type="hidden" name="clientId" value={client?.userId ?? ""} />
      {client ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Cliente</span>
          <div className="flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2">
            <Initial name={client.fullName} />
            <span className="flex-1 font-medium">{client.fullName}</span>
            <Button type="button" variant="ghost" onClick={() => setClient(null)} aria-label={`Cambiar el cliente ${client.fullName}`}>
              Cambiar
            </Button>
          </div>
          <FieldError id="clientId-error" message={errors.clientId} />
        </div>
      ) : (
        <ClientSearch onPick={setClient} error={errors.clientId} />
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Volver
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" /> : null}
          {pending ? "Creando…" : "Crear sesión"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Buscar un cliente activo por nombre (al menos 2 letras) */
function ClientSearch({ onPick, error }: { onPick: (client: CoachClientOption) => void; error?: string }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<CoachClientOption[] | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    let stale = false
    const timer = setTimeout(async () => {
      const found = await searchCoachClientsAction(q)
      if (!stale) setResults(found)
    }, 250)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [query])

  const shown = query.trim().length < 2 ? null : results

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="client-search">Cliente</Label>
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
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "clientId-error" : undefined}
        />
      </div>
      <FieldError id="clientId-error" message={error} />
      <div aria-live="polite">
        {shown && shown.length === 0 && <p className="py-3 text-center text-sm text-muted-foreground">Ningún cliente activo con ese nombre</p>}
        {shown && shown.length > 0 && (
          <ul className="flex max-h-60 flex-col divide-y overflow-y-auto rounded-xl border">
            {shown.map((option) => (
              <li key={option.userId}>
                <button
                  type="button"
                  onClick={() => onPick(option)}
                  className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted"
                >
                  <Initial name={option.fullName} />
                  <span className="flex-1 font-medium">{option.fullName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Initial({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
      {name.charAt(0).toUpperCase()}
    </span>
  )
}
