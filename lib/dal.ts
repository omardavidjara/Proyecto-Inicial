// Capa de acceso a datos (ARCHITECTURE §6): la que de verdad protege. Verifica la sesión de Neon Auth,
// carga el perfil y aplica rol y estado. Las páginas, layouts y Server Actions llaman a estas funciones;
// nunca leen la base de datos ni la sesión por su cuenta.
import "server-only"

import { timingSafeEqual } from "node:crypto"

import * as Sentry from "@sentry/nextjs"
import { cookies, headers } from "next/headers"
import { redirect, unstable_rethrow } from "next/navigation"
import { cache } from "react"
import { z } from "zod"

import { getDb, getTxDb } from "@/db"
import { getAuth } from "@/lib/auth"
import { anonymizeAccount } from "@/lib/data/account"
import * as agenda from "@/lib/data/agenda"
import * as bookingData from "@/lib/data/bookings"
import * as calendar from "@/lib/data/calendar"
import * as myBookings from "@/lib/data/my-bookings"
import * as classTypes from "@/lib/data/class-types"
import * as clients from "@/lib/data/clients"
import * as memberships from "@/lib/data/memberships"
import * as plans from "@/lib/data/plans"
import * as schedule from "@/lib/data/schedule"
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from "@/lib/data/login-attempts"
import { createSignUpProfile, ensureProfile, getMyProfile as selectMyProfile, setMyAvatar, updateMyProfile, type Viewer } from "@/lib/data/profiles"
import { del } from "@vercel/blob"

import { isOwnAvatarUrl } from "@/lib/avatar"
import { toDateKey } from "@/lib/dates"
import { clientIp, limitKeys, type LimitScope } from "@/lib/login-limit"
import { canDeleteAuthUsers, deleteAuthUser } from "@/lib/neon-admin"
import { canAccessArea, homePathFor, LOGIN_PATH, PENDING_PATH, type Area, type ProfileStatus } from "@/lib/roles"
import { sessionUserSchema, type SessionUser } from "@/lib/validation/auth"
import type { ClassTypeInput } from "@/lib/validation/class-types"
import type { PlanInput } from "@/lib/validation/plans"
import type { OneOffSessionInput, ScheduleSlotInput, SessionInput } from "@/lib/validation/schedule"

/** Usuario de la sesión verificada, o `null`. Una sola comprobación por render (`cache`). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Marca la página como dinámica antes de llamar al SDK, que capturaría esa señal de Next y la
  // registraría como error durante el build
  await cookies()
  try {
    const { data } = await getAuth().getSession()
    const parsed = sessionUserSchema.safeParse(data?.user)
    return parsed.success ? parsed.data : null
  } catch (error) {
    // Señales internas de Next (render dinámico, redirect…): siguen su curso
    unstable_rethrow(error)
    // Con cookies de una sesión que ya no vale (caducada, cerrada en otro sitio o de una cuenta eliminada), Neon
    // Auth pide borrarlas y el SDK intenta hacerlo, pero una página no puede escribir cookies: es "sin sesión".
    // Las páginas privadas no llegan aquí con ellas (proxy.ts las renueva o las borra); /login sí.
    return null
  }
})

/** Perfil de quien consulta (se crea en su primer inicio de sesión), o `null` sin sesión. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getSessionUser()
  if (!user) return null
  return ensureProfile(getDb(), user)
})

/** Exige sesión; sin ella, a /login. Admite perfiles pendientes o de baja (para /pendiente). */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer) redirect(LOGIN_PATH)
  return viewer
}

/**
 * Exige sesión, perfil activo y permiso para la zona. Si falta algo, lleva a donde corresponde:
 * sin sesión → /login; pendiente o de baja → /pendiente; otra zona → su inicio.
 */
export async function requireArea(area: Area): Promise<Viewer> {
  const viewer = await requireViewer()
  if (viewer.status !== "active") redirect(PENDING_PATH)
  if (!canAccessArea(viewer, area)) redirect(homePathFor(viewer))
  return viewer
}

/** Mi tarifa de hoy y las clases que me quedan en el periodo (solo las del usuario de la sesión) */
export async function getMyPlanSummary() {
  const viewer = await requireArea("client")
  return memberships.getPlanSummary(getDb(), viewer.userId, toDateKey(new Date()))
}

/** Nombre de pila para el saludo de «Inicio» */
export async function getMyFirstName() {
  const viewer = await requireArea("client")
  return viewer.fullName.trim().split(/\s+/)[0] ?? ""
}

