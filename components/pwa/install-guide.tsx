"use client"

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react"
import { CircleCheck, Download, EllipsisVertical, Share, SquarePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { detectInstallPlatform, type InstallPlatform } from "@/lib/install"
import { useStandalone } from "./use-standalone"

/** Evento de Chrome/Edge en Android (aún no está en los tipos de TypeScript) */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const noSubscribe = () => () => {}

function usePlatform(): InstallPlatform | undefined {
  return useSyncExternalStore(
    noSubscribe,
    () => detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints),
    () => undefined,
  )
}

/** Contenido de /instalar: botón «Instalar» si el navegador lo ofrece y, si no, los pasos de cada móvil */
export function InstallGuide() {
  const standalone = useStandalone()
  const platform = usePlatform()
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPrompt(null)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  if (standalone === undefined || platform === undefined) return null

  if (standalone || installed) {
    return (
      <Notice icon={<CircleCheck />} title="Ya tienes la app instalada">
        Ábrela desde el icono de Athlos en la pantalla de inicio de tu móvil.
      </Notice>
    )
  }

  async function install() {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === "accepted") setInstalled(true)
    setPrompt(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground">
        Instálala para abrirla desde un icono, a pantalla completa y sin buscarla en el navegador. No ocupa casi espacio ni
        hace falta ninguna tienda de aplicaciones.
      </p>

      {prompt && (
        <Button size="lg" className="w-full" onClick={install}>
          <Download data-icon="inline-start" aria-hidden="true" />
          Instalar
        </Button>
      )}

      {platform === "ios-other" && (
        <Notice title="Ábrela en Safari">
          En iPhone se instala mejor desde Safari: copia la dirección de esta página y pégala en Safari. Si tu navegador muestra
          «Añadir a pantalla de inicio» en el menú Compartir, también sirve.
        </Notice>
      )}

      {platform === "ios-safari" || platform === "ios-other" ? (
        <Steps
          title="En iPhone o iPad"
          steps={[
            <>
              Toca el botón <strong>Compartir</strong> <Share className="inline size-4 align-text-bottom" aria-hidden="true" /> en
              la barra de Safari.
            </>,
            <>
              Elige <strong>Añadir a pantalla de inicio</strong>{" "}
              <SquarePlus className="inline size-4 align-text-bottom" aria-hidden="true" /> (si no aparece, desliza la lista
              hacia abajo).
            </>,
            <>
              Toca <strong>Añadir</strong>. El icono de Athlos aparecerá en tu pantalla de inicio.
            </>,
          ]}
        />
      ) : (
        <Steps
          title={platform === "android" ? "En Android" : "En el móvil (Android)"}
          steps={[
            <>
              Abre el menú del navegador <EllipsisVertical className="inline size-4 align-text-bottom" aria-hidden="true" />{" "}
              (los tres puntos).
            </>,
            <>
              Toca <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.
            </>,
            <>Confirma. El icono de Athlos aparecerá con el resto de tus apps.</>,
          ]}
        />
      )}

      {(platform === "ios-safari" || platform === "ios-other") && (
        <p className="text-sm text-muted-foreground">
          Para recibir avisos del gimnasio en el iPhone (iOS 16.4 o posterior), la app tiene que estar instalada: los avisos se
          activan desde la app abierta con el icono.
        </p>
      )}
    </div>
  )
}

function Steps({ title, steps }: { title: string; steps: ReactNode[] }) {
  return (
    <section aria-labelledby="install-steps" className="flex flex-col gap-3">
      <h2 id="install-steps" className="text-lg font-semibold">
        {title}
      </h2>
      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Notice({ icon, title, children }: { icon?: ReactNode; title: string; children: ReactNode }) {
  return (
    <div role="status" className="flex gap-3 rounded-xl border bg-muted/50 px-4 py-3">
      {icon && <div className="text-primary [&_svg]:size-6" aria-hidden="true">{icon}</div>}
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}
