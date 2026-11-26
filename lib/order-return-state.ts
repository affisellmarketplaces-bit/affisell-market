import type { OrderReturnStatus } from "@/lib/order-return-types"

export type SupplierReturnAction =
  | "approve"
  | "reject"
  | "mark_received"
  | "mark_refunded"

export type BuyerReturnAction = "cancel" | "submit_tracking"

/**
 * Target status of a supplier action. This only says what the transition WOULD be: for `mark_refunded` (RECEIVED → REFUNDED)
 * the caller must write `REFUNDED` only AFTER Stripe accepted the refund (D5) — a failed refund leaves the return in
 * RECEIVED so the same action can be replayed; `REFUNDED` is not a state anything can leave.
 */
export function supplierActionToNextStatus(
  current: string,
  action: SupplierReturnAction
): OrderReturnStatus | null {
  if (action === "approve" && current === "REQUESTED") return "AWAITING_SHIPMENT"
  if (action === "reject" && current === "REQUESTED") return "REJECTED"
  if (action === "mark_received" && current === "IN_TRANSIT") return "RECEIVED"
  if (action === "mark_refunded" && current === "RECEIVED") return "REFUNDED"
  return null
}

export function buyerActionToNextStatus(
  current: string,
  action: BuyerReturnAction
): OrderReturnStatus | null {
  if (action === "cancel" && current === "REQUESTED") return "CANCELLED"
  if (action === "submit_tracking" && current === "AWAITING_SHIPMENT") return "IN_TRANSIT"
  return null
}
