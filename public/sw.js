// Service worker de Athlos (docs/DESIGN.md §6).
// Básico: página sin conexión y caché de recursos estáticos con hash.
// Las páginas con datos personales NO se guardan aquí todavía: la lectura sin conexión
// de "Mis reservas" llegará con F5 y deberá borrarse al cerrar sesión.
const VERSION = "v1"
const STATIC_CACHE = `athlos-static-${VERSION}`
const OFFLINE_URL = "/offline"
const PRECACHE = [OFFLINE_URL, "/logo.png", "/icons/icon-192.png"]
// Cada despliegue genera ficheros con hash nuevos: se guardan como mucho estos, borrando los más antiguos
const MAX_STATIC_ENTRIES = 150

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      // "reload": saltarse la caché HTTP para guardar siempre la versión actual
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("athlos-") && key !== STATIC_CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navegación: siempre red; sin conexión, la página /offline
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  // JS/CSS de Next con hash en el nombre: inmutables, primero caché
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy).then(() => trim(cache)))
            }
            return response
          })
      )
    )
  }
})

async function trim(cache) {
  const keys = await cache.keys()
  const isPrecached = (request) => PRECACHE.includes(new URL(request.url).pathname)
  const excess = keys.filter((request) => !isPrecached(request)).slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES))
  await Promise.all(excess.map((request) => cache.delete(request)))
}
