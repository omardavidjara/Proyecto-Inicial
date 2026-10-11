"use client"

import { useActionState } from "react"
import { LoaderCircle } from "lucide-react"
import { GoogleButton } from "@/components/auth/google-button"
import { PrivacySummary } from "@/components/legal/privacy-summary"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MIN_AGE } from "@/lib/legal"
import { PASSWORD_MIN } from "@/lib/validation/auth"
import { signUpWithEmail, type SignUpState } from "../actions"

const initialState: SignUpState = {}

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(signUpWithEmail, initialState)
  const errors = state.fieldErrors ?? {}
  return (
    <div className="flex flex-col gap-6">
      {/* method="post": si se envía antes de cargar el JS, la contraseña nunca va en la URL */}
      <form method="post" action={formAction} className="flex flex-col gap-4" noValidate>
        {state.error ? (
          <p role="alert" className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        <Field id="fullName" label="Nombre y apellidos" error={errors.fullName}>
          <Input id="fullName" name="fullName" autoComplete="name" required defaultValue={state.values?.fullName} {...invalid("fullName", errors.fullName)} />
        </Field>
        <Field id="email" label="Correo electrónico" error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.values?.email} {...invalid("email", errors.email)} />
        </Field>
        <Field id="phone" label="Teléfono" error={errors.phone}>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" required defaultValue={state.values?.phone} {...invalid("phone", errors.phone)} />
        </Field>
        <Field id="password" label="Contraseña" hint={`Al menos ${PASSWORD_MIN} caracteres`} error={errors.password}>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} {...invalid("password", errors.password, "password-hint")} />
        </Field>
        <div className="flex flex-col gap-2">
          <label htmlFor="minAge" className="flex min-h-11 items-start gap-3 text-sm">
            <input
              id="minAge"
              name="minAge"
              type="checkbox"
              required
              className="mt-0.5 size-5 shrink-0 accent-primary"
              {...invalid("minAge", errors.minAge)}
            />
            <span>
              Tengo {MIN_AGE} años o más. Si eres menor, el registro debe hacerlo tu padre, madre o tutor.
            </span>
          </label>
          {errors.minAge ? (
            <p id="minAge-error" className="text-sm text-destructive">
              {errors.minAge}
            </p>
          ) : null}
        </div>
        <PrivacySummary />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
          {pending ? "Creando la cuenta…" : "Crear cuenta"}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton />
    </div>
  )
}

/** aria-invalid y aria-describedby de un campo según su error (y su pista, si la tiene) */
function invalid(id: string, error?: string, hintId?: string) {
  const describedBy = [error ? `${id}-error` : null, hintId].filter(Boolean).join(" ")
  return { "aria-invalid": error ? true : undefined, "aria-describedby": describedBy || undefined }
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
