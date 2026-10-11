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

export const fullNameSchema = z
  .string("Escribe tu nombre")
  .trim()
  .min(2, "Escribe tu nombre y apellidos")
  .max(100, "El nombre es demasiado largo")

/** Teléfono: dígitos con prefijo + opcional; se guarda sin espacios, guiones ni paréntesis */
export const phoneSchema = z
  .string("Escribe tu teléfono")
  .trim()
  .transform((value) => value.replace(/[\s().-]/g, ""))
  .pipe(z.string().regex(/^\+?[0-9]{9,15}$/, "Escribe un teléfono válido (9 a 15 cifras, con prefijo si no es español)"))

/** Mínimo y máximo de Neon Auth (Better Auth) para contraseñas */
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

export const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: z.email("Escribe un correo electrónico válido").trim().toLowerCase().max(254),
  phone: phoneSchema,
  password: z
    .string("Escribe una contraseña")
    .min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`)
    .max(PASSWORD_MAX, "La contraseña es demasiado larga"),
  // /privacidad §8: los menores de MIN_AGE años necesitan a sus padres o tutores (LOPDGDD art. 7)
  minAge: z.literal("on", "Confirma tu edad para continuar"),
})
export type SignUpInput = z.infer<typeof signUpSchema>

const emailSchema = z.email("Escribe un correo electrónico válido").trim().toLowerCase().max(254)

/** Código de 6 cifras que Neon Auth envía por correo para confirmarlo */
export const verifyEmailSchema = z.object({
  email: emailSchema,
  otp: z
    .string("Escribe el código")
    .trim()
    .regex(/^[0-9]{6}$/, "El código tiene 6 cifras"),
})
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>

export const resendCodeSchema = z.object({ email: emailSchema })
