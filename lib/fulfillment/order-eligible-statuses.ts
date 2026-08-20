/** Checkout webhook — only newly paid lines. */
export const FULFILLMENT_CHECKOUT_ORDER_STATUSES = ["paid"] as const

/** Backfill / supplier to-ship queue — paid + in fulfillment pipeline. */
export const FULFILLMENT_BACKFILL_ORDER_STATUSES = [
  "paid",
  "preparing",
  "fulfilling",
] as const

export type FulfillmentOrderMode = "checkout" | "backfill"

export type FulfillmentEligibleStatus =
  | (typeof FULFILLMENT_CHECKOUT_ORDER_STATUSES)[number]
  | (typeof FULFILLMENT_BACKFILL_ORDER_STATUSES)[number]

export function fulfillmentEligibleStatuses(
  mode: FulfillmentOrderMode = "checkout"
): readonly FulfillmentEligibleStatus[] {
  return mode === "backfill"
    ? FULFILLMENT_BACKFILL_ORDER_STATUSES
    : FULFILLMENT_CHECKOUT_ORDER_STATUSES
}

export function isFulfillmentEligibleStatus(
  status: string,
  mode: FulfillmentOrderMode = "checkout"
): boolean {
  return (fulfillmentEligibleStatuses(mode) as readonly string[]).includes(status)
}
