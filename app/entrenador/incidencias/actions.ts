"use server"

import { refresh } from "next/cache"

import { createIncidentForCoach } from "@/lib/dal"
import { CLIENT_GONE, incidentFieldErrors, parseNewIncident, SESSION_GONE, type IncidentFormState } from "@/lib/incident-form"

// Incidencias del entrenador (SPEC F9): solo abrirlas. La DAL exige ser entrenador y la capa de datos limita la
// sesión a las suyas y el cliente a quien está apuntado a ella

export async function createCoachIncidentAction(_prev: IncidentFormState, formData: FormData): Promise<IncidentFormState> {
  const parsed = parseNewIncident(formData)
  if (!parsed.success) return { fieldErrors: incidentFieldErrors(parsed.error) }
  const result = await createIncidentForCoach(parsed.data)
  if (result.status === "client_not_found") return { fieldErrors: { clientId: CLIENT_GONE } }
  if (result.status === "session_not_found") return { error: SESSION_GONE }
  refresh()
  return { saved: true }
}
