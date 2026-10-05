// Pasarela hacia Neon Auth: el navegador habla con nuestro dominio y las cookies de sesión son propias.
import { getAuth } from "@/lib/auth"

type Context = { params: Promise<{ path: string[] }> }

export function GET(request: Request, context: Context) {
  return getAuth().handler().GET(request, context)
}

export function POST(request: Request, context: Context) {
  return getAuth().handler().POST(request, context)
}
