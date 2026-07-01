"use client"

import { PUSH_SW_PATH, urlBase64ToUint8Array } from "@/lib/push-subscribe-shared"

const SW_PATH = PUSH_SW_PATH

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null
  try {
    return await navigator.serviceWorker.register(SW_PATH, { scope: "/" })
  } catch {
    return null
  }
}

/** Opt-in Web Push after a wishlist / price alert save (logged-in buyers). */
export async function requestPriceAlertPushSubscription(): Promise<"granted" | "denied" | "unsupported"> {
  if (typeof window === "undefined") return "unsupported"
  if (!("Notification" in window) || !("PushManager" in window)) return "unsupported"

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  if (!publicKey) return "unsupported"

  let permission = Notification.permission
  if (permission === "default") {
    permission = await Notification.requestPermission()
  }
  if (permission !== "granted") return "denied"

  const registration = await registerServiceWorker()
  if (!registration) return "unsupported"

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  const json = subscription.toJSON()
  const endpoint = json.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!endpoint || !p256dh || !auth) return "unsupported"

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: { endpoint, keys: { p256dh, auth } } }),
  })

  return res.ok ? "granted" : "denied"
}

/** Unsubscribe browser push + remove server-side endpoints for this device. */
export async function disablePushNotifications(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false

  const registration = await navigator.serviceWorker.getRegistration(SW_PATH)
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return true

  const endpoint = subscription.endpoint
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => undefined)

  return subscription.unsubscribe()
}
