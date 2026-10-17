import { z } from "zod"

// Suscripción de Web Push que envía el navegador (`PushSubscription.toJSON()`). El servidor hará un POST a esa
// dirección, así que solo se aceptan los servicios de push de los navegadores: nunca una URL cualquiera (SSRF).
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^web\.push\.apple\.com$/]

export function isPushServiceUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.port === "" && PUSH_HOSTS.some((host) => host.test(url.hostname))
  } catch {
    return false
  }
}

const endpoint = z.string().max(2048).refine(isPushServiceUrl, "Servicio de push no admitido")
const key = z.string().regex(/^[A-Za-z0-9_-]+=*$/).max(200)

export const pushSubscriptionSchema = z.object({
  endpoint,
  keys: z.object({ p256dh: key, auth: key }),
})

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>

export const pushEndpointSchema = endpoint
