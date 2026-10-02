"use client"

import { useEffect } from "react"

/** Registra /sw.js solo en producción: en desarrollo interferiría con la recarga en caliente. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => console.error("No se pudo registrar el service worker", error))
  }, [])

  return null
}
