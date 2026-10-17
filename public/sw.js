// Service worker de Athlos (docs/DESIGN.md §6).
// Básico: página sin conexión, caché de recursos estáticos con hash y avisos push (F10).
// Las páginas con datos personales NO se guardan aquí todavía: la lectura sin conexión
// de "Mis reservas" llegará con F5 y deberá borrarse al cerrar sesión.
const VERSION = "v2"
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

// Avisos push (F10): el servidor envía { title, body, url } cifrado; solo este navegador puede leerlo
self.addEventListener("push", (event) => {
  let message = {}
  try {
    message = event.data ? event.data.json() : {}
  } catch {
    // Un aviso sin JSON válido muestra el texto genérico
  }
  const url = typeof message.url === "string" && message.url.startsWith("/") && !message.url.startsWith("//") ? message.url : "/"
  event.waitUntil(
    self.registration.showNotification(message.title || "Athlos", {
      body: message.body || "Tienes un aviso nuevo del gimnasio.",
      icon: "/icons/icon-192.png",
      lang: "es",
      data: { url },
    })
  )
})

// Al tocar el aviso: si la app ya está abierta, se lleva ahí; si no, se abre en esa pantalla
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (open) return open.focus().then((client) => client.navigate(target)).catch(() => self.clients.openWindow(target))
      return self.clients.openWindow(target)
    })
  )
})

async function trim(cache) {
  const keys = await cache.keys()
  const isPrecached = (request) => PRECACHE.includes(new URL(request.url).pathname)
  const excess = keys.filter((request) => !isPrecached(request)).slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES))
  await Promise.all(excess.map((request) => cache.delete(request)))
}
