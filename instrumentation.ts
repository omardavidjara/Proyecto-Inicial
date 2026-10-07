// Sentry en el servidor (Node y Edge). Opciones y reglas de privacidad: lib/sentry.ts
import * as Sentry from "@sentry/nextjs"

import { sentryOptions } from "@/lib/sentry"

export function register() {
  Sentry.init(sentryOptions)
}

// Errores de Server Components, Route Handlers, Server Actions y proxy
export const onRequestError = Sentry.captureRequestError
