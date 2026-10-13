"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { Check, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  deleteClassTypeAction,
  saveClassTypeAction,
  setClassTypeActiveAction,
  type ClassTypeFormState,
} from "@/app/admin/tipos-clase/actions"
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
import { CLASS_COLOR_BG, CLASS_COLOR_LABEL, CLASS_COLORS } from "@/lib/sessions"
import { cn } from "@/lib/utils"
import { CAPACITY_MAX, DURATION_MAX, DURATION_MIN, type ClassKind } from "@/lib/validation/class-types"

const initialState: ClassTypeFormState = {}

const KINDS: { value: ClassKind; label: string; hint: string }[] = [
  { value: "group", label: "Grupal", hint: "Varias personas a la vez" },
  { value: "individual", label: "Individual", hint: "Una sola persona (aforo 1)" },
]

/** Botón «Nuevo tipo» o «Editar» con el formulario en un diálogo. Se cierra al guardar */
export function ClassTypeDialog({ classType }: { classType?: ClassTypeRow }) {
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
        {classType ? (
          <Button variant="outline" aria-label={`Editar ${classType.name}`}>
            <Pencil data-icon="inline-start" aria-hidden="true" />
            Editar
          </Button>
        ) : (
          <Button>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Nuevo tipo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{classType ? "Editar tipo de clase" : "Nuevo tipo de clase"}</DialogTitle>
          <DialogDescription>
            {classType
              ? "Los cambios valen para el horario y las sesiones que crees a partir de ahora."
              : "Después podrás usarlo en el horario y en las sesiones."}
          </DialogDescription>
        </DialogHeader>
        <ClassTypeForm key={formKey} classType={classType} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ClassTypeForm({ classType, onSaved }: { classType?: ClassTypeRow; onSaved: () => void }) {
  const [state, formAction, pending] = useActionState(saveClassTypeAction, initialState)
  const [kind, setKind] = useState<ClassKind>(classType?.kind ?? "group")
  const errors = state.fieldErrors ?? {}

  useEffect(() => {
    if (state.saved) {
      toast.success(classType ? "Tipo de clase guardado" : "Tipo de clase creado")
      onSaved()
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state, classType, onSaved])

  const describedBy = (field: keyof typeof errors, hint?: string) =>
    [errors[field] ? `${field}-error` : null, hint].filter(Boolean).join(" ") || undefined

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {classType ? <input type="hidden" name="id" value={classType.id} /> : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={50}
          autoComplete="off"
          defaultValue={classType?.name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describedBy("name")}
        />
        <FieldError id="name-error" message={errors.name} />
      </div>

      <fieldset className="flex flex-col gap-2" aria-describedby={describedBy("kind")}>
        <legend className="mb-2 text-sm font-medium">Modalidad</legend>
        <div className="grid grid-cols-2 gap-2">
          {KINDS.map((k) => (
            <label
              key={k.value}
              className="flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-lg border p-3 has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <input
                type="radio"
                name="kind"
                value={k.value}
                checked={kind === k.value}
                onChange={() => setKind(k.value)}
                className="sr-only"
              />
              <span className="text-sm font-medium">{k.label}</span>
              <span className="text-xs text-muted-foreground">{k.hint}</span>
            </label>
          ))}
        </div>
        <FieldError id="kind-error" message={errors.kind} />
      </fieldset>

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
            defaultValue={classType?.durationMinutes ?? 60}
            aria-invalid={errors.durationMinutes ? true : undefined}
            aria-describedby={describedBy("durationMinutes")}
          />
          <FieldError id="durationMinutes-error" message={errors.durationMinutes} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="defaultCapacity">Aforo</Label>
          {kind === "individual" ? (
            // El servidor fija 1 para las individuales: el campo solo informa
            <Input id="defaultCapacity" value={1} readOnly disabled aria-describedby="defaultCapacity-hint" />
          ) : (
            <Input
              id="defaultCapacity"
              name="defaultCapacity"
              type="number"
              inputMode="numeric"
              min={1}
              max={CAPACITY_MAX}
              required
              defaultValue={classType && classType.kind === "group" ? classType.defaultCapacity : 12}
              aria-invalid={errors.defaultCapacity ? true : undefined}
              aria-describedby={describedBy("defaultCapacity", "defaultCapacity-hint")}
            />
          )}
          <p id="defaultCapacity-hint" className="text-xs text-muted-foreground">
            {kind === "individual" ? "Siempre 1 persona" : "Plazas por defecto"}
          </p>
          <FieldError id="defaultCapacity-error" message={errors.defaultCapacity} />
        </div>
      </div>

      <fieldset aria-describedby={describedBy("color")}>
        <legend className="mb-2 text-sm font-medium">Color</legend>
        <div className="flex flex-wrap gap-2">
          {CLASS_COLORS.map((color) => (
            <label
              key={color}
              title={CLASS_COLOR_LABEL[color]}
              className={cn(
                "group flex size-11 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-background has-checked:ring-2 has-checked:ring-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring",
                CLASS_COLOR_BG[color],
              )}
            >
              <input
                type="radio"
                name="color"
                value={color}
                defaultChecked={(classType?.color ?? "orange") === color}
                className="sr-only"
              />
              <span className="sr-only">{CLASS_COLOR_LABEL[color]}</span>
              <Check className="hidden size-5 text-background group-has-checked:block" aria-hidden="true" />
            </label>
          ))}
        </div>
        <FieldError id="color-error" message={errors.color} />
      </fieldset>

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

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  ) : null
}

/** Activar o desactivar y eliminar (con confirmación) */
export function ClassTypeActions({ classType }: { classType: ClassTypeRow }) {
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action()
      if (result.ok) toast.success(`${result.message}: ${classType.name}`)
      else toast.error(result.message)
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        disabled={pending}
        aria-label={`${classType.isActive ? "Desactivar" : "Activar"} ${classType.name}`}
        onClick={() => run(() => setClassTypeActiveAction(classType.id, !classType.isActive))}
      >
        {classType.isActive ? "Desactivar" : "Activar"}
      </Button>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" disabled={pending} aria-label={`Eliminar ${classType.name}`}>
            <Trash2 aria-hidden="true" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{`¿Eliminar ${classType.name}?`}</DialogTitle>
            <DialogDescription>
              Solo se puede eliminar si no se ha usado nunca en el horario ni en sesiones. Si ya se ha usado, desactívalo:
              dejará de ofrecerse y lo creado se conserva.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Volver</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="destructive" onClick={() => run(() => deleteClassTypeAction(classType.id))}>
                Eliminar
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
