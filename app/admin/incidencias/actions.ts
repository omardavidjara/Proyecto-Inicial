"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import {
  createIncidentForAdmin,
  searchClientsForIncident,
  setIncidentStatusForAdmin,
  updateIncidentForAdmin,
} from "@/lib/dal"
import { INCIDENT_STATUSES, incidentSchema, newIncidentSchema, STATUS_LABEL } from "@/lib/validation/incidents"

// Incidencias (SPEC F9). La DAL exige el rol de administración y valida los ids

export type IncidentFormState = {
  saved?: boolean
  error?: string
  fieldErrors?: { title?: string; description?: string; priority?: string; clientId?: string }
}

const NOT_FOUND = "Esa incidencia ya no existe. Recarga la página."

function fieldsOf(formData: FormData) {
  return { title: formData.get("title"), description: formData.get("description"), priority: formData.get("priority") }
}

/** Crear (con cliente o sesión opcionales) o editar (con el campo oculto `id`: título, descripción y prioridad) */
export async function saveIncidentAction(_prev: IncidentFormState, formData: FormData): Promise<IncidentFormState> {
  const id = formData.get("id")
  if (id) {
    const parsed = incidentSchema.safeParse(fieldsOf(formData))
    if (!parsed.success) return { fieldErrors: firstErrors(parsed.error) }
    if (!(await updateIncidentForAdmin(id, parsed.data))) return { error: NOT_FOUND }
    refresh()
    return { saved: true }
  }
  const parsed = newIncidentSchema.safeParse({
    ...fieldsOf(formData),
    clientId: formData.get("clientId"),
    sessionId: formData.get("sessionId"),
  })
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error) }
  const result = await createIncidentForAdmin(parsed.data)
  if (result.status === "client_not_found") return { fieldErrors: { clientId: "Ese cliente ya no existe. Elige otro." } }
  if (result.status === "session_not_found") return { error: "Esa sesión ya no existe. Recarga la página." }
  refresh()
  return { saved: true }
}

function firstErrors(error: z.ZodError) {
  const fields = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>
  return {
    title: fields.title?.[0],
    description: fields.description?.[0],
    priority: fields.priority?.[0],
    clientId: fields.clientId?.[0],
  }
}

export type IncidentActionResult = { ok: boolean; message: string }

export async function setIncidentStatusAction(id: unknown, status: unknown): Promise<IncidentActionResult> {
  const parsed = z.enum(INCIDENT_STATUSES).safeParse(status)
  if (!parsed.success) return { ok: false, message: "Acción no válida" }
  if (!(await setIncidentStatusForAdmin(id, parsed.data))) return { ok: false, message: NOT_FOUND }
  refresh()
  return { ok: true, message: `Incidencia: ${STATUS_LABEL[parsed.data].toLowerCase()}` }
}

export type IncidentClientOption = { userId: string; fullName: string }

export async function searchIncidentClientsAction(query: unknown): Promise<IncidentClientOption[]> {
  return searchClientsForIncident(query)
}
