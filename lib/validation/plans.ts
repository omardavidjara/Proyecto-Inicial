import { z } from "zod"

import { addDays, isDateKey } from "@/lib/dates"

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

/** Hasta cuándo se puede programar un cambio de tarifa */
export const CHANGE_MAX_DAYS = 366

/** Cambiar la tarifa de un cliente: «Sin tarifa» llega vacío; la fecha, de hoy a un año vista */
export function changePlanSchema(today: string) {
  const last = addDays(today, CHANGE_MAX_DAYS)
  return z.object({
    planId: z.union([z.literal("").transform(() => null), z.uuid("Elige una tarifa")], "Elige una tarifa"),
    startsOn: z
      .string("Elige la fecha")
      .refine(isDateKey, "Elige la fecha")
      .refine((day) => day >= today, "No puede ser anterior a hoy")
      .refine((day) => day <= last, "Como mucho, a un año vista"),
  })
}
