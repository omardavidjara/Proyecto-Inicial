"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { CLIENT_GONE, incidentFieldErrors, parseIncidentEdit, parseNewIncident, SESSION_GONE, type IncidentFormState } from "@/lib/incident-form"
import {
  createIncidentForAdmin,
  searchClientsForIncident,
  setIncidentStatusForAdmin,
  updateIncidentForAdmin,
} from "@/lib/dal"
import { INCIDENT_STATUSES, STATUS_LABEL } from "@/lib/validation/incidents"

// Incidencias (SPEC F9). La DAL exige el rol de administración y valida los ids

const NOT_FOUND = "Esa incidencia ya no existe. Recarga la página."

/** Crear (con cliente o sesión opcionales) o editar (con el campo oculto `id`: título, descripción y prioridad) */
export async function saveIncidentAction(_prev: IncidentFormState, formData: FormData): Promise<IncidentFormState> {
  const id = formData.get("id")
  if (id) {
    const parsed = parseIncidentEdit(formData)
    if (!parsed.success) return { fieldErrors: incidentFieldErrors(parsed.error) }
    if (!(await updateIncidentForAdmin(id, parsed.data))) return { error: NOT_FOUND }
    refresh()
    return { saved: true }
  }
  const parsed = parseNewIncident(formData)
  if (!parsed.success) return { fieldErrors: incidentFieldErrors(parsed.error) }
  const result = await createIncidentForAdmin(parsed.data)
  if (result.status === "client_not_found") return { fieldErrors: { clientId: CLIENT_GONE } }
  if (result.status === "session_not_found") return { error: SESSION_GONE }
  refresh()
  return { saved: true }
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
