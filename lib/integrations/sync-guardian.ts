/**
 * Sync Guardian — a catastrophic-drop tripwire shared by every integration provider.
 * A feed that suddenly returns far fewer products than its last healthy run (broken link,
 * emptied sheet, revoked API scope, provider outage returning zero rows) must never be
 * auto-applied: that would silently out-of-stock or delete a supplier's live catalog.
 * Guarded runs are parked as `NEEDS_REVIEW` instead — nothing is written until reviewed.
 */

/** Below this, percentage swings are normal catalog churn, not a signal worth guarding. */
const MIN_BASELINE_FOR_GUARD = 5

/** A run that keeps less than this fraction of the last healthy count is "catastrophic". */
const CATASTROPHIC_DROP_RATIO = 0.6

export type SyncGuardResult =
  | { triggered: false }
  | {
      triggered: true
      reason: "empty_feed" | "catastrophic_drop"
      previousFetched: number
      currentFetched: number
      dropRatio: number
    }

/**
 * `previousFetched` is the last healthy (COMPLETED, non-guarded) run's fetched count, or
 * `null` when there isn't one yet (first sync, or the last healthy baseline was lost) —
 * with no baseline, there is nothing to compare against, so the guard never fires.
 */
export function evaluateSyncGuard(previousFetched: number | null, currentFetched: number): SyncGuardResult {
  if (previousFetched === null || !Number.isFinite(previousFetched) || previousFetched < MIN_BASELINE_FOR_GUARD) {
    return { triggered: false }
  }
  if (currentFetched === 0) {
    return { triggered: true, reason: "empty_feed", previousFetched, currentFetched, dropRatio: 1 }
  }
  const dropRatio = 1 - currentFetched / previousFetched
  if (dropRatio >= CATASTROPHIC_DROP_RATIO) {
    return { triggered: true, reason: "catastrophic_drop", previousFetched, currentFetched, dropRatio }
  }
  return { triggered: false }
}

/** Reads the last healthy run's `fetched` count out of `SupplierIntegration.lastSyncSummary`. */
export function extractPreviousFetchedCount(summary: unknown): number | null {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return null
  const v = (summary as Record<string, unknown>).fetched
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}
