// Opciones de Sentry comunes al servidor y al navegador (instrumentation.ts e instrumentation-client.ts).
// Plan Developer (LIMITS, Sentry): 5 000 errores y 5 M de spans al mes, sin Session Replay.
// Privacidad (/privacidad §5): sin datos personales (ni IP, ni cookies, ni cabeceras, ni cuerpos, ni datos de
// consultas): el SDK v11 los recoge por defecto, así que `dataCollection` lo apaga todo. Además,
// solo se activa con NEXT_PUBLIC_SENTRY_DSN y en el build de producción (local y tests no envían nada).
import type { BrowserOptions } from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

export const sentryOptions = {
  dsn,
  enabled: Boolean(dsn) && process.env.NODE_ENV === "production",
  // production o preview en Vercel; "local" en un build hecho en el ordenador
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "local",
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    stackFrameVariables: false,
    queues: false,
    genAI: { inputs: false, outputs: false },
    graphQL: { document: false, variables: false },
  },
  tracesSampleRate: 0.1,
  // Ruido que no es de la app: extensiones del navegador, cancelaciones de red, avisos de ResizeObserver
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "AbortError",
    "Load failed",
    "Failed to fetch",
    "NetworkError when attempting to fetch resource.",
  ],
  denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-(web-)?extension:\/\//],
  beforeSend(event) {
    // Defensa extra por si una integración los añade: del usuario solo el id; ni cookies ni cabeceras
    if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined
    if (event.request) {
      delete event.request.cookies
      delete event.request.headers
    }
    return event
  },
} satisfies BrowserOptions
