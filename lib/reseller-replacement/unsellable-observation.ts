/**
 * What the « unsellable product » notice WOULD do, measured while it stays in `observe` (founder brief 2026-11-19:
 * keep observing, measure, document). Pure, client-safe.
 *
 * Each daily run in `observe` leaves:
 * - one internal marker per (listing, problem, 14-day window) — `AuditLog` `listing-unsellable-observed:<…>`, a
 *   DIFFERENT id from the real claim (`listing-unsellable:<…>`), so observing never consumes a future notice; the
 *   number of markers CREATED by a run is exactly how many bell notices `enforce` would have sent that day;
 * - one aggregate row per day — `AuditLog` `unsellable-alerts-observation:<YYYY-MM-DD>` — counts only (no listing,
 *   no reseller, no product name). The first run of a day is kept (a re-run the same day does not overwrite it).
 *
 * Nothing is sent, no listing changes, no money moves.
 */
import type { ReplacementProblem } from "@/lib/reseller-replacement/match"

export const UNSELLABLE_PROBLEMS: ReadonlyArray<ReplacementProblem> = [
  "out_of_stock",
  "product_unavailable",
  "awaiting_review",
  "no_commission",
]

export const OBSERVATION_ACTION = "affiliate.unsellable_alerts_observed"
export const OBSERVED_MARKER_ACTION = "affiliate.listing_unsellable_observed"

/** A reseller with at least this many unsellable listings would get several bell notices the same day. */
export const MANY_PER_RESELLER = 5

export function observationDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export function observationId(now: Date): string {
  return `unsellable-alerts-observation:${observationDay(now)}`
}

export function observedMarkerId(listingId: string, problem: ReplacementProblem, bucket: number): string {
  return `listing-unsellable-observed:${listingId}:${problem}:${bucket}`
}

export type ObservedItem = { affiliateId: string; listingId: string; problem: ReplacementProblem }

export type UnsellableObservation = {
  day: string
  scanned: number
  truncated: boolean
  unsellable: number
  /** Share of live listings that can not be bought (0–1), null when nothing was scanned. */
  unsellableShare: number | null
  byProblem: Record<ReplacementProblem, number>
  resellersAffected: number
  /** Resellers with ≥ MANY_PER_RESELLER unsellable listings (they would get several notices). */
  resellersWithMany: number
  maxPerReseller: number
  /** Notices `enforce` would have sent today: (listing, problem) pairs not already seen in the current 14-day window. */
  wouldNotifyNew: number
  /** Of those, notices that the reseller's in-app preference would have blocked. */
  wouldSkipPreference: number
  /**
   * Bell notifications `enforce` would really send with the daily digest: ONE per reseller with something new and the
   * in-app preference on. Null on rows recorded before the digest existed.
   */
  wouldNotifyResellers: number | null
}

export function summarizeObservation(input: {
  now: Date
  scanned: number
  truncated: boolean
  items: ReadonlyArray<ObservedItem>
  newItems: ReadonlyArray<ObservedItem>
  inAppOff: ReadonlySet<string>
}): UnsellableObservation {
  const byProblem = Object.fromEntries(UNSELLABLE_PROBLEMS.map((p) => [p, 0])) as Record<ReplacementProblem, number>
  const perReseller = new Map<string, number>()
  for (const it of input.items) {
    byProblem[it.problem] = (byProblem[it.problem] ?? 0) + 1
    perReseller.set(it.affiliateId, (perReseller.get(it.affiliateId) ?? 0) + 1)
  }
  const counts = [...perReseller.values()]
  return {
    day: observationDay(input.now),
    scanned: input.scanned,
    truncated: input.truncated,
    unsellable: input.items.length,
    unsellableShare: input.scanned > 0 ? Math.round((input.items.length / input.scanned) * 10_000) / 10_000 : null,
    byProblem,
    resellersAffected: perReseller.size,
    resellersWithMany: counts.filter((c) => c >= MANY_PER_RESELLER).length,
    maxPerReseller: counts.length > 0 ? Math.max(...counts) : 0,
    wouldNotifyNew: input.newItems.length,
    wouldSkipPreference: input.newItems.filter((it) => input.inAppOff.has(it.affiliateId)).length,
    wouldNotifyResellers: new Set(input.newItems.filter((it) => !input.inAppOff.has(it.affiliateId)).map((it) => it.affiliateId)).size,
  }
}

