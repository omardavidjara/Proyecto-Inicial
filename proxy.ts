// Comprobación optimista (ARCHITECTURE §6, guía de autenticación de Next 16): sin sesión → /login.
// La protección real está en lib/dal.ts; esto solo evita renderizar páginas privadas sin sesión.
// El middleware de Neon Auth valida la cookie de sesión firmada (en local, sin red, durante 5 min),
// la renueva cuando caduca y completa el regreso del inicio de sesión con Google.
import { NextResponse, type NextRequest } from "next/server"

import { getAuth } from "@/lib/auth"
import { isPublicPath, LOGIN_PATH } from "@/lib/roles"

/** Parámetro con el que Neon Auth vuelve tras el inicio de sesión con Google */
const OAUTH_VERIFIER_PARAM = "neon_auth_session_verifier"

export default async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  if (isPublicPath(pathname) && !searchParams.has(OAUTH_VERIFIER_PARAM)) return NextResponse.next()
  return getAuth().middleware({ loginUrl: LOGIN_PATH })(request)
}

export const config = {
  // Fuera: la pasarela de Neon Auth y demás API, los recursos de Next y los archivos con extensión
  // (sw.js, manifest, iconos, logo). Las páginas públicas se filtran arriba.
  matcher: ["/((?!api/|_next/static|_next/image|.*\.[a-zA-Z0-9]+$).*)"],
}
