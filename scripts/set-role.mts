// Asigna rol y activa una cuenta desde la terminal (ARCHITECTURE §2: el rol `developer` se asigna a mano
// una sola vez, nunca desde la UI). Lo demás (aprobar clientes, entrenadores) se hará desde la app (F1, F11).
//
//   npm run db:set-role -- correo@ejemplo.com developer
//
// La persona tiene que haber entrado al menos una vez (para existir en Neon Auth).
// Usa DATABASE_URL_UNPOOLED de .env.local: la base de datos en la que se ejecute es la que cambia.
import { neon } from "@neondatabase/serverless"
import { z } from "zod"

const ROLES = ["developer", "admin", "coach", "client"] as const

const args = z
  .tuple([z.email().trim().toLowerCase(), z.enum(ROLES)])
  .safeParse(process.argv.slice(2))
if (!args.success) {
  console.error(`Uso: npm run db:set-role -- <correo> <${ROLES.join("|")}>`)
  process.exit(1)
}
const [email, role] = args.data

const url = process.env.DATABASE_URL_UNPOOLED
if (!url) {
  console.error("Falta DATABASE_URL_UNPOOLED en .env.local")
  process.exit(1)
}
const sql = neon(url)

// neon_auth solo se lee: lo gestiona Neon Auth
const users = await sql`select id, name from neon_auth."user" where lower(email) = ${email}`
if (users.length === 0) {
  console.error(`No hay ninguna cuenta con el correo ${email}. Inicia sesión en la app al menos una vez.`)
  process.exit(1)
}
const user = users[0] as { id: string; name: string | null }

// Entrenador siempre imparte clases; cliente nunca; admin y desarrollador conservan su marca
const coachFlag = role === "coach" ? "true" : role === "client" ? "false" : null
const fullName = user.name?.trim() || email.split("@")[0]

const [profile] = await sql`
  insert into profiles (user_id, full_name, role, is_coach, status, approved_at)
  values (${user.id}, ${fullName}, ${role}, coalesce(${coachFlag}::boolean, false), 'active', now())
  on conflict (user_id) do update set
    role = excluded.role,
    is_coach = coalesce(${coachFlag}::boolean, profiles.is_coach),
    status = 'active',
    approved_at = coalesce(profiles.approved_at, now()),
    deactivated_at = null,
    updated_at = now()
  returning full_name, role, is_coach, status`
console.log(`Listo: ${profile.full_name} → ${profile.role}${profile.is_coach ? " (imparte clases)" : ""}, ${profile.status}`)
