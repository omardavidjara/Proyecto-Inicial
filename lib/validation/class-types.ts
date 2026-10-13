import { z } from "zod"

import { CLASS_COLORS } from "@/lib/sessions"

// Tipos de clase (SPEC F2). Los formularios envían texto: los números se convierten aquí.

export const CLASS_KINDS = ["group", "individual"] as const
export type ClassKind = (typeof CLASS_KINDS)[number]

export const DURATION_MIN = 5
export const DURATION_MAX = 480
export const CAPACITY_MAX = 200

const capacitySchema = z.coerce
  .number("Escribe el aforo")
  .int("El aforo debe ser un número entero")
  .min(1, "El aforo mínimo es 1")
  .max(CAPACITY_MAX, `El aforo máximo es ${CAPACITY_MAX}`)

/** Una clase individual siempre tiene aforo 1 (lo exige también la base de datos): su campo se ignora */
export const classTypeSchema = z
  .object({
    name: z.string("Escribe un nombre").trim().min(2, "Escribe un nombre").max(50, "El nombre es demasiado largo"),
    kind: z.enum(CLASS_KINDS, "Elige la modalidad"),
    durationMinutes: z.coerce
      .number("Escribe la duración")
      .int("La duración debe ser un número entero de minutos")
      .min(DURATION_MIN, `La duración mínima es de ${DURATION_MIN} minutos`)
      .max(DURATION_MAX, `La duración máxima es de ${DURATION_MAX} minutos`),
    defaultCapacity: z.unknown(),
    color: z.enum(CLASS_COLORS, "Elige un color"),
  })
  .transform((value, ctx) => {
    if (value.kind === "individual") return { ...value, defaultCapacity: 1 }
    const capacity = capacitySchema.safeParse(value.defaultCapacity)
    if (!capacity.success) {
      ctx.addIssue({ code: "custom", path: ["defaultCapacity"], message: capacity.error.issues[0].message })
      return z.NEVER
    }
    return { ...value, defaultCapacity: capacity.data }
  })

export type ClassTypeInput = z.output<typeof classTypeSchema>
