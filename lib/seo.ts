// Qué pueden indexar los buscadores (pendiente de la Fase 2): solo las páginas públicas que tiene sentido
// encontrar. El resto lleva `noindex` desde app/layout.tsx y `Disallow` en app/robots.ts, así que una pantalla
// nueva queda fuera de los buscadores salvo que se añada aquí y exporte `robots: INDEXABLE` en su metadata.
import type { Metadata } from "next"

import { LOGIN_PATH } from "@/lib/roles"

export const INDEXABLE_PATHS = [LOGIN_PATH, "/privacidad", "/aviso-legal"] as const

export const NOT_INDEXABLE = { index: false, follow: false } satisfies Metadata["robots"]
export const INDEXABLE = { index: true, follow: true } satisfies Metadata["robots"]
