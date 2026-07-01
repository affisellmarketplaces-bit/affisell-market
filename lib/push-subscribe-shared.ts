/// URL-safe base64 → Uint8Array for PushManager.subscribe applicationServerKey.
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const output = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

export type PushSubscribeJson = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export function parsePushSubscribeJson(raw: unknown): PushSubscribeJson | null {
  if (!raw || typeof raw !== "object") return null
  const sub = raw as Record<string, unknown>
  const endpoint = typeof sub.endpoint === "string" ? sub.endpoint.trim() : ""
  const keys = sub.keys as Record<string, unknown> | undefined
  const p256dh = typeof keys?.p256dh === "string" ? keys.p256dh.trim() : ""
  const auth = typeof keys?.auth === "string" ? keys.auth.trim() : ""
  if (!endpoint || !p256dh || !auth) return null
  return { endpoint, keys: { p256dh, auth } }
}
