// Generación diaria de sesiones desde la plantilla (SPEC F3, LIMITS D2). La llama Vercel Cron una vez al día
// (vercel.json) con `Authorization: Bearer $CRON_SECRET`. Idempotente: repetirla no duplica sesiones.
import { generateSessionsFromCron } from "@/lib/dal"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const created = await generateSessionsFromCron(request.headers.get("authorization"))
  if (created === null) return Response.json({ error: "No autorizado" }, { status: 401 })
  return Response.json({ created })
}
