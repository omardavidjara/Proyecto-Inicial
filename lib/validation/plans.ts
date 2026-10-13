import { z } from "zod"

// Tarifas (SPEC F4). Los formularios envían texto: los números se convierten aquí.

export const PLAN_PERIODS = ["week", "month", "unlimited"] as const
export type PlanPeriod = (typeof PLAN_PERIODS)[number]

export const CLASSES_MAX = 100

const classesSchema = z.coerce
  .number("Escribe el número de clases")
  .int("El número de clases debe ser entero")
  .min(1, "Como mínimo, 1 clase")
  .max(CLASSES_MAX, `Como máximo, ${CLASSES_MAX} clases`)

/** Una tarifa ilimitada no tiene cupo (lo exige también la base de datos): su campo se ignora */
export const planSchema = z
  .object({
    name: z.string("Escribe un nombre").trim().min(2, "Escribe un nombre").max(50, "El nombre es demasiado largo"),
    period: z.enum(PLAN_PERIODS, "Elige el tipo de tarifa"),
    classesPerPeriod: z.unknown(),
  })
  .transform((value, ctx) => {
    if (value.period === "unlimited") return { ...value, classesPerPeriod: null }
    const classes = classesSchema.safeParse(value.classesPerPeriod)
    if (!classes.success) {
      ctx.addIssue({ code: "custom", path: ["classesPerPeriod"], message: classes.error.issues[0].message })
      return z.NEVER
    }
    return { ...value, classesPerPeriod: classes.data }
  })

export type PlanInput = z.output<typeof planSchema>

/** «3 clases / semana», «8 clases / mes» o «Ilimitada» */
export function planLimitLabel(plan: { period: PlanPeriod; classesPerPeriod: number | null }) {
  if (plan.period === "unlimited" || plan.classesPerPeriod == null) return "Ilimitada"
  const classes = `${plan.classesPerPeriod} ${plan.classesPerPeriod === 1 ? "clase" : "clases"}`
  return `${classes} / ${plan.period === "week" ? "semana" : "mes"}`
}
