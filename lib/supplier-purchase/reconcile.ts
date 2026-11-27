/**
 * Reconciliation of supplier-purchase claims that the code will never retry by itself (pure; the report and the
 * resolver scripts read and write through it). A claim needs a human when:
 *   - `uncertain`: a supplier call (or a payment) may have happened — check the supplier / Stripe;
 *   - `claimed` for longer than STUCK_AFTER_MS: a crash or a lost worker between claim and settle;
 *   - money left with it (`paidCents`) and it is not `placed`: paid, not (provably) ordered.
 */
export const STUCK_AFTER_MS = 15 * 60 * 1000

export type ClaimForReconcile = {
  id: string
  channel: string
  path: string
  status: string
  supplierOrderId: string | null
  paidCents: number | null
  paymentRef: string | null
  error: string | null
  updatedAt: Date | string
}

export type ClaimAnomaly = {
  id: string
  kind: "uncertain_paid" | "uncertain" | "stuck_claimed_paid" | "stuck_claimed"
  detail: string
  action: string
}

export function classifyClaim(c: ClaimForReconcile, now: Date = new Date()): ClaimAnomaly | null {
  const paid = c.paidCents != null
  const age = now.getTime() - new Date(c.updatedAt).getTime()
  const money = paid ? ` — ${c.paidCents} cents paid (${c.paymentRef ?? "?"})` : ""
  const look = `look up the order at ${c.channel} (reference / order id in the logs, path ${c.path})`
  if (c.status === "uncertain") {
    return {
      id: c.id,
      kind: paid ? "uncertain_paid" : "uncertain",
      detail: `${c.error ?? "uncertain"}${money}`,
      action: paid
        ? `${look}; order exists → resolve --as placed; no order → return the money (wallet credit / transfer reversal), then resolve --as refunded`
        : `${look}; order exists → resolve --as placed; no order → resolve --as rejected (re-claimable)`,
    }
  }
  if (c.status === "claimed" && age > STUCK_AFTER_MS) {
    return {
      id: c.id,
      kind: paid ? "stuck_claimed_paid" : "stuck_claimed",
      detail: `claimed ${Math.round(age / 60_000)} min ago, never settled${money}`,
      action: `${look}; same decisions as uncertain`,
    }
  }
  return null
}

export type Resolution = "placed" | "rejected" | "refunded"

/**
 * The one transition a human may apply (by the resolver, dry-run by default). Only from `claimed` / `uncertain`:
 *   placed   — the supplier order exists (its id is required);
 *   rejected — no order and NO money left (refused by the database otherwise);
 *   refunded — no order, the money was returned outside (wallet credited / transfer reversed): clears the payment so
 *              the order may be bought again.
 */
export const RESOLVE_SQL: Record<Resolution, string> = {
  placed: `UPDATE "SupplierPurchaseClaim" SET "status" = 'placed', "supplierOrderId" = $2, "error" = 'resolved_by_hand: ' || coalesce("error", ''), "updatedAt" = now()
WHERE "id" = $1 AND "status" IN ('claimed', 'uncertain')`,
  rejected: `UPDATE "SupplierPurchaseClaim" SET "status" = 'rejected', "error" = 'resolved_by_hand: ' || coalesce("error", ''), "updatedAt" = now()
WHERE "id" = $1 AND "status" IN ('claimed', 'uncertain') AND "paidCents" IS NULL`,
  refunded: `UPDATE "SupplierPurchaseClaim" SET "status" = 'rejected', "paidCents" = NULL,
  "error" = 'resolved_by_hand: refunded ' || coalesce("paymentRef", '') || ' ' || coalesce("paidCents"::text, '') || ' ' || coalesce("error", ''),
  "paymentRef" = NULL, "updatedAt" = now()
WHERE "id" = $1 AND "status" IN ('claimed', 'uncertain') AND "paidCents" IS NOT NULL`,
}

export const ANOMALY_SQL = `SELECT "id", "channel", "path", "status", "supplierOrderId", "paidCents", "paymentRef", "error", "updatedAt"
FROM "SupplierPurchaseClaim" WHERE "status" IN ('claimed', 'uncertain') ORDER BY "updatedAt"`
