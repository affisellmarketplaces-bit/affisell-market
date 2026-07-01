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
