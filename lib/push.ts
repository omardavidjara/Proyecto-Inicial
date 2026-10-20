// Envío de Web Push con las claves VAPID (SPEC F10). Solo servidor: la clave privada nunca sale de aquí.
// Producción y previews tienen claves distintas: una preview (con la base de datos copiada de producción) no puede
// enviar avisos a los dispositivos reales, porque el servicio de push los rechaza al no coincidir la clave.
import "server-only"

import * as Sentry from "@sentry/nextjs"
import webpush from "web-push"

import type { PushSender } from "@/lib/data/push"

/** Clave pública VAPID para suscribirse en el navegador, o `null` si este entorno no tiene push */
export function pushPublicKey(): string | null {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  return VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT ? VAPID_PUBLIC_KEY : null
}

/** El aviso expira si el móvil no se conecta en 1 día: un recordatorio de clase de ayer ya no sirve */
const TTL_SECONDS = 24 * 60 * 60

export const webPushSender: PushSender = async (target, message) => {
  const publicKey = pushPublicKey()
  if (!publicKey) return "failed"
  try {
    await webpush.sendNotification(
      { endpoint: target.token, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(message),
      {
        TTL: TTL_SECONDS,
        urgency: "normal",
        vapidDetails: { subject: process.env.VAPID_SUBJECT!, publicKey, privateKey: process.env.VAPID_PRIVATE_KEY! },
      },
    )
    return "sent"
  } catch (error) {
    // 404/410: la suscripción ya no existe (el usuario quitó el permiso o desinstaló la app)
    if (error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410)) return "gone"
    Sentry.captureException(error)
    return "failed"
  }
}
