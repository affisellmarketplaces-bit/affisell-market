/**
 * `properties` is the extension bag of an event — and the place where personal data would leak if it were free-form.
 * So it is NOT free-form: each event name lists the keys it may carry, each key has ONE sanitizer, and anything else is
 * dropped (the value, never the event). Adding a field later = adding a key here, not a migration.
 *
 * Client-safe (no Prisma).
 */
import type { EventName } from "@/lib/events/names"
import {
  sanitizeId,
  sanitizeInt,
  sanitizeSearchQuery,
  sanitizeSlug,
  sanitizeUtm,
} from "@/lib/events/sanitize"

type Sanitizer = (value: unknown) => string | number | boolean | null

const enumOf = (allowed: readonly string[]): Sanitizer => (value) =>
  typeof value === "string" && allowed.includes(value.trim().toLowerCase()) ? value.trim().toLowerCase() : null

const HOST_RE = /^[a-z0-9]([a-z0-9.-]{0,98}[a-z0-9])?$/

const PROPERTY_SANITIZERS = {
  // where / what
  surface: sanitizeSlug,
  position: (v) => sanitizeInt(v, 0, 10_000),
  seq: (v) => sanitizeInt(v, 0, 100_000),
  device: enumOf(["mobile", "tablet", "desktop"]),
  // search
  search_id: sanitizeId,
  query: sanitizeSearchQuery,
  result_count: (v) => sanitizeInt(v, 0, 1_000_000),
  scope_category: sanitizeId,
  // acquisition (the click identifier itself is never accepted — only the platform it points to)
  utm_source: sanitizeUtm,
  utm_medium: sanitizeUtm,
  utm_campaign: sanitizeUtm,
  utm_content: sanitizeUtm,
  referrer_host: (v) => (typeof v === "string" && HOST_RE.test(v.trim().toLowerCase()) ? v.trim().toLowerCase() : null),
  content_id: sanitizeId,
  landing_kind: enumOf(["store", "listing", "bubble", "home", "other"]),
  click_platform: enumOf(["google_ads", "meta", "tiktok", "other"]),
  // cart
  mode: enumOf(["server", "guest"]),
  quantity: (v) => sanitizeInt(v, 1, 99),
  // money (facts already stored on the order; carried so a funnel needs no join)
  amount_cents: (v) => sanitizeInt(v, 0, 100_000_000),
  currency: (v) => (typeof v === "string" && /^[A-Za-z]{3}$/.test(v.trim()) ? v.trim().toUpperCase() : null),
  stripe_session_id: (v) => (typeof v === "string" && /^[A-Za-z0-9_:.-]{8,255}$/.test(v.trim()) ? v.trim() : null),
  // outcomes
  reason_code: (v) => (typeof v === "string" && /^[A-Z][A-Z0-9_]{1,39}$/.test(v.trim()) ? v.trim() : null),
  outcome: sanitizeSlug,
  rating: (v) => sanitizeInt(v, 1, 5),
  delivered_at_source: sanitizeSlug,
} satisfies Record<string, Sanitizer>

export type PropertyKey = keyof typeof PROPERTY_SANITIZERS

/** Which keys each event may carry. Anything not listed for an event is dropped. */
export const EVENT_PROPERTY_KEYS: Record<EventName, readonly PropertyKey[]> = {
  product_impression: ["surface", "position", "search_id", "device", "seq"],
  product_click: ["surface", "position", "search_id", "device", "seq"],
  product_view: ["surface", "search_id", "device", "seq"],
  search: ["search_id", "query", "result_count", "scope_category", "surface", "device", "seq"],
  attribution_touch: [
    "utm_source", "utm_medium", "utm_campaign", "utm_content",
    "referrer_host", "content_id", "landing_kind", "click_platform", "device",
  ],
  add_to_cart: ["surface", "mode", "quantity", "device", "seq"],
  remove_from_cart: ["surface", "mode", "quantity", "seq"],
  checkout_started: ["surface", "amount_cents", "currency", "quantity", "stripe_session_id", "device"],
  creator_share: ["surface", "content_id"],
  view: [],
  hover: [],
  checkout_initiated: [],
  purchase: ["amount_cents", "currency", "quantity", "stripe_session_id"],
  refund: ["amount_cents", "currency", "reason_code"],
  return_requested: ["reason_code"],
  return_resolved: ["outcome", "reason_code"],
  review_created: ["rating", "outcome"],
  delivery: ["delivered_at_source"],
  creator_product_added: ["surface"],
  creator_product_removed: ["surface"],
}

/** The cleaned bag, or `null` when nothing valid is left (so the column stays empty instead of holding `{}`). */
export function sanitizeProperties(name: EventName, raw: unknown): Record<string, string | number | boolean> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const input = raw as Record<string, unknown>
  const out: Record<string, string | number | boolean> = {}
  for (const key of EVENT_PROPERTY_KEYS[name]) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue
    const clean = PROPERTY_SANITIZERS[key](input[key])
    if (clean !== null) out[key] = clean
  }
  return Object.keys(out).length > 0 ? out : null
}
