"use client"

import { useSyncExternalStore } from "react"
import { isStandaloneDisplay } from "@/lib/install"

const QUERY = "(display-mode: standalone)"

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {}
  const media = window.matchMedia(QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

/** `true` si se abre instalada; `undefined` en el servidor (aún no se sabe: no pintar nada) */
export function useStandalone(): boolean | undefined {
  return useSyncExternalStore<boolean | undefined>(
    subscribe,
    () => isStandaloneDisplay(window as Window & { navigator: { standalone?: boolean } }),
    () => undefined,
  )
}
