/**
 * Datos del titular de la app y responsable del tratamiento (RGPD art. 13 y LSSI art. 10).
 * Se muestran en /privacidad, /aviso-legal y en la información básica del registro.
 *
 * PENDIENTE [T]: el gimnasio debe dar sus datos reales antes de abrir la app al gimnasio real (docs/ROADMAP.md, Fase 7).
 * Mientras `isLegalComplete` sea false, las páginas legales avisan de que son un borrador.
 */
export const LEGAL = {
  /** Razón social o nombre del titular (persona física o jurídica) */
  owner: "[Razón social del titular]",
  /** Nombre comercial */
  tradeName: "Athlos Centro Deportivo",
  /** NIF / CIF */
  taxId: "[NIF/CIF]",
  /** Domicilio postal completo */
  address: "[Dirección postal]",
  /** Correo para ejercer derechos y consultas de privacidad */
  privacyEmail: "[correo de privacidad]",
  /** Datos registrales (Registro Mercantil), si es una sociedad. Vacío si no aplica */
  registry: "",
  /** Delegado de Protección de Datos (no obligatorio para un gimnasio pequeño). Vacío si no hay */
  dpoEmail: "",
  /** Fecha de la última actualización de los textos legales */
  updatedAt: "7 de octubre de 2026",
} as const

/** true cuando no queda ningún dato entre corchetes por rellenar */
export const isLegalComplete = !Object.values(LEGAL).some((value) => value.startsWith("["))

/** Edad mínima para dar el consentimiento por sí mismo en España (LOPDGDD art. 7) */
export const MIN_AGE = 14
