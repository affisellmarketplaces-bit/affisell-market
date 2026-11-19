/**
 * Replacement in two steps that can be cut between them: (1) the alternative is added to the shop, (2) the old listing
 * is withdrawn. If (1) succeeds and (2) fails, the shop sells BOTH — the operation is « partiellement terminée ».
 *
 * Pure rules for that state (client-safe, no I/O):
 * - a STARTED marker is written before step 1 (`AuditLog` id `listing-replace:<from>:<toProduct>`), a DONE marker
 *   in the same transaction as step 2 (id `listing-replace-done:<from>:<toProduct>`): both deterministic, so a replay
 *   never writes twice and a withdrawal is recorded at most once;
 * - a replacement is PENDING when it was started, never recorded done, the old listing is still in the shop and the
 *   new listing exists (if the add never produced a listing, nothing is pending: there is no duplicate to resolve);
 * - while a replacement is pending, no OTHER replacement of the same listing may start (it would add a third product);
 *   the only ways out are « finish » (withdraw the old listing — never re-add anything) or the reseller withdrawing
 *   the old listing by any other means.
 */

export const REPLACE_STARTED_ACTION = "affiliate.listing_replace_started"
export const REPLACE_DONE_ACTION = "affiliate.listing_replaced"

export function replaceStartedId(fromListingId: string, toProductId: string): string {
  return `listing-replace:${fromListingId}:${toProductId}`
}

export function replaceDoneId(fromListingId: string, toProductId: string): string {
  return `listing-replace-done:${fromListingId}:${toProductId}`
}

export type ReplacementStart = {
  toProductId: string
  startedAt: Date
  /** The done marker exists for this (from, to). */
  done: boolean
  /** The reseller's listing of `toProductId` (null = the add never produced one). */
  newListing: { id: string; isListed: boolean } | null
}

export type PendingReplacement = {
  toProductId: string
  newListingId: string
  newListingLive: boolean
  startedAt: Date
}

/**
 * The replacement of `fromListing` still waiting for its withdrawal, if any (the most recent one when several were
 * started — only one can be pending at a time through the flow, older ones are listed for completeness).
 */
export function pendingReplacement(input: { oldListingIsListed: boolean; starts: ReplacementStart[] }): PendingReplacement | null {
  if (!input.oldListingIsListed) return null
  const open = input.starts
    .filter((s) => !s.done && s.newListing !== null)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
  const s = open[0]
  if (!s || !s.newListing) return null
  return { toProductId: s.toProductId, newListingId: s.newListing.id, newListingLive: s.newListing.isListed, startedAt: s.startedAt }
}

export type ReplaceGate =
  | { allow: true }
  | { allow: false; reason: "replacement_pending"; pending: PendingReplacement }

/** A new replacement may start only when none is pending — except a retry of the very same one (idempotent add). */
export function mayStartReplacement(pending: PendingReplacement | null, toProductId: string): ReplaceGate {
  if (!pending || pending.toProductId === toProductId) return { allow: true }
  return { allow: false, reason: "replacement_pending", pending }
}

export type FinishDecision =
  | { action: "withdraw_old" }
  | { action: "already_done" }
  | { action: "refuse"; reason: "not_started" | "new_listing_missing" }

/**
 * « Finish the replacement »: withdraw the old listing ONLY. Never re-adds, never touches the new listing.
 * Refused when nothing was started for that target or when the new listing does not exist (withdrawing would then
 * leave the shop without the product the reseller chose).
 */
export function decideFinish(input: {
  start: ReplacementStart | null
  oldListingIsListed: boolean
}): FinishDecision {
  if (!input.start) return { action: "refuse", reason: "not_started" }
  if (input.start.done || !input.oldListingIsListed) return { action: "already_done" }
  if (!input.start.newListing) return { action: "refuse", reason: "new_listing_missing" }
  return { action: "withdraw_old" }
}
