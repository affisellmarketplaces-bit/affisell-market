/**
 * « Prévenez-moi au retour de cette taille » (founder brief 2026-11-19 §3) — the pure rules. Client-safe, no I/O.
 *
 * A watch is ONE buyer × ONE listing × ONE exact variant (colour, size, capacity — the shared variant rule of
 * `lib/variant-selection.ts`, never « the product »). It is created only by an explicit request of a signed-in buyer,
 * only for a variant that is sold out at that moment, and it notifies AT MOST ONCE per request (« episode »): a buyer
 * who wants to be told again asks again. Nothing here promises a date — Affisell records no restock date anywhere.
 *
 * Mode `RESTOCK_WATCH_MODE` (read per call):
 *  - `off` (DEFAULT): nothing is shown, nothing runs;
 *  - `observe`: buyers can ask (the page says the alerts are not switched on yet), the daily run measures what it
 *    WOULD send and closes requests that became useless — nothing is sent;
 *  - `enforce`: the run sends ONE Web Push per request when the variant is really back (founder decision).
 */
import { variantRowDimensions, type VariantRowDims } from "@/lib/variant-selection"

export type RestockWatchMode = "off" | "observe" | "enforce"

export function readRestockWatchMode(raw: string | null | undefined = process.env.RESTOCK_WATCH_MODE): RestockWatchMode {
  const v = (raw ?? "").trim().toLowerCase()
  return v === "observe" || v === "enforce" ? v : "off"
}

export const RESTOCK_WATCH_ACTION = "buyer.restock_watch"
export const RESTOCK_WATCH_SENT_ACTION = "buyer.restock_watch_sent"
export const RESTOCK_WATCH_OBSERVATION_ACTION = "buyer.restock_watch_observation"
/** A request older than this is closed as expired (the buyer has moved on; nothing is kept forever). */
export const RESTOCK_WATCH_TTL_DAYS = 90
/** Anti-abuse: active requests per buyer. */
export const RESTOCK_WATCH_MAX_ACTIVE = 50

const DAY = 86_400_000

/** Short stable hash of a variant key (ids only — never used to compare variants). */
export function variantKeyHash(variantKey: string): string {
  return fnv(variantKey)
}

function fnv(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

/** The exact variant, as the shared rule reads it (normalised colour, size, capacity and any unnamed part). */
export function variantWatchKey(d: VariantRowDims): string {
  return [d.color, d.size, d.storage, d.other].join("|")
}

/** One id per buyer × listing × variant: a second request for the same variant is the SAME request (no duplicate). */
export function restockWatchId(userId: string, listingId: string, variantKey: string): string {
  return `restock-watch:${userId}:${listingId}:${fnv(variantKey)}`
}

/** Claimed BEFORE sending: one notification per request episode, whatever runs concurrently. */
export function restockWatchSentId(watchId: string, episode: number): string {
  return `${watchId}:sent:${episode}`
}

/**
 * Observe mode: one marker per request episode the FIRST time it would have been sent — a DIFFERENT id from the real
 * send claim, so observing never uses up a future notification. The markers created on a day = exactly the pushes
 * `enforce` would have sent that day (theoretical, never a sent notification).
 */
export function restockWatchObservedId(watchId: string, episode: number): string {
  return `${watchId}:observed:${episode}`
}
export const RESTOCK_WATCH_OBSERVED_ACTION = "buyer.restock_watch_observed"

export function restockWatchObservationId(now: Date): string {
  return `restock-watch-observation:${now.toISOString().slice(0, 10)}`
}

export type RestockWatchState = "active" | "notified" | "cancelled" | "expired" | "closed"

export type RestockWatch = {
  userId: string
  listingId: string
  productId: string
  variantKey: string
  /** What the buyer chose, as shown to them (never used to match — the key is). */
  variantLabel: string
  locale: string
  state: RestockWatchState
  episode: number
  requestedAt: string
  updatedAt: string
  closedReason?: "variant_removed" | "listing_removed" | "expired" | "cancelled_by_buyer" | null
  notifiedAt?: string | null
}

const STATES = new Set<RestockWatchState>(["active", "notified", "cancelled", "expired", "closed"])

export function parseRestockWatch(raw: unknown): RestockWatch | null {
  if (!raw || typeof raw !== "object") return null
  const p = raw as Record<string, unknown>
  const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "")
  const state = str("state") as RestockWatchState
  if (!str("userId") || !str("listingId") || !str("variantKey") || !STATES.has(state)) return null
  const episode = Number(p.episode)
  return {
    userId: str("userId"),
    listingId: str("listingId"),
    productId: str("productId"),
    variantKey: str("variantKey"),
    variantLabel: str("variantLabel").slice(0, 120),
    locale: str("locale") || "fr",
    state,
    episode: Number.isInteger(episode) && episode > 0 ? episode : 1,
    requestedAt: str("requestedAt"),
    updatedAt: str("updatedAt"),
    closedReason: (str("closedReason") || null) as RestockWatch["closedReason"],
    notifiedAt: str("notifiedAt") || null,
  }
}

/** Where the watched variant is today: exactly one row with that key, none (removed) or several (can not tell). */
export type WatchedVariant = { status: "found"; index: number; stock: number } | { status: "gone" } | { status: "ambiguous" }