/** Mis próximas reservas (vivas) */
export async function getMyUpcomingBookings() {
  const viewer = await requireArea("client")
  return myBookings.listUpcomingBookings(getDb(), viewer.userId)
}

/** Mi próxima clase confirmada, o `null` */
export async function getMyNextBooking() {
  const viewer = await requireArea("client")
  return myBookings.getNextConfirmedBooking(getDb(), viewer.userId)
}

/** Una página de mi historial; `cursor` llega del navegador y se valida en la capa de datos */
export async function getMyBookingHistory(cursor?: unknown) {
  const viewer = await requireArea("client")
  return myBookings.listBookingHistory(getDb(), viewer.userId, { cursor })
}

// ── Calendario y reservas (F5) ──────────────────────────────────────────────────────────────────────────
// Cliente, administrador y desarrollador reservan para sí (ARCHITECTURE §6); el entrenador sin rol de
// administración no entra en la zona de cliente. Siempre con el usuario de la sesión.

/** Reglas de reserva y zona horaria del gimnasio */
export async function getBookingSettings() {
  await requireArea("client")
  return bookingData.getBookingSettings(getDb())
}

/** Sesiones de un día con mis reservas */
export async function getMyCalendarDay(day: string) {
  const viewer = await requireArea("client")
  return calendar.listDaySessions(getDb(), viewer.userId, day)
}

/** Una sesión con mi reserva, o `null` */
export async function getMyCalendarSession(sessionId: unknown) {
  const viewer = await requireArea("client")
  return calendar.getCalendarSession(getDb(), viewer.userId, sessionId)
}

/** Mi reserva viva que quiero cambiar de sesión, o `null` */
export async function getMyBookingToChange(bookingId: unknown) {
  const viewer = await requireArea("client")
  return calendar.getMyLiveBooking(getDb(), viewer.userId, bookingId)
}

export async function bookMySession(sessionId: unknown) {
  const viewer = await requireArea("client")
  return bookingData.bookSession(getTxDb(), viewer.userId, sessionId)
}

export async function cancelMyBooking(bookingId: unknown) {
  const viewer = await requireArea("client")
  return bookingData.cancelBooking(getTxDb(), viewer.userId, bookingId)
}

export async function changeMyBooking(bookingId: unknown, sessionId: unknown) {
  const viewer = await requireArea("client")
  return bookingData.changeBooking(getTxDb(), viewer.userId, bookingId, sessionId)
}

// ── Límite de intentos de inicio de sesión (lib/data/login-attempts.ts) ──────────────────────────────────
// Si la base de datos falla, se deja pasar el intento y se avisa a Sentry: un fallo del límite no debe impedir
// entrar a nadie (Neon Auth sigue comprobando la contraseña).

async function limitKeysFor(scope: LimitScope, email: string) {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET
  if (!secret) throw new Error("Falta NEON_AUTH_COOKIE_SECRET (ver .env.example)")
  return limitKeys(scope, email, clientIp(await headers()), secret)
}

const loginKeysFor = (email: string) => limitKeysFor("login", email)

async function failOpen<T>(fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    Sentry.captureException(error)
    return fallback
  }
}

/** ¿Hay demasiados intentos fallidos recientes para este correo o esta IP? */
export function isLoginRateLimited(email: string) {
  return failOpen(false, async () => isLoginBlocked(getDb(), await loginKeysFor(email)))
}

/** Correo o contraseña incorrectos: cuenta para el límite */
export function noteLoginFailure(email: string) {
  return failOpen(undefined, async () => recordLoginFailure(getDb(), await loginKeysFor(email)))
}

/** Inicio de sesión correcto: el correo vuelve a empezar de cero */
export function noteLoginSuccess(email: string) {
  return failOpen(undefined, async () => clearLoginFailures(getDb(), await loginKeysFor(email)))
}

// ── Registro (F1) ───────────────────────────────────────────────────────────────────────────────────────

/** ¿Demasiados registros o códigos de verificación recientes con este correo o desde esta IP? */
export function isRateLimited(scope: Exclude<LimitScope, "login">, email: string) {
  return failOpen(false, async () => isLoginBlocked(getDb(), await limitKeysFor(scope, email)))
}

/** Registro: cuenta cada intento (frena la creación masiva). Verificación: cuenta cada código incorrecto o reenvío */
export function noteAttempt(scope: Exclude<LimitScope, "login">, email: string) {
  return failOpen(undefined, async () => recordLoginFailure(getDb(), await limitKeysFor(scope, email)))
}

