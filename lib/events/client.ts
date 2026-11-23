/**
 * Browser side of the conversion events (S3). NOT WIRED: no page imports it yet (step S4 needs the founder's go).
 *
 * Two locks, both required before anything leaves the browser:
 *  1. `NEXT_PUBLIC_CONVERSION_EVENTS_MODE` must be exactly "on" (inlined at build time; absent = off);
 *  2. the visitor's analytics consent (same reading as the cookie banner), checked at EVERY emit and every flush.
 * No consent = nothing queued, no identifier created. Withdrawing consent empties the queue and deletes the tab's
 * session id. The only identifier is a random id kept in `sessionStorage` (gone when the tab closes) — enough to
 * count unique views per listing (founder decision D4: aggregated measurement, no visitor-to-order journey).
 */
import { hasAnalyticsConsent } from "@/lib/legal/cookie-consent-runtime"

export type ConversionEventName = "product_view" | "add_to_cart" | "remove_from_cart" | "product_click"

export type ConversionEventPayload = {
  listingId?: string
  productId?: string
  properties?: Record<string, string | number | boolean>
}

const SESSION_KEY = "affisell:ev-session"
const ENDPOINT = "/api/events"
const MAX_QUEUE = 20
const FLUSH_MS = 4_000

type QueuedEvent = { eventId: string; name: ConversionEventName; clientTs: number; sessionId: string } & ConversionEventPayload

let queue: QueuedEvent[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let listening = false

export function conversionEventsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CONVERSION_EVENTS_MODE === "on"
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16))
}

function sessionId(): string | null {
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = randomId()
      window.sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

/** Forget everything (consent withdrawn): queue emptied, the tab's id deleted. */
export function forgetConversionEvents(): void {
  queue = []
  if (timer) clearTimeout(timer)
  timer = null
  try {
    window.sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* storage unavailable: nothing was kept */
  }
}

function listenForConsentChanges(): void {
  if (listening || typeof window === "undefined") return
  listening = true
  window.addEventListener("affisell:cookie-consent", (ev) => {
    const prefs = (ev as CustomEvent<{ analytics?: boolean }>).detail
    if (prefs?.analytics !== true) forgetConversionEvents()
  })
}

export function flushConversionEvents(): void {
  if (timer) clearTimeout(timer)
  timer = null
  if (queue.length === 0) return
  if (!conversionEventsEnabled() || !hasAnalyticsConsent()) {
    forgetConversionEvents()
    return
  }
  const batch = queue.slice(0, MAX_QUEUE)
  queue = queue.slice(MAX_QUEUE)
  const body = JSON.stringify({ events: batch })
  try {
    const sent = typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
      ? navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))
      : false
    if (!sent) void fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "same-origin" }).catch(() => {})
  } catch {
    /* analytics must never break a page */
  }
  if (queue.length > 0) flushConversionEvents()
}

/** Queues one event — or does nothing at all when either lock is closed. Returns whether it was queued. */
export function emitConversionEvent(name: ConversionEventName, payload: ConversionEventPayload = {}): boolean {
  if (typeof window === "undefined" || !conversionEventsEnabled() || !hasAnalyticsConsent()) return false
  listenForConsentChanges()
  const sid = sessionId()
  if (!sid) return false
  queue.push({ eventId: randomId(), name, clientTs: Date.now(), sessionId: sid, ...payload })
  if (queue.length >= MAX_QUEUE) flushConversionEvents()
  else if (!timer) timer = setTimeout(flushConversionEvents, FLUSH_MS)
  return true
}
