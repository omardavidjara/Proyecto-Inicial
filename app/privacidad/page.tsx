import type { Metadata } from "next"
import Link from "next/link"
import { LegalEmail } from "@/components/legal/legal-email"
import { LegalPage } from "@/components/legal/legal-page"
import { LEGAL, MIN_AGE } from "@/lib/legal"
import { INDEXABLE } from "@/lib/seo"

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Cómo trata Athlos tus datos personales y cómo ejercer tus derechos.",
  robots: INDEXABLE,
}

const MAIL = "font-medium text-primary underline-offset-4 hover:underline"

// RGPD arts. 12-14 y LOPDGDD. Pública: la exigen la App Store y Google Play (docs/SPEC.md §6)
export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad">
      <p>
        En esta política te explicamos qué datos personales tratamos cuando usas la app de {LEGAL.tradeName}, para qué, durante
        cuánto tiempo y qué derechos tienes. Se aplica el Reglamento General de Protección de Datos (RGPD, UE 2016/679) y la Ley
        Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD).
      </p>

      <section aria-labelledby="responsable">
        <h2 id="responsable">1. Responsable del tratamiento</h2>
        <ul>
          <li>Titular: {LEGAL.owner} ({LEGAL.tradeName})</li>
          <li>NIF: {LEGAL.taxId}</li>
          <li>Dirección: {LEGAL.address}</li>
          <li>
            Correo de contacto para privacidad: <LegalEmail />
          </li>
          {LEGAL.dpoEmail && <li>Delegado de Protección de Datos: {LEGAL.dpoEmail}</li>}
        </ul>
      </section>

      <section aria-labelledby="datos">
        <h2 id="datos">2. Qué datos tratamos</h2>
        <ul>
          <li>
            <strong>Datos de cuenta</strong>: correo electrónico y contraseña (guardada cifrada, nunca en claro). Si entras con
            Google, recibimos tu nombre, correo y foto de tu cuenta de Google.
          </li>
          <li>
            <strong>Perfil</strong>: nombre, teléfono y, si quieres, una foto.
          </li>
          <li>
            <strong>Actividad en el gimnasio</strong>: tarifa, reservas, anulaciones, lista de espera y asistencia a las clases.
          </li>
          <li>
            <strong>Incidencias</strong> que el personal del gimnasio pueda registrar relacionadas con tu cuenta o con una clase.
          </li>
          <li>
            <strong>Dispositivo</strong>: identificador para enviarte notificaciones, solo si las activas.
          </li>
          <li>
            <strong>Datos técnicos</strong>: registros de acceso y de errores necesarios para la seguridad y el funcionamiento.
          </li>
        </ul>
        <p>
          Los datos marcados como obligatorios en el registro son necesarios para darte de alta y gestionar tus reservas;
          sin ellos no podemos crear tu cuenta. La foto es opcional.
        </p>
        <p>
          No te pedimos datos de salud ni otras categorías especiales de datos. Por favor, no los incluyas en tu perfil.
        </p>
      </section>

      <section aria-labelledby="finalidades">
        <h2 id="finalidades">3. Para qué los usamos y con qué base legal</h2>
        <ul>
          <li>
            <strong>Gestionar tu cuenta, tu alta como socio, tus reservas y tu tarifa</strong>. Base: la relación contractual
            que tienes con el gimnasio (RGPD art. 6.1.b).
          </li>
          <li>
            <strong>Avisarte de cambios en tus clases</strong> (cancelaciones, plaza conseguida desde la lista de espera,
            recordatorios). Base: la relación contractual. Las notificaciones push solo se envían si das permiso en tu
            dispositivo, y puedes retirarlo cuando quieras.
          </li>
          <li>
            <strong>Mostrar tu foto de perfil</strong>. Base: tu consentimiento (art. 6.1.a), que retiras borrando la foto.
          </li>
          <li>
            <strong>Organizar el trabajo del personal</strong> (asistencia, incidencias, agenda) y{" "}
            <strong>mantener la seguridad de la app</strong>. Base: interés legítimo del gimnasio (art. 6.1.f).
          </li>
          <li>
            <strong>Si eres entrenador o administrador</strong>, tus datos se usan además para organizar tu trabajo en el
            gimnasio (clases que impartes, asistencia que registras). Base: tu relación laboral o de servicios con el
            gimnasio (art. 6.1.b).
          </li>
          <li>
            <strong>Cumplir obligaciones legales</strong> (por ejemplo, atender requerimientos de las autoridades). Base:
            obligación legal (art. 6.1.c).
          </li>
        </ul>
        <p>
          No usamos tus datos para publicidad, no elaboramos perfiles comerciales y no tomamos decisiones automatizadas con
          efectos jurídicos sobre ti. La asignación automática de plazas desde la lista de espera sigue solo el orden de
          llegada y las reglas de tu tarifa.
        </p>
      </section>

      <section aria-labelledby="conservacion">
        <h2 id="conservacion">4. Cuánto tiempo los guardamos</h2>
        <ul>
          <li>Mientras tengas una cuenta en la app.</li>
          <li>
            Si eliminas tu cuenta, se borra tu acceso y se anonimizan tus datos personales (nombre, teléfono y foto). El
            historial de reservas se conserva sin datos que te identifiquen, solo para estadísticas.
          </li>
          <li>
            Si el gimnasio te da de baja, tus datos se conservan para poder reactivarte, y puedes pedir su supresión en
            cualquier momento.
          </li>
          <li>
            Hacemos una copia de seguridad cifrada de la base de datos cada día. Cada copia se borra automáticamente a
            los 30 días, así que tus datos pueden seguir en ellas hasta 30 días después de eliminarlos, sin usarse para
            nada más que recuperar la app ante un fallo.
          </li>
          <li>
            Los registros técnicos se borran automáticamente: los de accesos en pocos días y los de errores (Sentry) a
            los 30 días.
          </li>
          <li>
            Los datos que deban guardarse por obligación legal se conservan bloqueados solo durante los plazos legales
            (LOPDGDD art. 32).
          </li>
        </ul>
      </section>

      <section aria-labelledby="destinatarios">
        <h2 id="destinatarios">5. Quién puede ver tus datos</h2>
        <p>
          Dentro del gimnasio, solo el personal que los necesita: los administradores ven los datos de los socios y los
          entrenadores ven la lista de asistentes de sus clases. Los demás socios nunca ven tus datos (en una clase solo
          ven cuántas plazas quedan).
        </p>
        <p>
          No cedemos tus datos a terceros salvo obligación legal. Para que la app funcione usamos proveedores que los
          tratan solo siguiendo nuestras instrucciones, como encargados del tratamiento (RGPD art. 28):
        </p>
        <ul>
          <li>Vercel Inc.: alojamiento de la app (servidores en Fráncfort, Alemania).</li>
          <li>Neon: base de datos e inicio de sesión (servidores en Fráncfort, Alemania).</li>
          <li>Cloudflare: copias de seguridad cifradas de la base de datos (servidores en la Unión Europea).</li>
          <li>Apple y Google: entrega de notificaciones push en la app móvil, si las activas.</li>
          <li>
            Functional Software Inc. (Sentry): registro de errores (servidores en Fráncfort, Alemania). Cuando la app
            falla recibe solo datos técnicos del fallo (pantalla, navegador y sistema operativo), nunca tu nombre,
            correo, dirección IP ni lo que escribes. No graba tu pantalla.
          </li>
        </ul>
        <p>
          Si eliges entrar con tu cuenta de Google, Google trata el inicio de sesión como responsable según su propia
          política de privacidad, y solo nos comunica tu nombre, correo y foto.
        </p>
      </section>

      <section aria-labelledby="transferencias">
        <h2 id="transferencias">6. Transferencias internacionales</h2>
        <p>
          Guardamos los datos en la Unión Europea. Algunos proveedores son empresas de Estados Unidos y podrían acceder a
          ellos de forma puntual (por ejemplo, para soporte técnico). En ese caso la transferencia se ampara en el Marco de
          Privacidad de Datos UE-EE. UU., cuando el proveedor está adherido, o en las cláusulas contractuales tipo aprobadas
          por la Comisión Europea (RGPD arts. 45 y 46).
        </p>
      </section>

      <section aria-labelledby="derechos">
        <h2 id="derechos">7. Tus derechos</h2>
        <p>Puedes ejercer en cualquier momento y de forma gratuita tus derechos de:</p>
        <ul>
          <li>Acceso: saber qué datos tuyos tratamos.</li>
          <li>Rectificación: corregirlos. Puedes editar tu perfil desde la propia app.</li>
          <li>
            Supresión: pedir que los borremos. Puedes <strong>eliminar tu cuenta desde tu perfil</strong>.
          </li>
          <li>Oposición y limitación del tratamiento.</li>
          <li>Portabilidad: recibir tus datos en un formato de uso común.</li>
          <li>Retirar tu consentimiento, sin que afecte a lo tratado antes.</li>
        </ul>
        <p>
          Escríbenos a <LegalEmail /> indicando qué derecho quieres ejercer. Te responderemos en el plazo de un mes. Si crees que no hemos tratado bien
          tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (
          <a href="https://www.aepd.es" className={MAIL} target="_blank" rel="noopener noreferrer">
            www.aepd.es
            <span className="sr-only"> (se abre en otra pestaña)</span>
          </a>
          ).
        </p>
      </section>

      <section aria-labelledby="menores">
        <h2 id="menores">8. Menores de edad</h2>
        <p>
          Los menores de {MIN_AGE} años solo pueden usar la app con el consentimiento de sus padres o tutores, que deberán
          hacer el registro o autorizarlo (LOPDGDD art. 7).
        </p>
      </section>

      <section aria-labelledby="cookies">
        <h2 id="cookies">9. Cookies y almacenamiento en tu dispositivo</h2>
        <p>
          La app solo usa cookies y almacenamiento <strong>técnicos</strong>, imprescindibles para funcionar, que no requieren
          consentimiento (Ley 34/2002, LSSI, art. 22.2):
        </p>
        <ul>
          <li>Cookie de sesión, para mantenerte conectado de forma segura.</li>
          <li>
            Caché de la app (service worker), para que cargue más rápido y para mostrar una página cuando no tienes conexión.
            Se vacía al cerrar sesión o eliminar la cuenta.
          </li>
        </ul>
        <p>No usamos cookies de análisis, publicidad ni seguimiento.</p>
      </section>

      <section aria-labelledby="seguridad">
        <h2 id="seguridad">10. Seguridad</h2>
        <p>
          Aplicamos medidas técnicas y organizativas para proteger tus datos: conexiones cifradas (HTTPS), contraseñas
          cifradas, acceso a la base de datos solo desde el servidor y permisos por rol para que cada persona vea solo lo que
          necesita. Si se produjera una brecha de seguridad que te afecte, te lo comunicaremos y lo notificaremos a la AEPD
          cuando lo exija la ley.
        </p>
      </section>

      <section aria-labelledby="cambios">
        <h2 id="cambios">11. Cambios en esta política</h2>
        <p>
          Si cambiamos esta política, actualizaremos la fecha de arriba y, si el cambio es importante, te avisaremos en la
          app. Consulta también el{" "}
          <Link href="/aviso-legal" className={MAIL}>
            aviso legal
          </Link>
          .
        </p>
      </section>
    </LegalPage>
  )
}
