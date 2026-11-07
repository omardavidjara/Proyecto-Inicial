import { z } from "zod"

// Avisos generales del gimnasio (SPEC F10). Título corto: el móvil lo corta a unos 40 caracteres en el push.
export const ANNOUNCEMENT_TITLE_MAX = 60
export const ANNOUNCEMENT_BODY_MAX = 500

export const announcementSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Escribe un título")
    .max(ANNOUNCEMENT_TITLE_MAX, `Máximo ${ANNOUNCEMENT_TITLE_MAX} caracteres`),
  body: z
    .string()
    .trim()
    .min(1, "Escribe el texto del aviso")
    .max(ANNOUNCEMENT_BODY_MAX, `Máximo ${ANNOUNCEMENT_BODY_MAX} caracteres`),
})

export type AnnouncementInput = z.infer<typeof announcementSchema>
