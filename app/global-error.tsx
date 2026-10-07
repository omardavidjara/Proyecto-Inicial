"use client"

// Último recurso ante un error que rompe el layout raíz: lo envía a Sentry y ofrece reintentar.
// Sustituye al layout, así que define su propio <html> y <body> y carga los estilos globales.
import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import "./globals.css"

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <title>Algo ha fallado · Athlos</title>
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pt-safe pb-safe text-center">
          <TriangleAlert className="size-10 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-xl font-semibold tracking-tight">Algo ha fallado</h1>
          <p className="max-w-xs text-muted-foreground">Ya nos ha llegado el aviso. Prueba otra vez en unos segundos.</p>
          <Button onClick={() => retry()}>Reintentar</Button>
        </main>
      </body>
    </html>
  )
}
