/**
 * Daily aggregates of conversion events and the 90-day purge plan (step S6; founder decisions D3 + D4, 2026-11-23).
 * Pure — no Prisma. Nothing here is scheduled or wired.
 *
 * Aggregates = per LISTING × UTC day: views, unique views (distinct tab sessions), add / remove from cart, checkouts
 * started. They hold COUNTS only — no session id, no account id — so they can outlive the raw rows.
 * Guards against miscounting:
 *  - a view is counted once per session × listing × 30 minutes (reloads and back-navigation do not inflate it);
 *  - events for a listing that does not exist are set apart (`unknownListing`), never counted;
 *  - a session that sends more than SESSION_DAILY_CAP events in a day is excluded whole (`excludedSessions`) — a
 *    scripted burst never reaches a listing's figures;
 *  - figures under the publication floors are not shown (`publishable*`).
 * Purge (D3): raw rows older than 90 days are deleted ONLY for days whose aggregates are stored; a day that is not
 * aggregated is BLOCKED, never deleted. Verifiable: before / after counts per day must show 0 rows left.
 */
export const RAW_RETENTION_DAYS = 90
export const VIEW_DEDUP_MS = 30 * 60_000
export const SESSION_DAILY_CAP = 300
/** Below this, unique views are hidden (a small number can single a person out). */
export const MIN_PUBLISHABLE_UNIQUE_VIEWS = 5
/** Below this many measured views, no « orders per 100 measured views » is shown. */
export const MIN_VIEWS_FOR_RATIO = 100

export type RawEventRow = {
  eventType: string
  listingId: string | null
  sessionId: string | null
  /** `occurredAt` for spine rows, `createdAt` for legacy rows. */
  at: Date
}

export type DailyListingAggregate = {
  day: string
  listingId: string
  views: number
  uniqueViews: number
  addToCart: number
  removeFromCart: number
  checkoutsStarted: number
}

export type AggregationResult = {
  aggregates: DailyListingAggregate[]
  unknownListing: number
  noListing: number
  excludedSessions: number
  excludedEvents: number
}

export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const VIEW_TYPES = new Set(["product_view", "view"])

/**
 * Aggregates one batch of raw rows. `knownListingIds` = listings that exist (an id the browser invented is ignored).
 */
export function aggregateDailyListingEvents(rows: readonly RawEventRow[], knownListingIds: ReadonlySet<string>): AggregationResult {
  const perSessionDay = new Map<string, number>()
  for (const r of rows) {
    if (!r.sessionId) continue
    const k = `${r.sessionId}|${utcDay(r.at)}`
    perSessionDay.set(k, (perSessionDay.get(k) ?? 0) + 1)
  }
  const excluded = new Set([...perSessionDay].filter(([, n]) => n > SESSION_DAILY_CAP).map(([k]) => k))

  const out = new Map<string, DailyListingAggregate & { sessions: Set<string> }>()
  const lastView = new Map<string, number>()
  let unknownListing = 0
  let noListing = 0
  let excludedEvents = 0

  const sorted = [...rows].sort((a, b) => a.at.getTime() - b.at.getTime())
  for (const r of sorted) {
    const day = utcDay(r.at)
    if (r.sessionId && excluded.has(`${r.sessionId}|${day}`)) {
      excludedEvents += 1
      continue
    }
    if (!r.listingId) {
      noListing += 1
      continue
    }
    if (!knownListingIds.has(r.listingId)) {
      unknownListing += 1
      continue
    }
    const key = `${day}|${r.listingId}`
    let agg = out.get(key)
    if (!agg) {
      agg = { day, listingId: r.listingId, views: 0, uniqueViews: 0, addToCart: 0, removeFromCart: 0, checkoutsStarted: 0, sessions: new Set() }
      out.set(key, agg)
    }
    if (VIEW_TYPES.has(r.eventType)) {
      if (r.sessionId) {
        const vk = `${r.sessionId}|${r.listingId}`
        const prev = lastView.get(vk)
        if (prev !== undefined && r.at.getTime() - prev < VIEW_DEDUP_MS) continue
        lastView.set(vk, r.at.getTime())
        agg.sessions.add(r.sessionId)
      }
      agg.views += 1
    } else if (r.eventType === "add_to_cart") agg.addToCart += 1
    else if (r.eventType === "remove_from_cart") agg.removeFromCart += 1
    else if (r.eventType === "checkout_started" || r.eventType === "checkout_initiated") agg.checkoutsStarted += 1
  }

  const aggregates = [...out.values()]
    .map(({ sessions, ...a }) => ({ ...a, uniqueViews: sessions.size }))
    .sort((a, b) => (a.day === b.day ? a.listingId.localeCompare(b.listingId) : a.day.localeCompare(b.day)))
  const excludedSessions = new Set([...excluded].map((k) => k.split("|")[0])).size
  return { aggregates, unknownListing, noListing, excludedSessions, excludedEvents }
}

/** Unique views as they may be SHOWN: null under the floor (never a figure that isolates one person). */
export function publishableUniqueViews(n: number): number | null {
  return n >= MIN_PUBLISHABLE_UNIQUE_VIEWS ? n : null
}

/**
 * « Orders per 100 measured views » — never called a conversion rate: views only cover visitors who accepted
 * analytics, orders cover everyone, so the absolute value is biased upwards; only comparisons between listings or
 * periods are meaningful. null below MIN_VIEWS_FOR_RATIO views.
 */
export function ordersPer100MeasuredViews(orders: number, measuredViews: number): number | null {
  if (!Number.isFinite(orders) || !Number.isFinite(measuredViews) || measuredViews < MIN_VIEWS_FOR_RATIO) return null
  return Math.round((orders / measuredViews) * 10_000) / 100
}

export type PurgePlan = {
  /** Raw rows strictly before this instant are past retention. */
  cutoff: Date
  /** Past-retention days whose aggregates exist: may be purged. */
  purgeable: string[]
  /** Past-retention days with raw rows but NO stored aggregates: kept, reported. */
  blocked: string[]
}

/**
 * Which past-retention days may be deleted. `rawDays` = days that still hold raw rows; `aggregatedDays` = days whose
 * aggregates are durably stored. A day is never purged without its aggregates (D3: « puis uniquement des agrégats »).
 */
export function planEventPurge(input: { now: Date; rawDays: readonly string[]; aggregatedDays: ReadonlySet<string>; retentionDays?: number }): PurgePlan {
  const retention = input.retentionDays ?? RAW_RETENTION_DAYS
  const cutoffDay = utcDay(new Date(input.now.getTime() - retention * 86_400_000))
  const cutoff = new Date(`${cutoffDay}T00:00:00.000Z`)
  const past = [...new Set(input.rawDays)].filter((d) => d < cutoffDay).sort()
  return {
    cutoff,
    purgeable: past.filter((d) => input.aggregatedDays.has(d)),
    blocked: past.filter((d) => !input.aggregatedDays.has(d)),
  }
}

export type PurgeDayProof = { day: string; before: number; deleted: number; after: number; verified: boolean }

/** A purged day is verified only when nothing is left for it AND every row counted before was deleted. */
export function verifyPurgeDay(day: string, before: number, deleted: number, after: number): PurgeDayProof {
  return { day, before, deleted, after, verified: after === 0 && deleted === before }
}
