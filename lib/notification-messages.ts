// Textos de las notificaciones push (SPEC F10). Cortos: el móvil corta el título a unos 40 caracteres.
// Nunca datos de otras personas: cada aviso solo habla de quien lo recibe.
import type { PushMessage } from "@/lib/data/push"
import type { Role } from "@/lib/roles"

/** Alta aprobada: ya puede reservar */
export function accountApprovedMessage(): PushMessage {
  return {
    title: "Ya puedes reservar",
    body: "El gimnasio ha aprobado tu cuenta. Entra y reserva tu primera clase.",
    url: "/calendario",
  }
}

/** Aviso general. Quien solo es entrenador no entra en la zona de cliente: lo lee en la suya */
export function announcementMessage({ title, body }: { title: string; body: string }, role: Role): PushMessage {
  return { title, body, url: role === "coach" ? "/entrenador/avisos" : "/avisos" }
}
