// Sentry en el navegador, antes de que la app sea interactiva. Opciones y privacidad: lib/sentry.ts
// Sin Session Replay (no graba la pantalla de nadie).
import * as Sentry from "@sentry/nextjs"

import { sentryOptions } from "@/lib/sentry"

Sentry.init(sentryOptions)

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
