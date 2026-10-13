"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { Ban, CalendarPlus, Loader2, Pencil } from "lucide-react"
import { toast } from "sonner"
import { cancelSessionAction, saveSessionAction, type SessionFormState } from "@/app/admin/horario/actions"
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
import type { ClassTypeRow } from "@/lib/data/class-types"
import type { CoachOption, SessionRow } from "@/lib/data/schedule"
import { formatDayLabel, toDateKey, toTimeKey } from "@/lib/dates"
import { CAPACITY_MAX, DURATION_MAX, DURATION_MIN } from "@/lib/validation/class-types"
import { CANCEL_REASON_MAX } from "@/lib/validation/schedule"

// Próximas sesiones (SPEC F3): sesión suelta, mover o cambiar entrenador/aforo, y cancelar

const initialState: SessionFormState = {}

type Options = { classTypes: ClassTypeRow[]; coaches: CoachOption[]; today: string }

/** Texto de la sesión para lectores de pantalla: "CrossTraining del lun 6 oct a las 09:00" o "… de hoy …" */
export function sessionLabel(session: SessionRow, today: string) {
  const day = formatDayLabel(toDateKey(session.startsAt), today)
  const when = day === "Hoy" || day === "Mañana" ? `de ${day.toLowerCase()}` : `del ${day}`
  return `${session.className} ${when} a las ${toTimeKey(session.startsAt)}`
}

