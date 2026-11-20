/**
 * Return-request statuses — pure, dependency-free.
 *
 * Split from `lib/order-return-types.ts` (which re-exports everything here) because that file also builds translated
 * labels with `tMessage`, which imports all eight message catalogues: `lib/order-return-policy.ts` only needed
 * `isTerminalReturnStatus`, and through `order-payout-policy` → `legal/fee-labels` → `legal/entity` → `legal/consent`
 * the cookie banner of every page ended up downloading every catalogue.
 */
export const ORDER_RETURN_STATUSES = [
  "REQUESTED",
  "AWAITING_SHIPMENT",
  "IN_TRANSIT",
  "RECEIVED",
  "REFUNDED",
  "REJECTED",
  "CANCELLED",
] as const

export type OrderReturnStatus = (typeof ORDER_RETURN_STATUSES)[number]

export const TERMINAL_RETURN_STATUSES: OrderReturnStatus[] = ["REJECTED", "REFUNDED", "CANCELLED"]

export function isTerminalReturnStatus(s: string): boolean {
  return TERMINAL_RETURN_STATUSES.includes(s as OrderReturnStatus)
}
