/**
 * Tell a reseller, ONCE, when a product of its shop can no longer be sold — with the
 * way out (withdraw or replace). Pure part. Founder brief 2026-11-19: the reseller should
 * not discover by itself, days later, that buyers see its product sold out.
 *
 * Rollout switch `RESELLER_UNSELLABLE_ALERTS_MODE` = `off` | `observe` (DEFAULT: sends nothing,
 * records only internal MEASUREMENTS of what would be sent — `unsellable-observation.ts`) | `enforce` (bell notification) — read per run, same
 * pattern as the other switches. Enforce in production = founder decision.
 */
import type { ReplacementProblem } from "@/lib/reseller-replacement/match"

export const UNSELLABLE_LISTING_NOTIF = "LISTING_UNSELLABLE"
export type UnsellableAlertsMode = "off" | "observe" | "enforce"

export function readUnsellableAlertsMode(raw: string | undefined | null = process.env.RESELLER_UNSELLABLE_ALERTS_MODE): UnsellableAlertsMode {
  const v = (raw ?? "").trim().toLowerCase()
  if (v === "off" || v === "0" || v === "false") return "off"
  if (v === "enforce") return "enforce"
  return "observe"
}

/** One alert per listing, problem and 14-day window: a problem that lasts is not repeated every day. */
export const UNSELLABLE_ALERT_WINDOW_DAYS = 14

export function unsellableAlertBucket(now: Date): number {
  return Math.floor(now.getTime() / (UNSELLABLE_ALERT_WINDOW_DAYS * 86_400_000))
}

export function unsellableAlertId(listingId: string, problem: ReplacementProblem, now: Date): string {
  return `listing-unsellable:${listingId}:${problem}:${unsellableAlertBucket(now)}`
}

/**
 * DAILY DIGEST (founder brief 2026-11-19: « un avis quotidien intelligent par revendeur, sans multiplier les
 * notifications »). Each listing keeps its own once-per-14-days claim; a reseller receives at most ONE bell a day:
 * the listing's own notice when one product is new, ONE summary (« N produits ne peuvent plus être vendus ») linking to
 * the list when several are. The day is claimed per reseller (`listing-unsellable-digest:<affiliate>:<YYYY-MM-DD>`)
 * BEFORE the listings: a reseller already told today keeps its new listings unclaimed, so they are told tomorrow
 * instead of being lost.
 */
export const UNSELLABLE_DIGEST_NOTIF = "LISTING_UNSELLABLE_DIGEST"
export const UNSELLABLE_LIST_PATH = "/dashboard/affiliate/products/unsellable"

export function unsellableDigestId(affiliateId: string, now: Date): string {
  return `listing-unsellable-digest:${affiliateId}:${now.toISOString().slice(0, 10)}`
}

export type DigestPlan<T extends { affiliateId: string }> = Array<{
  affiliateId: string
  items: T[]
  /** `single` = the listing's own notice; `digest` = one summary for several products. */
  kind: "single" | "digest"
}>

/** Groups the NEW (not yet claimed) unsellable listings per reseller, most items first. */
export function planDigests<T extends { affiliateId: string }>(newItems: ReadonlyArray<T>): DigestPlan<T> {
  const by = new Map<string, T[]>()
  for (const it of newItems) by.set(it.affiliateId, [...(by.get(it.affiliateId) ?? []), it])
  return [...by.entries()]
    .map(([affiliateId, items]) => ({ affiliateId, items, kind: items.length > 1 ? ("digest" as const) : ("single" as const) }))
    .sort((a, b) => b.items.length - a.items.length || a.affiliateId.localeCompare(b.affiliateId))
}
