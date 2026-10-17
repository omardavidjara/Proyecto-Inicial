"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Campo oculto del formulario «Cerrar sesión»: envía la dirección de push de este navegador para que el servidor
 * quite el dispositivo, y al enviar también anula la suscripción aquí. Quien entre después en el mismo móvil
 * tendrá que activar sus propios avisos (F10). Sin JavaScript no hay suscripción, así que no hace falta.
 */
export function PushEndpointField() {
  const ref = useRef<HTMLInputElement>(null)
  const [endpoint, setEndpoint] = useState("")

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    let subscription: PushSubscription | null = null
    const form = ref.current?.form
    const onSubmit = () => void subscription?.unsubscribe().catch(() => {})
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => {
        subscription = sub ?? null
        if (sub) setEndpoint(sub.endpoint)
      })
      .catch(() => {})
    form?.addEventListener("submit", onSubmit)
    return () => form?.removeEventListener("submit", onSubmit)
  }, [])

  return <input ref={ref} type="hidden" name="pushEndpoint" value={endpoint} />
}
