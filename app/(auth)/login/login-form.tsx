"use client"

import { useActionState } from "react"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GoogleButton } from "@/components/auth/google-button"
import { signInWithEmail, type SignInState } from "../actions"

const initialState: SignInState = {}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInWithEmail, initialState)
  const emailError = state.fieldErrors?.email
  const passwordError = state.fieldErrors?.password

  return (
    <div className="flex flex-col gap-6">
      {/* method="post": si se envía antes de cargar el JS, la contraseña nunca va en la URL */}
      <form method="post" action={formAction} className="flex flex-col gap-4" noValidate>
        {state.error ? (
          <p role="alert" className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            defaultValue={state.email}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "email-error" : undefined}
          />
          {emailError ? (
            <p id="email-error" className="text-sm text-destructive">
              {emailError}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? "password-error" : undefined}
          />
          {passwordError ? (
            <p id="password-error" className="text-sm text-destructive">
              {passwordError}
            </p>
          ) : null}
        </div>
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton />
    </div>
  )
}
