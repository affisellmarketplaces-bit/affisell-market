/**
 * Rollout switch for the listing-readiness gate.
 *
 *   off      — nothing is evaluated.
 *   warn     — (default) evaluated and LOGGED, never blocks: shows how many publications would be refused.
 *   enforce  — a new publication with blocking issues is refused (HTTP 422 `listing_not_ready`).
 *
 * `LISTING_READINESS_MODE` is read at request time, so flipping it on Vercel is the kill switch (no redeploy of code).
 * Enforcement only ever applies to NEW publications (create live, draft → live, CSV import): edits of listings that are
 * already live are observed, never blocked, so legacy listings can still be repriced or restocked.
 */
import type { ReadinessIssue, ReadinessResult } from "@/lib/listing-compliance/evaluate"

export type ListingReadinessMode = "off" | "warn" | "enforce"

export function readListingReadinessMode(raw: string | undefined | null = process.env.LISTING_READINESS_MODE): ListingReadinessMode {
  const v = (raw ?? "").trim().toLowerCase()
  if (v === "off" || v === "0" || v === "false") return "off"
  if (v === "enforce" || v === "enforced" || v === "block") return "enforce"
  return "warn"
}

/** Where a publication comes from — decides whether enforcement may apply. */
export type ReadinessContext =
  /** New live listing (create live, draft → live, CSV row). */
  | "new_publication"
  /** Edit of a listing that is already live. Observed only. */
  | "live_edit"

export type ReadinessDecision = {
  mode: ListingReadinessMode
  /** True when the request must be refused. */
  block: boolean
  /** True when the evaluation is worth a log line (anything not clean). */
  log: boolean
  issues: ReadinessIssue[]
  blocking: ReadinessIssue[]
}

export function decideListingReadiness(
  result: ReadinessResult,
  context: ReadinessContext,
  mode: ListingReadinessMode = readListingReadinessMode()
): ReadinessDecision {
  if (mode === "off" || !result.applicable) {
    return { mode, block: false, log: false, issues: [], blocking: [] }
  }
  const dirty = result.issues.length > 0
  return {
    mode,
    block: mode === "enforce" && context === "new_publication" && result.blocking.length > 0,
    // Only new publications are logged: a live listing is re-saved on every autosave, which would flood the logs.
    // Coverage of the existing catalogue is measured by `npm run report:listing-readiness` instead.
    log: dirty && context === "new_publication",
    issues: result.issues,
    blocking: result.blocking,
  }
}

/** The 422 body. Codes only: the UI translates them, so the API stays language-neutral. */
export function listingNotReadyBody(decision: ReadinessDecision) {
  return {
    error: "listing_not_ready" as const,
    issues: decision.issues.map(({ code, field, group, severity }) => ({ code, field, group, severity })),
  }
}
