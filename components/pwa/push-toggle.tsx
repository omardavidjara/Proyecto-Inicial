"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Bell, BellOff, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { subscribePush, unsubscribePush } from "@/app/push-actions"
import { Button } from "@/components/ui/button"
import { base64UrlToBytes, detectPushSupport } from "@/lib/push-client"
import { isStandaloneDisplay } from "@/lib/install"

type State = "loading" | "unavailable" | "needs-install" | "denied" | "off" | "on"

const DESCRIPTION: Record<Exclude<State, "loading" | "needs-install">, string> = {
  unavailable: "Este navegador no puede recibir avisos.",
  denied: "Has bloqueado los avisos de Athlos. Puedes permitirlos en los ajustes del navegador o del móvil.",
  off: "Te avisamos de tus clases y de las novedades del gimnasio.",
  on: "Activados en este dispositivo.",
}

/** Registro del service worker (solo existe en el build de producción) */
async function registration() {
  return "serviceWorker" in navigator ? navigator.serviceWorker.getRegistration() : undefined
}

/**
 * Activar o desactivar los avisos push en este dispositivo (SPEC F10). En iPhone sin instalar, enlaza a /instalar.
 * Si el navegador ya estaba suscrito, vuelve a guardar la suscripción para la cuenta que tiene la sesión.
 */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("loading")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const set = (next: State) => !cancelled && setState(next)
    ;(async () => {
      const support = detectPushSupport(window, isStandaloneDisplay(window as Window & { navigator: { standalone?: boolean } }))
      if (support === "needs-install") return set("needs-install")
      const reg = support === "supported" && publicKey ? await registration() : undefined
      if (!reg) return set("unavailable")
      if (Notification.permission === "denied") return set("denied")
      const subscription = await reg.pushManager.getSubscription()
      if (!subscription) return set("off")
      const { ok } = await subscribePush(subscription.toJSON())
      set(ok ? "on" : "off")
    })().catch(() => set("unavailable"))
    return () => {
      cancelled = true
    }
  }, [publicKey])

  async function enable() {
    if (!publicKey) return
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off")
        return
      }
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) })
      const { ok } = await subscribePush(subscription.toJSON())
      if (!ok) {
        await subscription.unsubscribe()
        throw new Error("Suscripción rechazada")
      }
      setState("on")
      toast.success("Avisos activados")
    } catch {
      toast.error("No se han podido activar los avisos. Inténtalo de nuevo.")
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      const subscription = await (await registration())?.pushManager.getSubscription()
      if (subscription) {
        await unsubscribePush(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setState("off")
      toast.success("Avisos desactivados")
    } catch {
      toast.error("No se han podido desactivar los avisos. Inténtalo de nuevo.")
    } finally {
      setBusy(false)
    }
  }

  if (state === "loading") return null

  if (state === "needs-install") {
    return (
      <Link
        href="/instalar"
        className="flex min-h-11 items-center gap-3 rounded-xl border px-4 py-3 outline-none hover:bg-muted active:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="size-6 shrink-0 text-primary" aria-hidden="true" />
        <span className="flex flex-1 flex-col">
          <span className="font-medium">Avisos en el iPhone</span>
          <span className="text-sm text-muted-foreground">Llegan solo con la app instalada en la pantalla de inicio</span>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
      </Link>
    )
  }

  const Icon = state === "on" ? Bell : BellOff
  return (
    <section aria-labelledby="avisos-title" className="flex flex-col gap-3 rounded-xl border px-4 py-3">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
        <div className="flex flex-col">
          <h2 id="avisos-title" className="font-medium">
            Avisos en este dispositivo
          </h2>
          <p className="text-sm text-muted-foreground">{DESCRIPTION[state]}</p>
        </div>
      </div>
      {state === "off" && (
        <Button type="button" onClick={enable} disabled={busy}>
          Activar avisos
        </Button>
      )}
      {state === "on" && (
        <Button type="button" variant="outline" onClick={disable} disabled={busy}>
          Desactivar avisos
        </Button>
      )}
    </section>
  )
}
