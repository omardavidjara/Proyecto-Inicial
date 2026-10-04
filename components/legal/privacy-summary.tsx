import Link from "next/link"
import { LEGAL } from "@/lib/legal"

/**
 * Información básica sobre protección de datos (primera capa, LOPDGDD art. 11).
 * Debe verse en el formulario de registro, antes de enviar los datos.
 */
export function PrivacySummary() {
  return (
    <section aria-labelledby="privacy-summary" className="flex flex-col gap-2 rounded-lg bg-muted px-3 py-3 text-sm text-muted-foreground">
      <h2 id="privacy-summary" className="font-medium text-foreground">
        Información básica sobre protección de datos
      </h2>
      <dl className="flex flex-col gap-1">
        <div>
          <dt className="inline font-medium text-foreground">Responsable: </dt>
          <dd className="inline">{LEGAL.owner} ({LEGAL.tradeName}).</dd>
        </div>
        <div>
          <dt className="inline font-medium text-foreground">Finalidad: </dt>
          <dd className="inline">gestionar tu cuenta, tus reservas y los avisos del gimnasio.</dd>
        </div>
        <div>
          <dt className="inline font-medium text-foreground">Legitimación: </dt>
          <dd className="inline">la relación que tienes con el gimnasio como socio.</dd>
        </div>
        <div>
          <dt className="inline font-medium text-foreground">Destinatarios: </dt>
          <dd className="inline">no se ceden a terceros; los proveedores técnicos los tratan solo por encargo.</dd>
        </div>
        <div>
          <dt className="inline font-medium text-foreground">Derechos: </dt>
          <dd className="inline">acceso, rectificación, supresión, oposición, limitación y portabilidad.</dd>
        </div>
      </dl>
      <p>
        Más información en la{" "}
        <Link href="/privacidad" className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
          política de privacidad
        </Link>
        .
      </p>
    </section>
  )
}
