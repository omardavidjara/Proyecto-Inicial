"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { decideLateCancellation } from "@/lib/dal"

export type LateDecisionResult = { ok: boolean; message: string }

/** Descontar o no la clase de una anulación tardía (SPEC F6). La DAL exige el rol de administración */
export async function decideLateCancellationAction(bookingId: unknown, charge: unknown): Promise<LateDecisionResult> {
  const parsed = z.boolean().safeParse(charge)
  if (!parsed.success) return { ok: false, message: "Acción no válida" }
  if (!(await decideLateCancellation(bookingId, parsed.data))) {
    refresh()
    return { ok: false, message: "Esa anulación ya estaba decidida. Se ha actualizado la lista." }
  }
  refresh()
  return { ok: true, message: parsed.data ? "Clase descontada" : "Clase no descontada" }
}
