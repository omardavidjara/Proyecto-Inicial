import type { Metadata } from "next"
import Link from "next/link"
import { LegalEmail } from "@/components/legal/legal-email"
import { LegalPage } from "@/components/legal/legal-page"
import { LEGAL } from "@/lib/legal"

export const metadata: Metadata = {
  title: "Aviso legal",
  description: "Titular de la app de Athlos y condiciones de uso.",
}

const LINK = "font-medium text-primary underline-offset-4 hover:underline"

// LSSI (Ley 34/2002) art. 10: datos del titular y condiciones de uso
export default function LegalNoticePage() {
  return (
    <LegalPage title="Aviso legal">
      <section aria-labelledby="titular">
        <h2 id="titular">1. Titular</h2>
        <p>En cumplimiento de la Ley 34/2002, de servicios de la sociedad de la información (LSSI), te informamos de que esta app pertenece a:</p>
        <ul>
          <li>Titular: {LEGAL.owner}</li>
          <li>Nombre comercial: {LEGAL.tradeName}</li>
          <li>NIF: {LEGAL.taxId}</li>
          <li>Dirección: {LEGAL.address}</li>
          <li>
            Correo electrónico: <LegalEmail />
          </li>
          {LEGAL.registry && <li>Datos registrales: {LEGAL.registry}</li>}
        </ul>
      </section>

      <section aria-labelledby="objeto">
        <h2 id="objeto">2. Objeto</h2>
        <p>
          La app sirve para que los socios de {LEGAL.tradeName} reserven, cambien y anulen sus clases, y para que el personal
          del gimnasio las organice. El uso de la app es gratuito; las tarifas del gimnasio se contratan y pagan fuera de ella.
        </p>
      </section>

      <section aria-labelledby="uso">
        <h2 id="uso">3. Condiciones de uso</h2>
        <ul>
          <li>Tu cuenta es personal: no compartas tu contraseña ni reserves en nombre de otra persona.</li>
          <li>Los datos que des deben ser reales y estar al día.</li>
          <li>
            Las reservas siguen las reglas del gimnasio que se muestran en la app (apertura, anulación y lista de espera).
          </li>
          <li>
            No está permitido usar la app para fines ilícitos, intentar acceder a datos de otras personas ni dañar su
            funcionamiento. El gimnasio puede suspender las cuentas que incumplan estas condiciones.
          </li>
        </ul>
      </section>

      <section aria-labelledby="responsabilidad">
        <h2 id="responsabilidad">4. Responsabilidad</h2>
        <p>
          Procuramos que la app esté disponible y sin errores, pero puede haber interrupciones por mantenimiento o causas
          técnicas ajenas. En caso de duda sobre una reserva, prevalece lo que confirme el personal del gimnasio. La app no
          sustituye el consejo médico: consulta a un profesional antes de empezar una actividad física si tienes alguna
          condición de salud.
        </p>
      </section>

      <section aria-labelledby="propiedad">
        <h2 id="propiedad">5. Propiedad intelectual</h2>
        <p>
          El nombre, el logotipo y los contenidos de la app pertenecen a su titular o se usan con permiso. No se pueden
          reproducir ni usar con fines comerciales sin autorización.
        </p>
      </section>

      <section aria-labelledby="datos">
        <h2 id="datos">6. Protección de datos</h2>
        <p>
          El tratamiento de tus datos personales se explica en la{" "}
          <Link href="/privacidad" className={LINK}>
            política de privacidad
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="ley">
        <h2 id="ley">7. Legislación aplicable</h2>
        <p>
          Estas condiciones se rigen por la ley española. Si eres consumidor, podrás acudir a los tribunales de tu domicilio.
        </p>
      </section>
    </LegalPage>
  )
}
