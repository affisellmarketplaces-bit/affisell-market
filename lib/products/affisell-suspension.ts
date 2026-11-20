/**
 * Commercial status — two causes kept apart (founder rule 2026-11-18): a PAUSE decided by the supplier and a SUSPENSION
 * decided by Affisell. Both still share the single `Product.active` column (a dedicated column is a migration — founder
 * decision), so the suspension is recorded beside it, without migration, as `AuditLog` rows:
 *  - current state  `product-suspension:<productId>`      (suspended | lifted, reason, note, who, when)
 *  - every change   `product-suspension:<productId>:<n>`  (history, never rewritten)
 * The supplier can neither write nor remove these rows. An open product-safety recall remains a suspension too.
 *
 * Lifting a suspension never puts the product back on sale: it only gives the decision back to the supplier
 * (publication and pause are their axis). Pure module — no database.
 */
export const PRODUCT_SUSPENSION_ACTION = "product.affisell_suspension"
export const PRODUCT_SUSPENDED_ERROR = "product_suspended"
export const PRODUCT_HOLD_UNVERIFIABLE_ERROR = "product_hold_unverifiable"

export const SUSPENSION_REASONS = [
  "product_safety",
  "legal_or_ip",
  "listing_quality",
  "fraud_or_abuse",
  "supplier_account",
  "other",
] as const
export type SuspensionReason = (typeof SUSPENSION_REASONS)[number]
export function isSuspensionReason(v: unknown): v is SuspensionReason {
  return typeof v === "string" && (SUSPENSION_REASONS as readonly string[]).includes(v)
}

export function suspensionStateId(productId: string): string {
  return `product-suspension:${productId}`
}
export function suspensionHistoryId(productId: string, n: number): string {
  return `product-suspension:${productId}:${n}`
}

export type SuspensionState = {
  state: "suspended" | "lifted"
  reason: SuspensionReason | null
  note: string
  by: string | null
  at: string | null
}

/** Reads a stored state row. Anything unreadable is treated as SUSPENDED (fail closed — never re-list on a doubt). */
export function parseSuspensionState(payload: unknown): SuspensionState {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>
  const state = p.state === "lifted" ? "lifted" : "suspended"
  return {
    state,
    reason: isSuspensionReason(p.reason) ? p.reason : null,
    note: typeof p.note === "string" ? p.note : "",
    by: typeof p.by === "string" ? p.by : null,
    at: typeof p.at === "string" ? p.at : null,
  }
}

export type CommercialHold = "product_recalled" | "product_suspended"

/** Why Affisell holds the product off sale (empty = the supplier decides). Order = what the supplier is told first. */
export function commercialHolds(input: {
  recallStatuses: ReadonlyArray<string | null | undefined>
  suspension: SuspensionState | null
}): CommercialHold[] {
  const out: CommercialHold[] = []
  if (input.recallStatuses.some((s) => (s ?? "").trim().toLowerCase() !== "closed")) out.push("product_recalled")
  if (input.suspension?.state === "suspended") out.push("product_suspended")
  return out
}

/** Which axis explains that a product is off sale — for admin / support screens. */
export function offSaleCause(input: { active: boolean; holds: ReadonlyArray<CommercialHold> }):
  | "on_sale"
  | "held_by_affisell"
  | "paused_by_supplier" {
  if (input.holds.length > 0) return "held_by_affisell"
  return input.active ? "on_sale" : "paused_by_supplier"
}
