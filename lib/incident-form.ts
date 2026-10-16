import { z } from "zod"

import { incidentSchema, newIncidentSchema } from "@/lib/validation/incidents"

// Lectura de los formularios de incidencias (SPEC F9), compartida por las acciones de administración y del entrenador

export type IncidentFormState = {
  saved?: boolean
  error?: string
  fieldErrors?: { title?: string; description?: string; priority?: string; clientId?: string }
}

function fieldsOf(formData: FormData) {
  return { title: formData.get("title"), description: formData.get("description"), priority: formData.get("priority") }
}

/** Editar: título, descripción y prioridad */
export function parseIncidentEdit(formData: FormData) {
  return incidentSchema.safeParse(fieldsOf(formData))
}

/** Crear: además, el cliente y la sesión (vacíos si no se asocian) */
export function parseNewIncident(formData: FormData) {
  return newIncidentSchema.safeParse({ ...fieldsOf(formData), clientId: formData.get("clientId"), sessionId: formData.get("sessionId") })
}

export function incidentFieldErrors(error: z.ZodError): IncidentFormState["fieldErrors"] {
  const fields = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>
  return { title: fields.title?.[0], description: fields.description?.[0], priority: fields.priority?.[0], clientId: fields.clientId?.[0] }
}

export const CLIENT_GONE = "Ese cliente ya no existe. Elige otro."
export const SESSION_GONE = "Esa sesión ya no existe. Recarga la página."
