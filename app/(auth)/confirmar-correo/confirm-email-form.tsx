"use client"

import { useActionState } from "react"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resendEmailCode, verifyEmailCode, type VerifyEmailState } from "../actions"

const initialState: VerifyEmailState = {}

export function ConfirmEmailForm({ email }: { email: string }) {
  const [state, verifyAction, verifying] = useActionState(verifyEmailCode, initialState)
  const [resendState, resendAction, resending] = useActionState(resendEmailCode, initialState)
  const emailError = state.fieldErrors?.email ?? resendState.fieldErrors?.email
  const otpError = state.fieldErrors?.otp
  const message = state.error ?? resendState.error

  return (
    <form method="post" action={verifyAction} className="flex flex-col gap-4" noValidate>
      {message ? (
        <p role="alert" className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
          {message}
        </p>
      ) : null}
      {resendState.notice && !message ? (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
          {resendState.notice}
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
          defaultValue={email}
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
        <Label htmlFor="otp">Código de 6 cifras</Label>
        <Input
          id="otp"
          name="otp"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          className="text-center text-lg tracking-[0.5em] tabular-nums"
          aria-invalid={otpError ? true : undefined}
          aria-describedby={otpError ? "otp-error" : undefined}
        />
        {otpError ? (
          <p id="otp-error" className="text-sm text-destructive">
            {otpError}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" className="mt-2 w-full" disabled={verifying}>
        {verifying ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
        {verifying ? "Comprobando…" : "Confirmar correo"}
      </Button>
      {/* Mismo formulario (usa el correo escrito arriba), otra acción */}
      <Button type="submit" formAction={resendAction} formNoValidate variant="ghost" size="lg" className="w-full" disabled={resending}>
        {resending ? "Enviando…" : "Enviar otro código"}
      </Button>
    </form>
  )
}
