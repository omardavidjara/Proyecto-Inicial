"use server"

import * as Sentry from "@sentry/nextjs"
import { redirect } from "next/navigation"
import { z } from "zod"

import { getAuth } from "@/lib/auth"
import { isLoginRateLimited, isRateLimited, noteAttempt, noteLoginFailure, noteLoginSuccess, removeMyPushDevice, saveSignUpProfile } from "@/lib/dal"
import { confirmEmailPath, LOGIN_PATH } from "@/lib/roles"
import { resendCodeSchema, signInSchema, signUpSchema, verifyEmailSchema, type SignUpInput } from "@/lib/validation/auth"

export type SignInState = {
  error?: string
  fieldErrors?: { email?: string; password?: string }
  email?: string
}

const TOO_MANY_ATTEMPTS = "Demasiados intentos. Espera unos minutos y vuelve a probar."

/** Correo o contraseña incorrectos (lo único que cuenta para el límite de intentos) */
function isWrongCredentials(error: { status?: number; code?: string }) {
  if (error.code === "EMAIL_NOT_VERIFIED") return false
  return error.status === 401 || error.status === 400 || error.code === "INVALID_EMAIL_OR_PASSWORD"
}

/** Mensajes en español para los errores de Neon Auth (Better Auth) que puede ver un usuario */
function signInErrorMessage(error: { status?: number; code?: string }) {
  if (error.status === 429) return TOO_MANY_ATTEMPTS
  if (error.code === "EMAIL_NOT_VERIFIED") return "Confirma tu correo antes de entrar: revisa tu bandeja de entrada."
  if (isWrongCredentials(error)) return "Correo o contraseña incorrectos."
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

  // Límite propio por correo e IP: Neon Auth no recibe la IP de quien entra (lib/data/login-attempts.ts)
  if (await isLoginRateLimited(parsed.data.email)) return { email, error: TOO_MANY_ATTEMPTS }

  const { error } = await getAuth().signIn.email(parsed.data)
  if (error) {
    // Contraseña correcta, correo sin confirmar: Neon Auth acaba de enviar un código (F1)
    if (error.code === "EMAIL_NOT_VERIFIED") redirect(confirmEmailPath(parsed.data.email))
    if (isWrongCredentials(error)) await noteLoginFailure(parsed.data.email)
    return { email, error: signInErrorMessage(error) }
  }
  await noteLoginSuccess(parsed.data.email)

  // "/" decide el inicio según el rol (o /pendiente si la cuenta aún no está aprobada)
  redirect("/")
}

/**
 * Cerrar sesión. Si este navegador tenía los avisos activados, el formulario envía su dirección de push y se quita
 * el dispositivo: quien entre después en el mismo móvil no debe recibir los avisos de esta cuenta (F10)
 */
export async function signOut(formData?: FormData) {
  await removeMyPushDevice(formData?.get("pushEndpoint")).catch((error) => Sentry.captureException(error))
  await getAuth().signOut()
  redirect(LOGIN_PATH)
}

// ── Registro (F1) ───────────────────────────────────────────────────────────────────────────────────────

export type SignUpState = {
  error?: string
  fieldErrors?: Partial<Record<keyof SignUpInput, string>>
  values?: { fullName?: string; email?: string; phone?: string }
}

const text = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

/** Primer error de cada campo */
const fieldErrorsOf = (error: z.ZodError) =>
  Object.fromEntries(
    Object.entries(z.flattenError(error).fieldErrors as Record<string, string[] | undefined>).map(([key, messages]) => [key, messages?.[0]]),
  )

/**
 * Registro con correo y contraseña (SPEC F1). Neon Auth envía un código para confirmar el correo y la cuenta queda
 * pendiente de que el gimnasio la apruebe. Para no revelar quién tiene cuenta, un correo ya registrado lleva al
 * mismo sitio que uno nuevo.
 */
export async function signUpWithEmail(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const values = { fullName: text(formData, "fullName"), email: text(formData, "email"), phone: text(formData, "phone") }
  const parsed = signUpSchema.safeParse({ ...values, password: formData.get("password"), minAge: formData.get("minAge") })
  if (!parsed.success) return { values, fieldErrors: fieldErrorsOf(parsed.error) }
  const { fullName, email, phone, password } = parsed.data

  if (await isRateLimited("signup", email)) return { values, error: TOO_MANY_ATTEMPTS }
  await noteAttempt("signup", email)

  const { data, error } = await getAuth().signUp.email({ name: fullName, email, password })
  if (error) {
    if (error.status === 429) return { values, error: TOO_MANY_ATTEMPTS }
    // Correo ya registrado: lo mismo que un registro nuevo (no revela quién tiene cuenta)
    if (!(error.status === 422 || /ALREADY_EXISTS/.test(error.code ?? ""))) {
      // Solo el estado y el código de Neon Auth: nunca el correo ni el nombre
      console.error("Registro rechazado por Neon Auth", error.status, error.code)
      Sentry.captureMessage(`Registro rechazado por Neon Auth: ${error.status} ${error.code ?? ""}`)
      return { values, error: "No se ha podido crear la cuenta. Inténtalo de nuevo en unos minutos." }
    }
  } else if (data?.user?.id) {
    // Si falla, la cuenta ya existe: el perfil se creará en su primer inicio de sesión (sin teléfono, se le pedirá)
    await saveSignUpProfile({ userId: data.user.id, fullName, phone }).catch((err) => Sentry.captureException(err))
  }
  redirect(confirmEmailPath(email))
}

export type VerifyEmailState = { error?: string; fieldErrors?: { email?: string; otp?: string }; notice?: string }

/** Confirma el correo con el código. Neon Auth inicia la sesión y "/" lleva a /pendiente */
export async function verifyEmailCode(_prev: VerifyEmailState, formData: FormData): Promise<VerifyEmailState> {
  const parsed = verifyEmailSchema.safeParse({ email: formData.get("email"), otp: formData.get("otp") })
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) }
  const { email, otp } = parsed.data

  if (await isRateLimited("verify", email)) return { error: TOO_MANY_ATTEMPTS }
  const { error } = await getAuth().emailOtp.verifyEmail({ email, otp })
  if (error) {
    if (error.status === 429) return { error: TOO_MANY_ATTEMPTS }
    await noteAttempt("verify", email)
    return { error: "Código incorrecto o caducado. Revísalo o pide uno nuevo." }
  }
  redirect("/")
}

/** Envía otro código. Misma respuesta exista o no la cuenta */
export async function resendEmailCode(_prev: VerifyEmailState, formData: FormData): Promise<VerifyEmailState> {
  const parsed = resendCodeSchema.safeParse({ email: formData.get("email") })
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) }
  const { email } = parsed.data

  if (await isRateLimited("verify", email)) return { error: TOO_MANY_ATTEMPTS }
  await noteAttempt("verify", email)
  const { error } = await getAuth().emailOtp.sendVerificationOtp({ email, type: "email-verification" })
  if (error?.status === 429) return { error: TOO_MANY_ATTEMPTS }
  return { notice: "Si el correo tiene una cuenta sin confirmar, te hemos enviado un código nuevo." }
}
