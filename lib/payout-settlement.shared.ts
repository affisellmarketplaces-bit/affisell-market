/** Payout rail — money movement channel. */
export const PAYOUT_RAILS = [
  "connect",
  "lightning",
  "ledger_only",
  /** Pre-unification cron ledger without Stripe — not real money. */
  "phantom_legacy",
] as const
export type PayoutRail = (typeof PAYOUT_RAILS)[number]

/** Ledger rows that represent confirmed money movement for reporting. */
export function isLedgerPayoutRealized(row: {
  stripeTransferId?: string | null
  payoutRail?: string | null
  blindDropshipOrderId?: string | null
}): boolean {
  if (row.payoutRail === "phantom_legacy") return false
  if (row.stripeTransferId?.trim()) return true
  if (row.payoutRail === "ledger_only" && row.blindDropshipOrderId) return true
  return false
}

export function isPayoutRail(value: string): value is PayoutRail {
  return (PAYOUT_RAILS as readonly string[]).includes(value)
}

/** Ledger idempotency keyed on Stripe transfer (canonical for connect + lightning). */
export function ledgerIdempotencyKeyForStripeTransfer(stripeTransferId: string): string {
  return `stripe:tr:${stripeTransferId}`
}

/** Legacy ledger keys written by pre-unification cron (no Stripe link). */
export function legacyLedgerIdempotencyKey(
  role: "SUPPLIER" | "AFFILIATE",
  orderId: string
): string {
  return `payout:${role.toLowerCase()}:${orderId}`
}

export function clawbackLedgerIdempotencyKey(
  role: "SUPPLIER" | "AFFILIATE",
  orderId: string
): string {
  return `clawback:${role.toLowerCase()}:${orderId}`
}

export function partialClawbackLedgerIdempotencyKey(
  role: "SUPPLIER" | "AFFILIATE",
  orderId: string,
  stripeRefundId: string
): string {
  return `clawback:partial:${role.toLowerCase()}:${orderId}:${stripeRefundId}`
}

export function beneficiaryUserIdForRole(
  order: { supplierId: string; affiliateId: string },
  role: "SUPPLIER" | "AFFILIATE"
): string {
  return role === "SUPPLIER" ? order.supplierId : order.affiliateId
}

export function payoutTimestampFieldForRole(
  role: "SUPPLIER" | "AFFILIATE"
): "supplierPayoutAt" | "affiliatePayoutAt" {
  return role === "SUPPLIER" ? "supplierPayoutAt" : "affiliatePayoutAt"
}
