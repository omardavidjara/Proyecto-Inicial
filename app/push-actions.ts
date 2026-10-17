"use server"

import { removeMyPushDevice, saveMyPushDevice } from "@/lib/dal"

// Activar y desactivar los avisos push en este navegador (SPEC F10). La DAL valida la suscripción y usa el
// user_id de la sesión: nadie puede dar de alta o de baja el dispositivo de otro.

export async function subscribePush(subscription: unknown): Promise<{ ok: boolean }> {
  return { ok: await saveMyPushDevice(subscription) }
}

export async function unsubscribePush(endpoint: unknown): Promise<void> {
  await removeMyPushDevice(endpoint)
}
