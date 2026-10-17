// Ayudas de Web Push en el navegador (SPEC F10). Funciones puras: se prueban sin navegador.
import { detectInstallPlatform } from "@/lib/install"

export type PushSupport = "supported" | "needs-install" | "unsupported"

type PushWindow = {
  navigator: { userAgent: string; maxTouchPoints?: number; serviceWorker?: unknown }
  PushManager?: unknown
  Notification?: unknown
}

/**
 * Si este navegador puede recibir avisos. En iPhone solo con la app abierta desde la pantalla de inicio
 * (iOS 16.4+): en Safari no existe `PushManager`, así que se le lleva a /instalar.
 */
export function detectPushSupport(win: PushWindow, standalone: boolean): PushSupport {
  const platform = detectInstallPlatform(win.navigator.userAgent, win.navigator.maxTouchPoints ?? 0)
  const isIos = platform === "ios-safari" || platform === "ios-other"
  if (isIos && !standalone) return "needs-install"
  return win.navigator.serviceWorker && win.PushManager && win.Notification ? "supported" : "unsupported"
}

/** La clave pública VAPID viene en base64url; `pushManager.subscribe` la quiere en bytes */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}