export function locateWatchedVariant(rows: unknown, customColumns: unknown, variantKey: string): WatchedVariant {
  const dims = variantRowDimensions(rows, customColumns)
  const hits = dims.map((d, i) => (variantWatchKey(d) === variantKey ? i : -1)).filter((i) => i >= 0)
  if (hits.length === 0) return { status: "gone" }
  if (hits.length > 1) return { status: "ambiguous" }
  const raw = (rows as { variantRows?: Array<{ stock?: unknown }> } | null)?.variantRows?.[hits[0]!]
  const n = Number(raw?.stock)
  return { status: "found", index: hits[0]!, stock: Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0 }
}

export type RestockDecision =
  | { action: "notify" }
  | { action: "keep"; reason: "still_sold_out" | "not_sellable" | "ambiguous_variant" | "not_listed" }
  | { action: "close"; reason: "variant_removed" | "listing_removed" | "expired" }
  | { action: "skip" }

/**
 * What to do with one request today. « Back » means REALLY buyable: the listing exists and is listed, the product is
 * sellable for every other reason (published, on sale, reviewed, explicit commission — `listingProblem`), and the
 * watched variant — found unambiguously under the shared rule — has stock > 0. Anything uncertain keeps the request
 * waiting: an uncertain availability is never announced.
 */
export function decideRestockWatch(args: {
  watch: RestockWatch
  now: Date
  listing: { exists: boolean; listed: boolean; sellable: boolean } | null
  variant: WatchedVariant | null
}): RestockDecision {
  const { watch } = args
  if (watch.state !== "active") return { action: "skip" }
  const since = Date.parse(watch.requestedAt)
  if (Number.isFinite(since) && args.now.getTime() - since > RESTOCK_WATCH_TTL_DAYS * DAY) return { action: "close", reason: "expired" }
  if (!args.listing || !args.listing.exists) return { action: "close", reason: "listing_removed" }
  if (!args.variant || args.variant.status === "gone") return { action: "close", reason: "variant_removed" }
  if (args.variant.status === "ambiguous") return { action: "keep", reason: "ambiguous_variant" }
  if (!args.listing.listed) return { action: "keep", reason: "not_listed" }
  if (!args.listing.sellable) return { action: "keep", reason: "not_sellable" }
  if (args.variant.stock <= 0) return { action: "keep", reason: "still_sold_out" }
  return { action: "notify" }
}

export type RestockWatchObservation = {
  day: string
  mode: RestockWatchMode
  /** Active requests read by this run, distinct buyers among them, distinct exact variants (listing × variant). */
  active: number
  activeBuyers: number
  activeVariants: number
  /** Requests whose variant is really back at this run (theoretical: not a sent notification). */
  wouldNotify: number
  /** Of them, first time seen back (observe: observed markers created) = what `enforce` would have sent now. */
  wouldNotifyNew: number
  /** Pushes REALLY handed to Web Push by this run (enforce only; always 0 otherwise). */
  notified: number
  /** Would notify, but the buyer has no push subscription left: nothing could be sent. */
  noChannel: number
  raced: number
  closed: Record<string, number>
  kept: Record<string, number>
}

export type RestockObservationDay = {
  day: string
  /** Snapshot of the day's first run (counts only), or null when no run recorded that day. */
  snapshot: Pick<RestockWatchObservation, "mode" | "active" | "activeBuyers" | "activeVariants"> | null
  /** Theoretical: requests seen back for the first time that day (observe markers). */
  wouldNotifyNew: number
  /** Real: send claims taken that day (enforce). Never added to the theoretical count. */
  sent: number
}

export type RestockObservationReport = {
  days: RestockObservationDay[]
  totals: { wouldNotifyNew: number; sent: number }
  reading: "no_data" | "too_few_days" | "observed"
}

/** Admin reading of the measurements. Theoretical and real counts are two separate columns, never summed. */
export function summarizeRestockObservations(args: {
  snapshots: ReadonlyArray<{ day: string; payload: unknown }>
  observedMarkerDays: ReadonlyArray<string>
  sentClaimDays: ReadonlyArray<string>
}): RestockObservationReport {
  const byDay = new Map<string, RestockObservationDay>()
  const day = (d: string) => {
    const cur = byDay.get(d) ?? { day: d, snapshot: null, wouldNotifyNew: 0, sent: 0 }
    byDay.set(d, cur)
    return cur
  }
  for (const s of args.snapshots) {
    const p = (s.payload ?? {}) as Partial<RestockWatchObservation>
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0)
    day(s.day).snapshot = {
      mode: p.mode === "observe" || p.mode === "enforce" ? p.mode : "off",
      active: n(p.active),
      activeBuyers: n(p.activeBuyers),
      activeVariants: n(p.activeVariants),
    }
  }
  for (const d of args.observedMarkerDays) day(d).wouldNotifyNew++
  for (const d of args.sentClaimDays) day(d).sent++
  const days = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
  const totals = days.reduce((t, d) => ({ wouldNotifyNew: t.wouldNotifyNew + d.wouldNotifyNew, sent: t.sent + d.sent }), { wouldNotifyNew: 0, sent: 0 })
  const recorded = days.filter((d) => d.snapshot !== null).length
  return { days, totals, reading: recorded === 0 ? "no_data" : recorded < 7 ? "too_few_days" : "observed" }
}
