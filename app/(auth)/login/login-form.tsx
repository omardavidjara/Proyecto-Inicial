"use client"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/** PROTOTIPO: el inicio de sesión real con Neon Auth llega en la Fase 3 */
export function LoginForm() {
  function notYet() {
    toast.info("Prototipo: el inicio de sesión llegará en la Fase 3")
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          notYet()
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" size="lg" className="mt-2 w-full">
          Entrar
        </Button>
      </form>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="outline" size="lg" className="w-full" onClick={notYet}>
        <GoogleIcon />
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
