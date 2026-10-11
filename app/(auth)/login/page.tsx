import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { LegalLinks } from "@/components/legal/legal-links"
import { getSessionUser } from "@/lib/dal"
import { INDEXABLE } from "@/lib/seo"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Iniciar sesión", robots: INDEXABLE }

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Con la sesión ya iniciada, "/" lleva a su inicio
  if (await getSessionUser()) redirect("/")
  const { cuenta } = await searchParams

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="flex flex-col items-center gap-4 text-center">
        <Image src="/logo.png" alt="Athlos Centro Deportivo" width={144} height={144} priority />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Inicia sesión</h1>
          <p className="text-muted-foreground">Reserva tus clases en Athlos</p>
        </div>
      </div>
      {cuenta === "eliminada" ? (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-center text-sm">
          Tu cuenta se ha eliminado. Gracias por haber entrenado con nosotros.
        </p>
      ) : null}
      <LoginForm />
      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
          Regístrate
        </Link>
      </p>
      <LegalLinks />
    </main>
  )
}
