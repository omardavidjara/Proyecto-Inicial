"use client"

import { useActionState, useEffect } from "react"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import { completeProfile, updateProfile, type ProfileState } from "@/app/(cuenta)/perfil/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: ProfileState = {}

export function ProfileForm({
  fullName,
  phone,
  email,
  firstEntry = false,
}: {
  fullName: string
  phone: string | null
  email: string
  /** /completar-perfil: al guardar sigue a la pantalla que toque */
  firstEntry?: boolean
}) {
  const [state, formAction, pending] = useActionState(firstEntry ? completeProfile : updateProfile, initialState)
  const errors = state.fieldErrors ?? {}

  useEffect(() => {
    if (state.saved) toast.success("Perfil guardado")
  }, [state])

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName">Nombre y apellidos</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          defaultValue={fullName}
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={errors.fullName ? "fullName-error" : undefined}
        />
        {errors.fullName ? (
          <p id="fullName-error" className="text-sm text-destructive">
            {errors.fullName}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Teléfono</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          required
          defaultValue={phone ?? ""}
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={errors.phone ? "phone-error" : undefined}
        />
        {errors.phone ? (
          <p id="phone-error" className="text-sm text-destructive">
            {errors.phone}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input id="email" type="email" value={email} readOnly disabled aria-describedby="email-hint" />
        <p id="email-hint" className="text-sm text-muted-foreground">
          Es el de tu cuenta. Para cambiarlo, habla con recepción.
        </p>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
        {pending ? "Guardando…" : firstEntry ? "Continuar" : "Guardar cambios"}
      </Button>
    </form>
  )
}
