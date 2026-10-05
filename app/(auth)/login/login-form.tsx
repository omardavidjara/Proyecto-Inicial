"use client"

import { useActionState, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"
import { signInWithEmail, type SignInState } from "../actions"

const initialState: SignInState = {}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInWithEmail, initialState)
  const [googlePending, setGooglePending] = useState(false)

  async function signInWithGoogle() {
    setGooglePending(true)
    // Vuelve a "/", que lleva a cada usuario a su inicio (o a /pendiente si aún no está aprobado)
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: "/" })
    if (error) {
      setGooglePending(false)
      toast.error("No se ha podido abrir el inicio de sesión con Google. Inténtalo de nuevo.")
    }
  }

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
      <Button variant="outline" size="lg" className="w-full" onClick={signInWithGoogle} disabled={googlePending}>
        {googlePending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <GoogleIcon />}
        Continuar con Google
      </Button>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" data-icon="inline-start" className="size-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  )
}
