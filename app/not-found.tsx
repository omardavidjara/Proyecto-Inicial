import Link from "next/link"
import { SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pt-safe pb-safe text-center">
      <SearchX className="size-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-xl font-semibold tracking-tight">Esta pantalla no existe</h1>
      <p className="max-w-xs text-muted-foreground">Puede que el enlace sea antiguo o que la pantalla aún no esté hecha.</p>
      <Button asChild>
        <Link href="/">Ir al inicio</Link>
      </Button>
    </main>
  )
}
