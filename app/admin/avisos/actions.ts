"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { deleteAnnouncement, publishAnnouncement } from "@/lib/dal"
import { announcementSchema, type AnnouncementInput } from "@/lib/validation/announcements"

// Avisos generales (SPEC F10). La DAL exige el rol de administración y valida el id

export type AnnouncementFormState = {
  saved?: boolean
  fieldErrors?: Partial<Record<keyof AnnouncementInput, string>>
}

export async function publishAnnouncementAction(_prev: AnnouncementFormState, formData: FormData): Promise<AnnouncementFormState> {
  const parsed = announcementSchema.safeParse({ title: formData.get("title"), body: formData.get("body") })
  if (!parsed.success) {
    const fields = z.flattenError(parsed.error).fieldErrors
    return { fieldErrors: { title: fields.title?.[0], body: fields.body?.[0] } }
  }
  await publishAnnouncement(parsed.data)
  refresh()
  return { saved: true }
}

export async function deleteAnnouncementAction(id: unknown): Promise<{ ok: boolean; message: string }> {
  if (!(await deleteAnnouncement(id))) return { ok: false, message: "Ese aviso ya no existe. Recarga la lista." }
  refresh()
  return { ok: true, message: "Aviso eliminado" }
}
