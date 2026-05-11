import type { OrderReturnStatus } from "@/lib/order-return-types"

export type SupplierReturnAction =
  | "approve"
  | "reject"
  | "mark_received"
  | "mark_refunded"

export type BuyerReturnAction = "cancel" | "submit_tracking"

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
