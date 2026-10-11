"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { removeMyAvatar, saveMyAvatar, saveMyProfile } from "@/lib/dal"
import { profileSchema, type ProfileInput } from "@/lib/validation/auth"

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
