import type { Metadata } from "next"
import Link from "next/link"
import { LegalLinks } from "@/components/legal/legal-links"
import { ConfirmEmailForm } from "./confirm-email-form"

export const metadata: Metadata = { title: "Confirma tu correo" }

// Tras registrarse con correo, o al intentar entrar sin haberlo confirmado (SPEC F1)
export default async function ConfirmEmailPage({ searchParams }: PageProps<"/confirmar-correo">) {
  const { correo } = await searchParams
  const email = typeof correo === "string" ? correo.slice(0, 254) : ""

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Confirma tu correo</h1>
        <p className="text-muted-foreground">
          Si el correo no tenía cuenta, te hemos enviado un código de 6 cifras. Escríbelo aquí. Si no lo ves, mira en
          la carpeta de spam.
        </p>
      </div>
      <ConfirmEmailForm email={email} />
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tenías cuenta?{" "}
        <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
          Inicia sesión
        </Link>
      </p>
      <LegalLinks />
    </main>
  )
}