/** Perfil pendiente con el teléfono del registro. `userId` viene de Neon Auth, nunca del navegador */
export async function saveSignUpProfile(input: { userId: string; fullName: string; phone: string }) {
  await createSignUpProfile(getDb(), input)
}

// ── Perfil (F1) ─────────────────────────────────────────────────────────────────────────────────────────

/** Mi perfil, con el correo de la cuenta. Vale para cualquier estado (pendiente y baja también lo ven) */
export async function getMyProfile() {
  const viewer = await requireViewer()
  const [user, profile] = await Promise.all([getSessionUser(), selectMyProfile(getDb(), viewer)])
  return { viewer, email: user?.email ?? "", fullName: profile?.fullName ?? viewer.fullName, phone: profile?.phone ?? null, avatarUrl: profile?.avatarUrl ?? null }
}

/** Guarda nombre y teléfono del usuario de la sesión */
export async function saveMyProfile(input: { fullName: string; phone: string }) {
  const viewer = await requireViewer()
  await updateMyProfile(getDb(), viewer, input)
}

// ── Altas y bajas de clientes (F1, solo administración) ─────────────────────────────────────────────────
// El id del cliente llega del navegador: se valida y solo se acepta en estas acciones de administrador
// (ARCHITECTURE §6). Cada una devuelve false si el cambio no encaja con el estado actual.

const clientIdSchema = z.uuid()
const planIdSchema = z.uuid()

export async function listClientsForAdmin(status: ProfileStatus) {
  await requireArea("admin")
  return clients.listClients(getDb(), status)
}

/** Tarifas activas para elegir al aprobar, reactivar o cambiar la tarifa */
export async function listActivePlansForAdmin() {
  await requireArea("admin")
  return (await plans.listPlans(getDb())).filter((plan) => plan.isActive)
}

/** Historial de tarifas de los clientes de la lista */
export async function listMembershipsForAdmin(userIds: string[]) {
  await requireArea("admin")
  return memberships.listMemberships(getDb(), userIds.filter((id) => clientIdSchema.safeParse(id).success))
}

export async function countPendingClientsForAdmin() {
  await requireArea("admin")
  return clients.countPendingClients(getDb())
}

export type ClientDecision = "approve" | "reject" | "deactivate" | "reactivate"
export type DecisionOutcome = "done" | "conflict" | "plan_not_found"

/** Al aprobar o reactivar se puede elegir una tarifa (opcional): se valida aquí y empieza hoy */
export async function decideClient(decision: ClientDecision, userId: unknown, planId: unknown = null): Promise<DecisionOutcome> {
  await requireArea("admin")
  const parsed = clientIdSchema.safeParse(userId)
  if (!parsed.success) return "conflict"
  const plan = planId == null || planId === "" ? null : planIdSchema.safeParse(planId)
  if (plan && !plan.success) return "plan_not_found"
  const planIdValue = plan ? plan.data : null
  switch (decision) {
    // Transacciones (perfil + tarifa o reservas): necesitan el Pool, el driver HTTP no las admite
    case "approve":
      return clients.approveClient(getTxDb(), parsed.data, planIdValue)
    case "reactivate":
      return clients.reactivateClient(getTxDb(), parsed.data, planIdValue)
    case "reject":
      return (await clients.rejectClient(getDb(), parsed.data)) ? "done" : "conflict"
    case "deactivate":
      return (await clients.deactivateClient(getTxDb(), parsed.data)) ? "done" : "conflict"
  }
}

/** Cambiar o quitar (sin tarifa) la tarifa de un cliente activo desde hoy o una fecha futura */
export async function changeClientPlan(userId: unknown, planId: string | null, startsOn: string): Promise<clients.ChangePlanResult> {
  await requireArea("admin")
  const parsed = clientIdSchema.safeParse(userId)
  if (!parsed.success) return "not_found"
  return clients.changeClientPlan(getTxDb(), parsed.data, planId, startsOn)
}

// ── Tipos de clase (F2, solo administración) ────────────────────────────────────────────────────────────
// El id llega del navegador: se valida aquí. Un id que no existe devuelve "not_found" / false.

const classTypeIdSchema = z.uuid()

export async function listClassTypesForAdmin() {
  await requireArea("admin")
  return classTypes.listClassTypes(getDb())
}

