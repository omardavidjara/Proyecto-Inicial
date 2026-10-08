// Pasarela hacia Neon Auth: el navegador habla con nuestro dominio y las cookies de sesión son propias.
// Solo deja pasar las rutas de lib/auth-gateway.ts; el resto responde 404 sin llegar a Neon Auth.
import { getAuth } from "@/lib/auth"
import { isAllowedAuthPath } from "@/lib/auth-gateway"

type Context = { params: Promise<{ path: string[] }> }

const notFound = () => new Response(null, { status: 404 })

export async function GET(request: Request, context: Context) {
  if (!isAllowedAuthPath("GET", (await context.params).path)) return notFound()
  return getAuth().handler().GET(request, context)
}

export async function POST(request: Request, context: Context) {
  if (!isAllowedAuthPath("POST", (await context.params).path)) return notFound()
  return getAuth().handler().POST(request, context)
}
