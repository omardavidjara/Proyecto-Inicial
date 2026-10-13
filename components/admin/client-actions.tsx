"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { Loader2, Tags } from "lucide-react"
import { toast } from "sonner"
import { changeClientPlanAction, decideClientAction, type ChangePlanFormState } from "@/app/admin/clientes/actions"
import { SELECT } from "@/components/admin/schedule-slot-form"
import { Badge } from "@/components/ui/badge"
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
import { addDays, formatDateShort } from "@/lib/dates"
import type { MembershipRow } from "@/lib/data/memberships"
import type { ProfileStatus } from "@/lib/roles"
import { CHANGE_MAX_DAYS, planLimitLabel, type PlanPeriod } from "@/lib/validation/plans"

type Decision = "approve" | "reject" | "deactivate" | "reactivate"

export type PlanOption = { id: string; name: string; period: PlanPeriod; classesPerPeriod: number | null }

type Props = {
  userId: string
  name: string
  status: ProfileStatus
  /** Tarifas activas para elegir */
  plans: PlanOption[]
  /** Historial de tarifas (solo clientes activos) */
  history?: MembershipRow[]
  today: string
}

/** Botones de cada cliente según su estado. Rechazar y dar de baja piden confirmación; aprobar y reactivar, tarifa */
export function ClientActions({ userId, name, status, plans, history = [], today }: Props) {
  const [pending, startTransition] = useTransition()

  function run(decision: Decision, planId: string | null = null) {
    startTransition(async () => {
      const result = await decideClientAction(decision, userId, planId)
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
        <ActivateDialog
          title={`Aprobar el alta de ${name}`}
          confirm="Aprobar"
          plans={plans}
          onConfirm={(planId) => run("approve", planId)}
        >
          <Button disabled={pending}>
            {spinner}
            Aprobar
          </Button>
        </ActivateDialog>
      </div>
    )
  }
  if (status === "active") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <ChangePlanDialog userId={userId} name={name} plans={plans} history={history} today={today} />
        <Confirm
          title={`¿Dar de baja a ${name}?`}
          description="No podrá reservar, su tarifa termina hoy y se anularán sus reservas futuras, sin descontar. Sus datos y su historial se conservan y podrás reactivarlo."
          confirm="Dar de baja"
          onConfirm={() => run("deactivate")}
        >
          <Button variant="destructive" disabled={pending}>
            {spinner}
            Dar de baja
          </Button>
        </Confirm>
      </div>
    )
  }
  return (
    <ActivateDialog title={`Reactivar a ${name}`} confirm="Reactivar" plans={plans} onConfirm={(planId) => run("reactivate", planId)}>
      <Button variant="outline" disabled={pending}>
        {spinner}
        Reactivar
      </Button>
    </ActivateDialog>
  )
}

/** Desplegable de tarifas con «Sin tarifa» (valor vacío) */
function PlanSelect({ id, plans, value, onChange, invalid, describedBy }: {
  id: string
  plans: PlanOption[]
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  describedBy?: string
}) {
  return (
    <select
      id={id}
      name="planId"
      className={SELECT}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
    >
      <option value="">Sin tarifa</option>
      {plans.map((plan) => (
        <option key={plan.id} value={plan.id}>
          {`${plan.name} · ${planLimitLabel(plan)}`}
        </option>
      ))}
    </select>
  )
}

/** Aprobar o reactivar eligiendo la tarifa (opcional), que empieza hoy */
function ActivateDialog({ title, confirm, plans, onConfirm, children }: {
  title: string
  confirm: string
  plans: PlanOption[]
  onConfirm: (planId: string | null) => void
  children: React.ReactNode
}) {
  const [planId, setPlanId] = useState("")

  return (
    <Dialog onOpenChange={(open) => open && setPlanId("")}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {plans.length === 0
              ? "Aún no hay tarifas activas. Podrás asignarle una después desde «Tarifa»."
              : "La tarifa empieza hoy y limita sus reservas. Si aún no la sabes, podrás asignarla después."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="activate-plan">Tarifa</Label>
          <PlanSelect id="activate-plan" plans={plans} value={planId} onChange={setPlanId} />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Volver</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={() => onConfirm(planId || null)}>{confirm}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const initialState: ChangePlanFormState = {}

/** Cambiar o quitar la tarifa desde hoy o una fecha futura, con el historial debajo */
function ChangePlanDialog({ userId, name, plans, history, today }: {
  userId: string
  name: string
  plans: PlanOption[]
  history: MembershipRow[]
  today: string
}) {
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
        <Button variant="outline" aria-label={`Tarifa de ${name}`}>
          <Tags data-icon="inline-start" aria-hidden="true" />
          Tarifa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{`Tarifa de ${name}`}</DialogTitle>
          <DialogDescription>
            La nueva tarifa sustituye a la actual desde la fecha que elijas y a cualquier cambio ya programado.
          </DialogDescription>
        </DialogHeader>
        <ChangePlanForm key={formKey} userId={userId} plans={plans} today={today} onSaved={() => setOpen(false)} />
        <PlanHistory history={history} today={today} />
      </DialogContent>
    </Dialog>
  )
}

function ChangePlanForm({ userId, plans, today, onSaved }: {
  userId: string
  plans: PlanOption[]
  today: string
  onSaved: () => void
}) {
  const [state, formAction, pending] = useActionState(changeClientPlanAction, initialState)
  const [planId, setPlanId] = useState(plans[0]?.id ?? "")
  const errors = state.fieldErrors ?? {}

  useEffect(() => {
    if (state.saved) {
      toast.success("Tarifa guardada")
      onSaved()
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state, onSaved])

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="change-plan">Nueva tarifa</Label>
        <PlanSelect
          id="change-plan"
          plans={plans}
          value={planId}
          onChange={setPlanId}
          invalid={Boolean(errors.planId)}
          describedBy={errors.planId ? "planId-error" : undefined}
        />
        <FieldError id="planId-error" message={errors.planId} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="startsOn">Desde</Label>
        <Input
          id="startsOn"
          name="startsOn"
          type="date"
          min={today}
          max={addDays(today, CHANGE_MAX_DAYS)}
          required
          defaultValue={today}
          aria-invalid={errors.startsOn ? true : undefined}
          aria-describedby={errors.startsOn ? "startsOn-error" : undefined}
        />
        <FieldError id="startsOn-error" message={errors.startsOn} />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" /> : null}
          {pending ? "Guardando…" : planId ? "Guardar" : "Quitar tarifa"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function PlanHistory({ history, today }: { history: MembershipRow[]; today: string }) {
  return (
    <section aria-labelledby="plan-history" className="flex flex-col gap-2 border-t pt-4">
      <h3 id="plan-history" className="text-sm font-medium">
        Historial
      </h3>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nunca ha tenido tarifa.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {history.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-2 text-sm">
              <span className="flex flex-col">
                <span className="font-medium">{m.planName}</span>
                <span className="text-muted-foreground">
                  {m.endsOn ? `${formatDateShort(m.startsOn)} – ${formatDateShort(m.endsOn)}` : `Desde el ${formatDateShort(m.startsOn)}`}
                </span>
              </span>
              <MembershipBadge membership={m} today={today} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function MembershipBadge({ membership, today }: { membership: MembershipRow; today: string }) {
  if (membership.startsOn > today) return <Badge variant="outline">Programada</Badge>
  if (membership.endsOn == null || membership.endsOn >= today) return <Badge>Vigente</Badge>
  return null
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  ) : null
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
