"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { createIndividualSession, searchClientsForCoach } from "@/lib/dal"
import { individualSessionSchema, type IndividualSessionInput } from "@/lib/validation/schedule"

// Sesión individual del entrenador (SPEC F7). La DAL exige ser entrenador y pone al usuario como entrenador

export type IndividualSessionFormState = {
  error?: string
  fieldErrors?: Partial<Record<keyof IndividualSessionInput, string>>
}

export type CoachClientOption = { userId: string; fullName: string }

export async function searchCoachClientsAction(query: unknown): Promise<CoachClientOption[]> {
  return searchClientsForCoach(query)
}

const FIELD_ERRORS = {
  invalid_class_type: { classTypeId: "Elige un tipo de clase individual activo" },
  past: { startTime: "Elige un día y una hora que aún no hayan pasado" },
  client_not_active: { clientId: "Ese cliente ya no está activo" },
  no_plan: { clientId: "No tiene tarifa ese día" },
  no_classes_left: { clientId: "No le quedan clases en su tarifa" },
} as const

/** Crea la sesión con el cliente apuntado y abre su detalle */
export async function createIndividualSessionAction(
  _prev: IndividualSessionFormState,
  formData: FormData,
): Promise<IndividualSessionFormState> {
  const parsed = individualSessionSchema.safeParse({
    classTypeId: formData.get("classTypeId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    clientId: formData.get("clientId"),
  })
  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors as Partial<Record<keyof IndividualSessionInput, string[]>>
    return {
      fieldErrors: {
        classTypeId: errors.classTypeId?.[0],
        date: errors.date?.[0],
        startTime: errors.startTime?.[0],
        clientId: errors.clientId?.[0],
      },
    }
  }
  const result = await createIndividualSession(parsed.data)
  if (result.status === "created") redirect(`/entrenador/sesiones/${result.sessionId}`)
  if (result.status === "invalid_coach") return { error: "Tu cuenta ya no figura como entrenador activo" }
  return { fieldErrors: FIELD_ERRORS[result.status] }
}