/** Botón «Sesión suelta» o «Editar» con el formulario en un diálogo. Se cierra al guardar */
export function SessionDialog({ session, ...options }: Options & { session?: SessionRow }) {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) setFormKey((k) => k + 1)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {session ? (
          <Button variant="outline" aria-label={`Editar ${sessionLabel(session, options.today)}`}>
            <Pencil data-icon="inline-start" aria-hidden="true" />
            Editar
          </Button>
        ) : (
          <Button>
            <CalendarPlus data-icon="inline-start" aria-hidden="true" />
            Sesión suelta
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{session ? `Editar ${session.className}` : "Nueva sesión suelta"}</DialogTitle>
          <DialogDescription>
            {session
              ? "Solo cambia esta sesión. Los cambios del horario semanal ya no la modificarán."
              : "Una clase que no se repite: no forma parte del horario semanal."}
          </DialogDescription>
        </DialogHeader>
        <SessionForm key={formKey} session={session} {...options} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function SessionForm({ session, classTypes, coaches, today, onSaved }: Options & { session?: SessionRow; onSaved: () => void }) {
  const [state, formAction, pending] = useActionState(saveSessionAction, initialState)
  const types = classTypes.filter((t) => t.isActive)
  const [typeId, setTypeId] = useState(types[0]?.id ?? "")
  const type = types.find((t) => t.id === typeId)
  const kind = session?.kind ?? type?.kind
  const [duration, setDuration] = useState(
    String(session ? Math.round((session.endsAt.getTime() - session.startsAt.getTime()) / 60_000) : (type?.durationMinutes ?? 60)),
  )
  const [capacity, setCapacity] = useState(String(session?.capacity ?? type?.defaultCapacity ?? 12))
  // El entrenador que ya tiene se mantiene en la lista aunque ya no esté disponible
  const coachOptions =
    session?.coachId && !coaches.some((c) => c.userId === session.coachId)
      ? [...coaches, { userId: session.coachId, fullName: session.coachName ?? "Entrenador actual" }]
      : coaches
  const errors = state.fieldErrors ?? {}

  useEffect(() => {
    if (state.saved) {
      toast.success(session ? "Sesión guardada" : "Sesión suelta creada")
      onSaved()
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state, session, onSaved])

  function chooseType(id: string) {
    setTypeId(id)
    const next = types.find((t) => t.id === id)
    if (next) {
      setDuration(String(next.durationMinutes))
      setCapacity(String(next.defaultCapacity))
    }
  }

  const describedBy = (field: keyof typeof errors, hint?: string) =>
    [errors[field] ? `${field}-error` : null, hint].filter(Boolean).join(" ") || undefined
  const invalid = (field: keyof typeof errors) => (errors[field] ? true : undefined)

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {session ? (
        <input type="hidden" name="id" value={session.id} />
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="classTypeId">Tipo de clase</Label>
          <select
            id="classTypeId"
            name="classTypeId"
            className={SELECT}
            value={typeId}
            onChange={(e) => chooseType(e.target.value)}
            aria-invalid={invalid("classTypeId")}
            aria-describedby={describedBy("classTypeId")}
          >
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <FieldError id="classTypeId-error" message={errors.classTypeId} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="date">Día</Label>
          <Input
            id="date"
            name="date"
            type="date"
            min={today}
            required
            defaultValue={session ? toDateKey(session.startsAt) : today}
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
            defaultValue={session ? toTimeKey(session.startsAt) : "09:00"}
            aria-invalid={invalid("startTime")}
            aria-describedby={describedBy("startTime")}
          />
          <FieldError id="startTime-error" message={errors.startTime} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="durationMinutes">Duración (min)</Label>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            inputMode="numeric"
            min={DURATION_MIN}
            max={DURATION_MAX}
            step={5}
            required
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            aria-invalid={invalid("durationMinutes")}
            aria-describedby={describedBy("durationMinutes")}
          />
          <FieldError id="durationMinutes-error" message={errors.durationMinutes} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="capacity">Aforo</Label>
          {kind === "individual" ? (
            <Input id="capacity" value={1} readOnly disabled aria-describedby="capacity-hint" />
          ) : (
            <Input
              id="capacity"
              name="capacity"
              type="number"
              inputMode="numeric"
              min={Math.max(1, session?.booked ?? 1)}
              max={CAPACITY_MAX}
              required
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              aria-invalid={invalid("capacity")}
              aria-describedby={describedBy("capacity", "capacity-hint")}
            />
          )}
          <p id="capacity-hint" className="text-xs text-muted-foreground">
            {kind === "individual"
              ? "Siempre 1 persona"
              : session && session.booked > 0
                ? `Mínimo ${session.booked}: reservas confirmadas`
                : "Plazas de la sesión"}
          </p>
          <FieldError id="capacity-error" message={errors.capacity} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="coachId">Entrenador</Label>
        <select
          id="coachId"
          name="coachId"
          className={SELECT}
          defaultValue={session?.coachId ?? ""}
          aria-invalid={invalid("coachId")}
          aria-describedby={describedBy("coachId")}
        >
          <option value="">Sin asignar</option>
          {coachOptions.map((coach) => (
            <option key={coach.userId} value={coach.userId}>
              {coach.fullName}
            </option>
          ))}
        </select>
        <FieldError id="coachId-error" message={errors.coachId} />
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Volver
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" /> : null}
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Cancelar con motivo opcional. Avisa de las reservas que se anulan */
export function CancelSessionDialog({ session, today }: { session: SessionRow; today: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [pending, startTransition] = useTransition()
  const label = sessionLabel(session, today)
  const affected = session.booked + session.waitlisted

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) setReason("")
  }

  function cancel() {
    startTransition(async () => {
      const result = await cancelSessionAction(session.id, reason)
      if (result.ok) {
        toast.success(`${result.message}: ${label}`)
        setOpen(false)
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" aria-label={`Cancelar ${label}`}>
          <Ban data-icon="inline-start" aria-hidden="true" />
          Cancelar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`¿Cancelar ${label}?`}</DialogTitle>
          <DialogDescription>
            {affected === 0
              ? "No tiene reservas. No se puede deshacer."
              : `Se anularán ${bookingsText(session)} sin descontar clases de la tarifa. Por ahora la app no avisa a los clientes: avísales tú. No se puede deshacer.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`reason-${session.id}`}>Motivo (opcional)</Label>
          <Input
            id={`reason-${session.id}`}
            value={reason}
            maxLength={CANCEL_REASON_MAX}
            placeholder="Festivo, avería…"
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Volver</Button>
          </DialogClose>
          <Button variant="destructive" disabled={pending} onClick={cancel}>
            {pending ? <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" /> : null}
            Cancelar sesión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** "3 reservas y 1 en lista de espera" */
function bookingsText({ booked, waitlisted }: SessionRow) {
  const parts = [
    booked > 0 ? (booked === 1 ? "1 reserva" : `${booked} reservas`) : null,
    waitlisted > 0 ? `${waitlisted} en lista de espera` : null,
  ]
  return parts.filter(Boolean).join(" y ")
}
