import Image from "next/image"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

// PROTOTIPO (Fase 2): índice de pantallas. En la Fase 3, "/" redirigirá según el rol (docs/ARCHITECTURE.md §5).
const SCREENS = [
  { href: "/login", title: "Inicio de sesión", description: "Común a todos los usuarios" },
  { href: "/calendario", title: "Calendario", description: "Cliente: elegir día y ver las sesiones" },
  { href: "/admin", title: "Hoy", description: "Administrador: sesiones del día y anulaciones tardías" },
  { href: "/offline", title: "Sin conexión", description: "Lo que se ve al abrir la app sin red" },
]

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="flex flex-col items-center gap-4 text-center">
        <Image src="/logo.png" alt="Athlos Centro Deportivo" width={112} height={112} priority />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Prototipo de Athlos</h1>
          <p className="text-muted-foreground">Pantallas clave con datos de ejemplo</p>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {SCREENS.map((screen) => (
          <li key={screen.href}>
            <Link
              href={screen.href}
              className="flex min-h-16 items-center gap-3 rounded-xl border bg-card px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex flex-1 flex-col">
                <span className="font-medium">{screen.title}</span>
                <span className="text-sm text-muted-foreground">{screen.description}</span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-center text-sm text-muted-foreground">
        El detalle de sesión se abre tocando una clase del calendario.
      </p>
    </main>
  )
}
