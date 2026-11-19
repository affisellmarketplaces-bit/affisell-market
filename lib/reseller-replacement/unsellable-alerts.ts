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
