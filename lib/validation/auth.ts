import { z } from "zod"

/** Usuario de la sesión de Neon Auth: solo lo que usa la app, comprobado antes de tocar la base de datos */
export const sessionUserSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().max(200).nullish(),
  email: z.email(),
})
export type SessionUser = z.infer<typeof sessionUserSchema>

export const signInSchema = z.object({
  email: z.email("Escribe un correo electrónico válido").trim().toLowerCase().max(254),
  password: z.string().min(1, "Escribe tu contraseña").max(128),
})
export type SignInInput = z.infer<typeof signInSchema>

