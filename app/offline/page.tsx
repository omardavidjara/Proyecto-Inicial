import type { Metadata } from "next"
import Image from "next/image"
import { WifiOff } from "lucide-react"
import { RetryButton } from "@/components/pwa/retry-button"

export const metadata: Metadata = { title: "Sin conexión" }

// La guarda el service worker y la muestra al navegar sin red (public/sw.js)
export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pt-safe pb-safe text-center">
      <Image src="/logo.png" alt="Athlos Centro Deportivo" width={112} height={112} priority />
      <div className="flex flex-col items-center gap-2">
        <WifiOff className="size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Sin conexión</h1>
        <p className="max-w-xs text-muted-foreground">
          Comprueba tu conexión a internet. Para reservar o anular clases necesitas estar conectado.
        </p>
      </div>
      <RetryButton />
    </main>
  )
}
