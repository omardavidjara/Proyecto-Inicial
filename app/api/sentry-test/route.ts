// Comprueba que los errores del servidor llegan a Sentry (Fase 4; repetir tras actualizar el SDK).
// Solo para el rol developer: a cualquier otro le responde 404, así nadie más gasta el cupo de errores.
import { notFound } from "next/navigation"

import { getViewer } from "@/lib/dal"

export const dynamic = "force-dynamic"

export async function GET() {
  const viewer = await getViewer()
  if (viewer?.role !== "developer" || viewer.status !== "active") notFound()
  throw new Error("Prueba de Sentry: error lanzado a propósito desde /api/sentry-test")
}
