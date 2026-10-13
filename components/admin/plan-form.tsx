"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { deletePlanAction, savePlanAction, setPlanActiveAction, type PlanFormState } from "@/app/admin/tarifas/actions"
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
import type { PlanRow } from "@/lib/data/plans"
import { CLASSES_MAX, type PlanPeriod } from "@/lib/validation/plans"

const initialState: PlanFormState = {}

const PERIODS: { value: PlanPeriod; label: string; hint: string }[] = [
  { value: "week", label: "Semanal", hint: "De lunes a domingo" },
  { value: "month", label: "Mensual", hint: "Mes natural" },
  { value: "unlimited", label: "Ilimitada", hint: "Sin límite" },
]

/** Botón «Nueva tarifa» o «Editar» con el formulario en un diálogo. Se cierra al guardar */
export function PlanDialog({ plan }: { plan?: PlanRow }) {
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
        {plan ? (
          <Button variant="outline" aria-label={`Editar ${plan.name}`}>
            <Pencil data-icon="inline-start" aria-hidden="true" />
            Editar
          </Button>
        ) : (
          <Button>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Nueva tarifa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? "Editar tarifa" : "Nueva tarifa"}</DialogTitle>
          <DialogDescription>{description(plan)}</DialogDescription>
        </DialogHeader>
        <PlanForm key={formKey} plan={plan} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function description(plan?: PlanRow) {
  if (!plan) return "Limita cuántas clases puede reservar cada cliente que la tenga."
  if (plan.clients === 0) return "Ningún cliente la tiene ahora mismo."
  const who = plan.clients === 1 ? "el cliente que la tiene" : `los ${plan.clients} clientes que la tienen`
  return `El cambio se aplica a ${who} desde ahora. Las reservas ya hechas no cambian.`
}

function PlanForm({ plan, onSaved }: { plan?: PlanRow; onSaved: () => void }) {
  const [state, formAction, pending] = useActionState(savePlanAction, initialState)
  const [period, setPeriod] = useState<PlanPeriod>(plan?.period ?? "week")
  const errors = state.fieldErrors ?? {}

  useEffect(() => {
    if (state.saved) {
      toast.success(plan ? "Tarifa guardada" : "Tarifa creada")
      onSaved()
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state, plan, onSaved])

  const describedBy = (field: keyof typeof errors, hint?: string) =>
    [errors[field] ? `${field}-error` : null, hint].filter(Boolean).join(" ") || undefined

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {plan ? <input type="hidden" name="id" value={plan.id} /> : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={50}
          autoComplete="off"
          defaultValue={plan?.name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describedBy("name")}
        />
        <FieldError id="name-error" message={errors.name} />
      </div>

      <fieldset className="flex flex-col gap-2" aria-describedby={describedBy("period")}>
        <legend className="mb-2 text-sm font-medium">Límite</legend>
        <div className="grid grid-cols-3 gap-2">
          {PERIODS.map((p) => (
            <label
              key={p.value}
              className="flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-lg border p-3 has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <input
                type="radio"
                name="period"
                value={p.value}
                checked={period === p.value}
                onChange={() => setPeriod(p.value)}
                className="sr-only"
              />
              <span className="text-sm font-medium">{p.label}</span>
              <span className="text-xs text-muted-foreground">{p.hint}</span>
            </label>
          ))}
        </div>
        <FieldError id="period-error" message={errors.period} />
      </fieldset>

      {period === "unlimited" ? null : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="classesPerPeriod">{period === "week" ? "Clases por semana" : "Clases por mes"}</Label>
          <Input
            id="classesPerPeriod"
            name="classesPerPeriod"
            type="number"
            inputMode="numeric"
            min={1}
            max={CLASSES_MAX}
            required
            defaultValue={plan?.classesPerPeriod ?? (period === "week" ? 3 : 12)}
            aria-invalid={errors.classesPerPeriod ? true : undefined}
            aria-describedby={describedBy("classesPerPeriod")}
          />
          <FieldError id="classesPerPeriod-error" message={errors.classesPerPeriod} />
        </div>
      )}

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
export function PlanActions({ plan }: { plan: PlanRow }) {
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action()
      if (result.ok) toast.success(`${result.message}: ${plan.name}`)
      else toast.error(result.message)
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        disabled={pending}
        aria-label={`${plan.isActive ? "Desactivar" : "Activar"} ${plan.name}`}
        onClick={() => run(() => setPlanActiveAction(plan.id, !plan.isActive))}
      >
        {plan.isActive ? "Desactivar" : "Activar"}
      </Button>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" disabled={pending} aria-label={`Eliminar ${plan.name}`}>
            <Trash2 aria-hidden="true" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{`¿Eliminar ${plan.name}?`}</DialogTitle>
            <DialogDescription>
              Solo se puede eliminar si no se ha asignado nunca a ningún cliente. Si ya se ha asignado, desactívala: dejará
              de ofrecerse y se conserva el historial de quien la tuvo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Volver</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="destructive" onClick={() => run(() => deletePlanAction(plan.id))}>
                Eliminar
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
