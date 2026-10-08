"use client"

// Error de una pantalla dentro del marco de la app (error.tsx de cada zona): la navegación sigue visible
// y se puede reintentar. Los errores que rompen el layout raíz los recoge app/global-error.tsx.
import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { TriangleAlert } from "lucide-react"

import { Page } from "@/components/app-shell/app-shell"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"

export type RouteErrorProps = { error: Error & { digest?: string }; retry: () => void }

export function RouteError({ error, retry, wide = false }: RouteErrorProps & { wide?: boolean }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <Page title="Algo ha fallado" wide={wide}>
      <EmptyState
        icon={<TriangleAlert />}
        title="No se ha podido cargar esta pantalla"
        description="Ya nos ha llegado el aviso. Prueba otra vez en unos segundos."
        action={<Button onClick={() => retry()}>Reintentar</Button>}
      />
    </Page>
  )
}
