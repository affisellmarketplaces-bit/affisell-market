/* Affisell service worker — Web Push + buyer catalog offline shell */

const CACHE_VERSION = "affisell-buyer-v1"
const SHELL_CACHE = `${CACHE_VERSION}-shell`
const CATALOG_CACHE = `${CACHE_VERSION}-catalog`
const PRECACHE_URLS = [
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/placeholder-product.jpg",
]
const CATALOG_API_PATH = "/api/marketplace/products"
const OFFLINE_NAV_PREFIXES = ["/", "/marketplace", "/cart", "/wishlist"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("affisell-buyer-") && key !== SHELL_CACHE && key !== CATALOG_CACHE
          )
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith(CATALOG_API_PATH)) {
    event.respondWith(staleWhileRevalidate(request, CATALOG_CACHE))
    return
  }

  if (request.mode === "navigate") {
    const isBuyerShell = OFFLINE_NAV_PREFIXES.some(
      (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
    )
    if (isBuyerShell) {
      event.respondWith(networkFirstNavigation(request))
    }
  }
})

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const network = await fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone())
      return response
    })
    .catch(() => null)

  if (network) return network
  if (cached) return cached

  return new Response(JSON.stringify({ products: [], offline: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) void cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    const offline = await cache.match("/offline")
    if (offline) return offline
    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }
}

self.addEventListener("push", (event) => {
  let payload = { title: "Affisell", body: "", url: "/", tag: "affisell-notification" }
  try {
    payload = { ...payload, ...(event.data?.json() ?? {}) }
  } catch {
    /* ignore malformed payload */
  }

  const targetUrl = payload.url.startsWith("http")
    ? payload.url
    : new URL(payload.url || "/", self.location.origin).href

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: targetUrl },
      tag: payload.tag || "affisell-notification",
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const raw = event.notification.data?.url || "/"
  const target = raw.startsWith("http") ? raw : new URL(raw, self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && client.url.includes(target)) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target)
      }
      return undefined
    })
  )
})
