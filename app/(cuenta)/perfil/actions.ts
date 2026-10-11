"use server"

import { refresh } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { getAuth } from "@/lib/auth"
import { deleteMyAccount, removeMyAvatar, saveMyAvatar, saveMyProfile } from "@/lib/dal"
import { DELETE_CONFIRMATION, profileSchema, type ProfileInput } from "@/lib/validation/auth"

export type ProfileState = {
  saved?: boolean
  error?: string
  fieldErrors?: Partial<Record<keyof ProfileInput, string>>
}

/** Nombre y teléfono del propio perfil (SPEC F1). Vale para cualquier estado de la cuenta */
export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const parsed = profileSchema.safeParse({ fullName: formData.get("fullName"), phone: formData.get("phone") })
  if (!parsed.success) {
    const fields = z.flattenError(parsed.error).fieldErrors
    return { fieldErrors: { fullName: fields.fullName?.[0], phone: fields.phone?.[0] } }
  }
  await saveMyProfile(parsed.data)
  refresh()
  return { saved: true }
}

/** Guarda la foto recién subida a Blob (la DAL comprueba que es del almacén y de la carpeta del usuario) */
export async function updateAvatar(url: unknown): Promise<{ ok: boolean }> {
  const ok = await saveMyAvatar(url)
  if (ok) refresh()
  return { ok }
}

/** Quita la foto y borra el archivo */
export async function deleteAvatar(): Promise<{ ok: boolean }> {
  await removeMyAvatar()
  refresh()
  return { ok: true }
}

export type DeleteAccountState = { error?: string }

const DELETE_ERRORS = {
  developer: "El rol de desarrollador no se puede eliminar desde la app.",
  unavailable: "Eliminar la cuenta no está disponible en este entorno de pruebas.",
  failed: "Tus datos ya se han borrado, pero no hemos podido cerrar tu acceso. Vuelve a intentarlo en unos minutos.",
} as const

/** Eliminar mi cuenta (SPEC F1, requisito del RGPD y de las tiendas). Hay que escribir ELIMINAR para confirmar */
export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const confirmation = z.string().trim().toUpperCase().safeParse(formData.get("confirmation"))
  if (!confirmation.success || confirmation.data !== DELETE_CONFIRMATION) {
    return { error: `Escribe ${DELETE_CONFIRMATION} para confirmar.` }
  }
  const result = await deleteMyAccount()
  if (result !== "deleted") return { error: DELETE_ERRORS[result] }
  // El usuario ya no existe en Neon Auth: cerrar sesión solo borra las cookies (si falla, proxy.ts lo hará)
  await getAuth()
    .signOut()
    .catch(() => {})
  redirect("/login?cuenta=eliminada")
}
