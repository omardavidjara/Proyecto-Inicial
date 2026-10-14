import type { Metadata } from "next"
import { Page } from "@/components/app-shell/app-shell"
import { LateCancellations } from "@/components/admin/late-cancellations"
import { lateCancellationItem } from "@/lib/agenda"
import { LATE_CANCELLATIONS_LIMIT } from "@/lib/data/agenda"
import { listLateCancellationsForAdmin } from "@/lib/dal"
import { toDateKey } from "@/lib/dates"

export const metadata: Metadata = { title: "Anulaciones tardías" }

// SPEC F6: anulaciones con menos antelación de la permitida. Hasta que se decide, la clase no se descuenta
export default async function AnulacionesPage() {
  const rows = await listLateCancellationsForAdmin()
  const today = toDateKey(new Date())

  return (
    <Page title="Anulaciones tardías" backHref="/admin" wide>
      <p className="-mt-2 text-muted-foreground">
        Decide si cada anulación tardía descuenta la clase de la tarifa del cliente. Mientras no lo decidas, no se
        descuenta.
      </p>
      <LateCancellations items={rows.map((row) => lateCancellationItem(row, today))} />
      {rows.length === LATE_CANCELLATIONS_LIMIT && (
        <p className="text-sm text-muted-foreground">
          Se muestran las {LATE_CANCELLATIONS_LIMIT} más antiguas. Al decidirlas aparecerán las siguientes.
        </p>
      )}
    </Page>
  )
}
