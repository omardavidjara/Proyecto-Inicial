"use client"

import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { FieldError } from "@/components/admin/schedule-slot-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type ClientOption = { userId: string; fullName: string }

// Buscador de un cliente por nombre (al menos 2 letras) en un formulario: sesión individual (F7) e incidencias (F9).
// `search` es una Server Action que ya limita a quién se puede elegir
export function ClientSearch({
  search,
  onPick,
  error,
  label = "Cliente",
  emptyText = "Ningún cliente con ese nombre",
}: {
  search: (query: string) => Promise<ClientOption[]>
  onPick: (client: ClientOption) => void
  error?: string
  label?: string
  emptyText?: string
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ClientOption[] | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    let stale = false
    const timer = setTimeout(async () => {
      const found = await search(q)
      if (!stale) setResults(found)
    }, 250)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [query, search])

  const shown = query.trim().length < 2 ? null : results

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="client-search">{label}</Label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="client-search"
          type="search"
          autoComplete="off"
          className="pl-9"
          placeholder="Escribe al menos 2 letras"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "clientId-error" : undefined}
        />
      </div>
      <FieldError id="clientId-error" message={error} />
      <div aria-live="polite">
        {shown && shown.length === 0 && <p className="py-3 text-center text-sm text-muted-foreground">{emptyText}</p>}
        {shown && shown.length > 0 && (
          <ul className="flex max-h-60 flex-col divide-y overflow-y-auto rounded-xl border">
            {shown.map((option) => (
              <li key={option.userId}>
                <button
                  type="button"
                  onClick={() => onPick(option)}
                  className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted"
                >
                  <ClientInitial name={option.fullName} />
                  <span className="flex-1 font-medium">{option.fullName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function ClientInitial({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
      {name.charAt(0).toUpperCase()}
    </span>
  )
}
