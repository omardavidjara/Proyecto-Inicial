"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { decideClient } from "@/lib/dal"

const decisionSchema = z.enum(["approve", "reject", "deactivate", "reactivate"])

export type DecisionResult = { ok: boolean; message: string }

const DONE: Record<z.infer<typeof decisionSchema>, string> = {
  approve: "Alta aprobada",
  reject: "Alta rechazada: la cuenta queda de baja",
  deactivate: "Cliente dado de baja y reservas futuras anuladas",
  reactivate: "Cliente reactivado",
}

/** Aprobar, rechazar, dar de baja o reactivar a un cliente (SPEC F1). La DAL exige el rol de administración */
export async function decideClientAction(decision: unknown, userId: unknown): Promise<DecisionResult> {
  const parsed = decisionSchema.safeParse(decision)
  if (!parsed.success) return { ok: false, message: "Acción no válida" }
  const changed = await decideClient(parsed.data, userId)
  if (!changed) return { ok: false, message: "No se ha podido: puede que otra persona ya lo haya cambiado. Recarga la lista." }
  refresh()
  return { ok: true, message: DONE[parsed.data] }
}