/** Crea (sin id) o edita un tipo de clase */
export async function saveClassType(id: unknown, input: ClassTypeInput): Promise<classTypes.SaveResult> {
  await requireArea("admin")
  if (id == null) return classTypes.createClassType(getDb(), input)
  const parsed = classTypeIdSchema.safeParse(id)
  if (!parsed.success) return "not_found"
  return classTypes.updateClassType(getDb(), parsed.data, input)
}

export async function setClassTypeActive(id: unknown, isActive: boolean) {
  await requireArea("admin")
  const parsed = classTypeIdSchema.safeParse(id)
  if (!parsed.success) return false
  return classTypes.setClassTypeActive(getDb(), parsed.data, isActive)
}

export async function deleteClassType(id: unknown): Promise<classTypes.DeleteResult> {
  await requireArea("admin")
  const parsed = classTypeIdSchema.safeParse(id)
  if (!parsed.success) return "not_found"
  return classTypes.deleteClassType(getDb(), parsed.data)
}

// ── Tarifas (F4, solo administración) ─────────────────────────────────────────────────────────────────


export async function listPlansForAdmin() {
  await requireArea("admin")
  return plans.listPlans(getDb())
}

/** Crea (sin id) o edita una tarifa */
export async function savePlan(id: unknown, input: PlanInput): Promise<plans.SaveResult> {
  await requireArea("admin")
  if (id == null) return plans.createPlan(getDb(), input)
  const parsed = planIdSchema.safeParse(id)
  if (!parsed.success) return "not_found"
  return plans.updatePlan(getDb(), parsed.data, input)
}

export async function setPlanActive(id: unknown, isActive: boolean) {
  await requireArea("admin")
  const parsed = planIdSchema.safeParse(id)
  if (!parsed.success) return false
  return plans.setPlanActive(getDb(), parsed.data, isActive)
}

export async function deletePlan(id: unknown): Promise<plans.DeleteResult> {
  await requireArea("admin")
  const parsed = planIdSchema.safeParse(id)
  if (!parsed.success) return "not_found"
  return plans.deletePlan(getDb(), parsed.data)
}

// ── Horario (F3, solo administración) ───────────────────────────────────────────────────────────────────
// Las escrituras tocan la franja y sus sesiones a la vez: transacción, con el Pool (getTxDb).

// Id de una franja o de una sesión
const scheduleIdSchema = z.uuid()

export async function getScheduleForAdmin() {
  await requireArea("admin")
  const db = getDb()
  const [slots, types, coaches] = await Promise.all([
    schedule.listScheduleSlots(db),
    classTypes.listClassTypes(db),
    schedule.listCoaches(db),
  ])
  return { slots, classTypes: types, coaches }
}

/** Crea (sin id) o edita una franja de la plantilla */
export async function saveScheduleSlot(id: unknown, input: ScheduleSlotInput): Promise<schedule.SaveResult> {
  await requireArea("admin")
  if (id == null) return schedule.createScheduleSlot(getTxDb(), input)
  const parsed = scheduleIdSchema.safeParse(id)
  if (!parsed.success) return "not_found"
  return schedule.updateScheduleSlot(getTxDb(), parsed.data, input)
}

export async function setScheduleSlotActive(id: unknown, isActive: boolean) {
  await requireArea("admin")
  const parsed = scheduleIdSchema.safeParse(id)
  if (!parsed.success) return false
  return schedule.setScheduleSlotActive(getTxDb(), parsed.data, isActive)
}

export async function deleteScheduleSlot(id: unknown): Promise<schedule.DeleteResult> {
  await requireArea("admin")
  const parsed = scheduleIdSchema.safeParse(id)
  if (!parsed.success) return "not_found"
  return schedule.deleteScheduleSlot(getTxDb(), parsed.data)
}

export async function getUpcomingSessionsForAdmin() {
  await requireArea("admin")
  const db = getDb()
  const [sessionRows, types, coaches] = await Promise.all([
    schedule.listUpcomingSessions(db),
    classTypes.listClassTypes(db),
    schedule.listCoaches(db),
  ])
  return { sessions: sessionRows, classTypes: types, coaches }
}

/** Crea una sesión suelta (sin id) o edita una sesión */
export async function saveSession(id: unknown, input: SessionInput | OneOffSessionInput): Promise<schedule.SessionSaveResult> {
  await requireArea("admin")
  if (id == null) return "classTypeId" in input ? schedule.createOneOffSession(getTxDb(), input) : "invalid_class_type"
  const parsed = scheduleIdSchema.safeParse(id)
  if (!parsed.success) return "not_found"
  return schedule.updateSession(getTxDb(), parsed.data, input)
}

