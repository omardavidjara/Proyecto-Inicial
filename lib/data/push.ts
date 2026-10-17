import { and, eq, inArray, sql } from "drizzle-orm"

import { notifications, pushDevices } from "@/db/schema"
import type { PushSubscriptionInput } from "@/lib/validation/push"

import type { Db } from "./db"

// Dispositivos para Web Push y envío de avisos (SPEC F10). Cada usuario solo da de alta o de baja los suyos:
// quien llama (lib/dal.ts) pasa el user_id de la sesión verificada.

/**
 * Guarda la suscripción de este navegador para el usuario. La dirección es única: si ya existía (otra cuenta
 * entró antes en el mismo navegador), pasa a ser de este usuario, que es quien tiene ahora la sesión.
 */
export async function savePushDevice(db: Db, userId: string, subscription: PushSubscriptionInput) {
  const values = { userId, platform: "web" as const, token: subscription.endpoint, ...subscription.keys }
  await db
    .insert(pushDevices)
    .values(values)
    .onConflictDoUpdate({
      target: pushDevices.token,
      set: { userId, p256dh: values.p256dh, auth: values.auth, lastSeenAt: sql`now()`, updatedAt: sql`now()` },
    })
}

/** Quita un dispositivo del usuario (desactivar los avisos o cerrar sesión). El de otro usuario no se toca */
export async function removePushDevice(db: Db, userId: string, endpoint: string) {
  await db.delete(pushDevices).where(and(eq(pushDevices.userId, userId), eq(pushDevices.token, endpoint)))
}

export type NotificationKind = (typeof notifications.$inferInsert)["kind"]

/** Lo que se ve en la notificación. `url`: ruta de la app que se abre al tocarla */
export type PushMessage = { title: string; body: string; url: string }

export type PushTarget = { token: string; p256dh: string; auth: string }

/** «gone»: el servicio de push dice que la suscripción ya no existe (se borra el dispositivo) */
export type PushSendResult = "sent" | "gone" | "failed"

export type PushSender = (target: PushTarget, message: PushMessage) => Promise<PushSendResult>

export type Notice = { userId: string; kind: NotificationKind; refId: string | null; message: PushMessage }

/**
 * Envía cada aviso a todos los dispositivos de su usuario, una sola vez por `(usuario, tipo, referencia)`
 * (único de `notifications`): una segunda llamada con el mismo aviso no envía nada. Quien no tiene dispositivos
 * no gasta fila en el registro. Devuelve cuántos avisos se han registrado como enviados.
 */
export async function sendNotices(db: Db, send: PushSender, notices: Notice[]): Promise<number> {
  if (notices.length === 0) return 0
  const userIds = [...new Set(notices.map((n) => n.userId))]
  const devices = await db
    .select({ userId: pushDevices.userId, token: pushDevices.token, p256dh: pushDevices.p256dh, auth: pushDevices.auth })
    .from(pushDevices)
    .where(and(inArray(pushDevices.userId, userIds), eq(pushDevices.platform, "web")))
  const byUser = new Map<string, typeof devices>()
  for (const device of devices) byUser.set(device.userId, [...(byUser.get(device.userId) ?? []), device])

  let sent = 0
  const gone: string[] = []
  for (const notice of notices) {
    const targets = byUser.get(notice.userId)
    if (!targets?.length) continue
    const claimed = await db
      .insert(notifications)
      .values({ userId: notice.userId, kind: notice.kind, refId: notice.refId })
      .onConflictDoNothing()
      .returning({ id: notifications.id })
    if (claimed.length === 0) continue
    sent++
    const results = await Promise.all(
      targets.map((t) => send({ token: t.token, p256dh: t.p256dh!, auth: t.auth! }, notice.message)),
    )
    results.forEach((result, i) => result === "gone" && gone.push(targets[i].token))
  }
  if (gone.length > 0) await db.delete(pushDevices).where(inArray(pushDevices.token, gone))
  return sent
}
