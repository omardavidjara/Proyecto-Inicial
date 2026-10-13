"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  deleteScheduleSlotAction,
  saveScheduleSlotAction,
  setScheduleSlotActiveAction,
  type ScheduleSlotFormState,
} from "@/app/admin/horario/actions"
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
import type { CoachOption, ScheduleSlotRow } from "@/lib/data/schedule"
import { CAPACITY_MAX, DURATION_MAX, DURATION_MIN } from "@/lib/validation/class-types"
import { WEEKDAYS } from "@/lib/validation/schedule"

const initialState: ScheduleSlotFormState = {}

// Desplegable nativo con el aspecto de Input (mejor en móvil que uno propio). También en session-form
export const SELECT =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30"

type Options = { classTypes: ClassTypeRow[]; coaches: CoachOption[] }

/** Texto de la franja para lectores de pantalla: "CrossTraining del lunes a las 09:00" */
function slotLabel(slot: ScheduleSlotRow) {
  return `${slot.className} del ${WEEKDAYS[slot.weekday].toLowerCase()} a las ${slot.startTime}`
}

/** Botón «Nueva clase» o «Editar» con el formulario en un diálogo. Se cierra al guardar */
export function ScheduleSlotDialog({ slot, classTypes, coaches }: Options & { slot?: ScheduleSlotRow }) {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)

  function onOpenChange(next: boolean) {
    setOpen(next)
    // Al volver a abrir, el formulario empieza de cero (sin errores ni cambios a medias)
    if (next) setFormKey((k) => k + 1)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {slot ? (
          <Button variant="outline" aria-label={`Editar ${slotLabel(slot)}`}>
            <Pencil data-icon="inline-start" aria-hidden="true" />
            Editar
          </Button>
        ) : (
          <Button>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Nueva clase
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{slot ? "Editar clase del horario" : "Nueva clase en el horario"}</DialogTitle>
          <DialogDescription>
            {slot
              ? "Se actualizan las próximas sesiones sin reservas ni cambios a mano. Las demás se mantienen como están."
              : "Se repite cada semana. Las sesiones de las próximas 4 semanas se crean al guardar."}
          </DialogDescription>
        </DialogHeader>
        <ScheduleSlotForm key={formKey} slot={slot} classTypes={classTypes} coaches={coaches} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ScheduleSlotForm({ slot, classTypes, coaches, onSaved }: Options & { slot?: ScheduleSlotRow; onSaved: () => void }) {
  const [state, formAction, pending] = useActionState(saveScheduleSlotAction, initialState)
  // Tipos activos y, al editar, también el que ya tiene la franja aunque se haya desactivado
  const types = classTypes.filter((t) => t.isActive || t.id === slot?.classTypeId)
  const [typeId, setTypeId] = useState(slot?.classTypeId ?? types[0]?.id ?? "")
  const type = types.find((t) => t.id === typeId)
  const [duration, setDuration] = useState(String(slot?.durationMinutes ?? type?.durationMinutes ?? 60))
  const [capacity, setCapacity] = useState(String(slot?.capacity ?? type?.defaultCapacity ?? 12))
  const errors = state.fieldErrors ?? {}

  useEffect(() => {
    if (state.saved) {
      toast.success(slot ? "Clase del horario guardada" : "Clase añadida al horario")
      onSaved()
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state, slot, onSaved])

  /** Al cambiar de tipo se proponen su duración y su aforo */
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
      {slot ? <input type="hidden" name="id" value={slot.id} /> : null}

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
              {t.isActive ? t.name : `${t.name} (inactivo)`}
            </option>
          ))}
        </select>
        <FieldError id="classTypeId-error" message={errors.classTypeId} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="weekday">Día</Label>
          <select
            id="weekday"
            name="weekday"
            className={SELECT}
            defaultValue={slot?.weekday ?? 0}
            aria-invalid={invalid("weekday")}
            aria-describedby={describedBy("weekday")}
          >
            {WEEKDAYS.map((day, index) => (
              <option key={day} value={index}>
                {day}
              </option>
            ))}
          </select>
          <FieldError id="weekday-error" message={errors.weekday} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="startTime">Hora de inicio</Label>
          <Input
            id="startTime"
            name="startTime"
            type="time"
            step={300}
            required
            defaultValue={slot?.startTime ?? "09:00"}
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
          {type?.kind === "individual" ? (
            // El servidor fija 1 para las individuales: el campo solo informa
            <Input id="capacity" value={1} readOnly disabled aria-describedby="capacity-hint" />
          ) : (
            <Input
              id="capacity"
              name="capacity"
              type="number"
              inputMode="numeric"
              min={1}
              max={CAPACITY_MAX}
              required
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              aria-invalid={invalid("capacity")}
              aria-describedby={describedBy("capacity", "capacity-hint")}
            />
          )}
          <p id="capacity-hint" className="text-xs text-muted-foreground">
            {type?.kind === "individual" ? "Siempre 1 persona" : "Plazas de cada sesión"}
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
          defaultValue={slot?.coachId ?? ""}
          aria-invalid={invalid("coachId")}
          aria-describedby={describedBy("coachId")}
        >
          <option value="">Sin asignar</option>
          {coaches.map((coach) => (
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
            Cancelar
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

export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  ) : null
}

/** Activar o desactivar y eliminar (con confirmación) */
export function ScheduleSlotActions({ slot }: { slot: ScheduleSlotRow }) {
  const [pending, startTransition] = useTransition()
  const label = slotLabel(slot)

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action()
      if (result.ok) toast.success(`${result.message}: ${label}`)
      else toast.error(result.message)
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        disabled={pending}
        aria-label={`${slot.isActive ? "Desactivar" : "Activar"} ${label}`}
        onClick={() => run(() => setScheduleSlotActiveAction(slot.id, !slot.isActive))}
      >
        {slot.isActive ? "Desactivar" : "Activar"}
      </Button>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" disabled={pending} aria-label={`Eliminar ${label}`}>
            <Trash2 aria-hidden="true" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{`¿Eliminar ${label}?`}</DialogTitle>
            <DialogDescription>
              Se borran también sus próximas sesiones. Solo se puede eliminar si ninguna sesión suya ha pasado, tiene
              reservas o se ha cambiado a mano. Si no, desactívala: dejará de crear sesiones y se conservan las que ya
              tienen reservas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Volver</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="destructive" onClick={() => run(() => deleteScheduleSlotAction(slot.id))}>
                Eliminar
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
