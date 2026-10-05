"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { getAuth } from "@/lib/auth"
import { LOGIN_PATH } from "@/lib/roles"
import { signInSchema } from "@/lib/validation/auth"

export type SignInState = {
  error?: string
  fieldErrors?: { email?: string; password?: string }
  email?: string
}

/** Mensajes en español para los errores de Neon Auth (Better Auth) que puede ver un usuario */
function signInErrorMessage(error: { status?: number; code?: string }) {
  if (error.status === 429) return "Demasiados intentos. Espera un momento y vuelve a probar."
  if (error.code === "EMAIL_NOT_VERIFIED") return "Confirma tu correo antes de entrar: revisa tu bandeja de entrada."
  if (error.status === 401 || error.status === 400 || error.code === "INVALID_EMAIL_OR_PASSWORD") {
    return "Correo o contraseña incorrectos."
  }
  return "No se ha podido iniciar sesión. Inténtalo de nuevo en unos minutos."
}

/** Inicio de sesión con correo y contraseña. Valida con Zod antes de llamar a Neon Auth. */
export async function signInWithEmail(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  const email = typeof formData.get("email") === "string" ? String(formData.get("email")) : ""
  if (!parsed.success) {
    const fields = z.flattenError(parsed.error).fieldErrors
    return { email, fieldErrors: { email: fields.email?.[0], password: fields.password?.[0] } }
  }

  const { error } = await getAuth().signIn.email(parsed.data)
  if (error) return { email, error: signInErrorMessage(error) }

  // "/" decide el inicio según el rol (o /pendiente si la cuenta aún no está aprobada)
  redirect("/")
}

export async function signOut() {
  await getAuth().signOut()
  redirect(LOGIN_PATH)
}
