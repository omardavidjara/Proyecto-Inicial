import { z } from "zod"

// Incidencias (SPEC F9). Los formularios envían texto: el cliente y la sesión llegan vacíos si no se asocian.

export const INCIDENT_PRIORITIES = ["low", "medium", "high"] as const
export type IncidentPriority = (typeof INCIDENT_PRIORITIES)[number]

export const INCIDENT_STATUSES = ["open", "in_progress", "closed"] as const
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]

export const PRIORITY_LABEL: Record<IncidentPriority, string> = { low: "Baja", medium: "Media", high: "Alta" }
export const STATUS_LABEL: Record<IncidentStatus, string> = { open: "Abierta", in_progress: "En curso", closed: "Cerrada" }

/** «Ver más» de la lista de incidencias (`?limite=`) */
export const INCIDENT_PAGE_SIZE = 20
export const INCIDENT_MAX_LIMIT = 500

export const TITLE_MAX = 100
export const DESCRIPTION_MAX = 2000

/** Título, descripción y prioridad: lo que se puede editar después */
export const incidentSchema = z.object({
  title: z.string("Escribe un título").trim().min(3, "Escribe un título").max(TITLE_MAX, "El título es demasiado largo"),
  description: z
    .string("Describe la incidencia")
    .trim()
    .min(1, "Describe la incidencia")
    .max(DESCRIPTION_MAX, `Como máximo, ${DESCRIPTION_MAX} caracteres`),
  priority: z.enum(INCIDENT_PRIORITIES, "Elige la prioridad"),
})

const optionalId = z.preprocess((value) => (value === "" || value == null ? null : value), z.uuid("Elige de la lista").nullable())

/** Al crearla, además, el cliente y la sesión asociados (opcionales) */
export const newIncidentSchema = incidentSchema.extend({ clientId: optionalId, sessionId: optionalId })

export type IncidentInput = z.output<typeof incidentSchema>
export type NewIncidentInput = z.output<typeof newIncidentSchema>
