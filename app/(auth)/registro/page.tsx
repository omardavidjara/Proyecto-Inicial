import type { Metadata } from "next"
import Link from "next/link"
import { LegalLinks } from "@/components/legal/legal-links"
import { RegisterForm } from "./register-form"

export const metadata: Metadata = { title: "Registro" }

// SPEC F1: correo y contraseña o Google; la cuenta queda pendiente de que el gimnasio la apruebe
export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Crear cuenta</h1>
        <p className="text-muted-foreground">El gimnasio revisará tu alta antes de que puedas reservar</p>
      </div>
      <RegisterForm />
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
          Inicia sesión
        </Link>
      </p>
      <LegalLinks />
    </main>
  )
}
