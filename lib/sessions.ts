// Presentación de sesiones (docs/DESIGN.md §2.2 y §2.3)

export const CLASS_COLORS = ["orange", "red", "amber", "green", "teal", "blue", "violet", "pink"] as const
export type ClassColor = (typeof CLASS_COLORS)[number]

/** Clases completas de Tailwind (no se pueden construir con plantillas: Tailwind no las detectaría) */
export const CLASS_COLOR_BG: Record<ClassColor, string> = {
  orange: "bg-class-orange",
  red: "bg-class-red",
  amber: "bg-class-amber",
  green: "bg-class-green",
  teal: "bg-class-teal",
  blue: "bg-class-blue",
  violet: "bg-class-violet",
  pink: "bg-class-pink",
}

/** Nombre de cada color para lectores de pantalla y el selector de tipos de clase */
export const CLASS_COLOR_LABEL: Record<ClassColor, string> = {
  orange: "Naranja",
  red: "Rojo",
  amber: "Ámbar",
  green: "Verde",
  teal: "Turquesa",
  blue: "Azul",
  violet: "Violeta",
  pink: "Rosa",
}

export type Availability = {
  kind: "free" | "few" | "full"
  remaining: number
  label: string
}

/** Plazas libres; "few" cuando quedan como mucho el 20 % del aforo */
export function availability(capacity: number, booked: number): Availability {
  const remaining = Math.max(0, capacity - booked)
  if (remaining === 0) return { kind: "full", remaining, label: "Completa" }
  const label = remaining === 1 ? "1 plaza" : `${remaining} plazas`
  const kind = remaining <= Math.floor(capacity * 0.2) ? "few" : "free"
  return { kind, remaining, label }
}