export type ObservationTrend = {
  days: number
  /** Days whose scan hit the cap: their counts are a lower bound. */
  truncatedDays: number
  latest: UnsellableObservation | null
  meanUnsellable: number | null
  meanWouldNotifyNew: number | null
  /** Highest daily number of new notices: the bell volume `enforce` would have produced on its worst day. */
  peakWouldNotifyNew: number
  /** Highest daily number of bell notifications WITH the digest (one per reseller); null without such rows. */
  peakWouldNotifyResellers: number | null
  /** Plain reading, never a forecast. */
  reading: "no_data" | "too_few_days" | "observed"
}

/** Several days of observations, newest first or not. Below 7 days the page says « too few days ». */
export function summarizeObservations(rows: ReadonlyArray<UnsellableObservation>): ObservationTrend {
  const sorted = [...rows].sort((a, b) => (a.day < b.day ? 1 : -1))
  if (sorted.length === 0) {
    return {
      days: 0,
      truncatedDays: 0,
      latest: null,
      meanUnsellable: null,
      meanWouldNotifyNew: null,
      peakWouldNotifyNew: 0,
      peakWouldNotifyResellers: null,
      reading: "no_data",
    }
  }
  const mean = (f: (o: UnsellableObservation) => number) => Math.round((sorted.reduce((s, o) => s + f(o), 0) / sorted.length) * 10) / 10
  return {
    days: sorted.length,
    truncatedDays: sorted.filter((o) => o.truncated).length,
    latest: sorted[0]!,
    meanUnsellable: mean((o) => o.unsellable),
    meanWouldNotifyNew: mean((o) => o.wouldNotifyNew),
    peakWouldNotifyNew: Math.max(...sorted.map((o) => o.wouldNotifyNew)),
    peakWouldNotifyResellers: sorted.some((o) => o.wouldNotifyResellers != null)
      ? Math.max(...sorted.map((o) => o.wouldNotifyResellers ?? 0))
      : null,
    reading: sorted.length < 7 ? "too_few_days" : "observed",
  }
}

/** Reads a stored aggregate back; anything malformed is ignored (never shown as a measurement). */
export function parseObservation(payload: unknown): UnsellableObservation | null {
  if (!payload || typeof payload !== "object") return null
  const o = payload as Record<string, unknown>
  const num = (k: string) => (typeof o[k] === "number" && Number.isFinite(o[k]) ? (o[k] as number) : null)
  const day = typeof o.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.day) ? o.day : null
  const bp = o.byProblem && typeof o.byProblem === "object" ? (o.byProblem as Record<string, unknown>) : null
  const fields = ["scanned", "unsellable", "resellersAffected", "resellersWithMany", "maxPerReseller", "wouldNotifyNew", "wouldSkipPreference"]
  if (!day || !bp || fields.some((k) => num(k) === null)) return null
  const byProblem = Object.fromEntries(
    UNSELLABLE_PROBLEMS.map((p) => [p, typeof bp[p] === "number" ? (bp[p] as number) : 0]),
  ) as Record<ReplacementProblem, number>
  return {
    day,
    scanned: num("scanned")!,
    truncated: o.truncated === true,
    unsellable: num("unsellable")!,
    unsellableShare: num("unsellableShare"),
    byProblem,
    resellersAffected: num("resellersAffected")!,
    resellersWithMany: num("resellersWithMany")!,
    maxPerReseller: num("maxPerReseller")!,
    wouldNotifyNew: num("wouldNotifyNew")!,
    wouldSkipPreference: num("wouldSkipPreference")!,
    wouldNotifyResellers: num("wouldNotifyResellers"),
  }
}