export async function cancelSession(id: unknown, reason: string | null): Promise<schedule.CancelSessionResult> {
  await requireArea("admin")
  const parsed = scheduleIdSchema.safeParse(id)
  if (!parsed.success) return { result: "not_found" }
  return schedule.cancelSession(getTxDb(), parsed.data, reason)
}

/**
 * Generación diaria de sesiones (api/cron/generate-sessions). Sin sesión de usuario: la protege CRON_SECRET,
 * que Vercel Cron envía como `Authorization: Bearer …`. Devuelve null si la cabecera no es válida.
 */
export async function generateSessionsFromCron(authorization: string | null) {
  if (!isCronAuthorized(authorization)) return null
  return schedule.generateSessions(getDb())
}

function isCronAuthorized(authorization: string | null) {
  const secret = process.env.CRON_SECRET
  if (!secret || !authorization) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(authorization)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

// ── Foto de perfil (F1) ─────────────────────────────────────────────────────────────────────────────────

/** Borra el archivo anterior de Blob (gratis). Si falla, solo queda un archivo huérfano: se avisa a Sentry */
async function deleteBlob(url: string | null) {
  if (url) await del(url).catch((error) => Sentry.captureException(error))
}

/** Guarda la foto recién subida. Solo se acepta una URL de nuestro almacén y de la carpeta del usuario */
export async function saveMyAvatar(url: unknown) {
  const viewer = await requireViewer()
  if (!isOwnAvatarUrl(url, viewer.userId, process.env.BLOB_READ_WRITE_TOKEN)) return false
  const previous = await setMyAvatar(getDb(), viewer, url as string)
  if (previous !== url) await deleteBlob(previous)
  return true
}

/** Quita la foto (retirar el consentimiento, /privacidad §3) y borra el archivo */
export async function removeMyAvatar() {
  const viewer = await requireViewer()
  await deleteBlob(await setMyAvatar(getDb(), viewer, null))
}

// ── Eliminar mi cuenta (F1) ─────────────────────────────────────────────────────────────────────────────

export type DeleteAccountResult = "deleted" | "developer" | "unavailable" | "failed"

/** ¿Puede quien consulta eliminar su cuenta desde la app? (el desarrollador no; en previews no está configurado) */
export async function accountDeletion() {
  const viewer = await requireViewer()
  if (viewer.role === "developer") return "developer" as const
  return canDeleteAuthUsers() ? ("available" as const) : ("unavailable" as const)
}

/**
 * Anonimiza el perfil (y anula reservas futuras y dispositivos), borra la foto y borra el acceso en Neon Auth.
 * Repetible: si Neon Auth falla, el perfil ya está anonimizado y se puede volver a intentar.
 */
export async function deleteMyAccount(): Promise<DeleteAccountResult> {
  const viewer = await requireViewer()
  if (viewer.role === "developer") return "developer"
  if (!canDeleteAuthUsers()) return "unavailable"

  // Transacción: necesita el Pool (el driver HTTP no las admite)
  const anonymized = await anonymizeAccount(getTxDb(), viewer.userId)
  await deleteBlob(anonymized?.avatarUrl ?? null)
  try {
    await deleteAuthUser(viewer.userId)
  } catch (error) {
    Sentry.captureException(error)
    return "failed"
  }
  return "deleted"
}

// ── Agenda y anulaciones tardías (F6, solo administración) ──────────────────────────────────────────────

/** «Hoy»: sesiones del día y las primeras anulaciones tardías pendientes (con el total) */
export async function getAdminToday(lateLimit: number) {
  await requireArea("admin")
  const db = getDb()
  const today = toDateKey(new Date())
  const [daySessions, late, lateCount] = await Promise.all([
    agenda.listSessionsBetween(db, today, today),
    agenda.listPendingLateCancellations(db, lateLimit),
    agenda.countPendingLateCancellations(db),
  ])
  return { today, sessions: daySessions, late, lateCount }
}

export async function listLateCancellationsForAdmin() {
  await requireArea("admin")
  return agenda.listPendingLateCancellations(getDb())
}

/** El id de la reserva llega del navegador: se valida en la capa de datos. Queda anotado quién decidió */
export async function decideLateCancellation(bookingId: unknown, charge: boolean) {
  const viewer = await requireArea("admin")
  return agenda.decideLateCancellation(getDb(), viewer.userId, bookingId, charge)
}
