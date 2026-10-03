/** Buyer-facing order progress for a reseller storefront's "track my order" page (pure, client-safe). */

export type StoreBuyerOrderStage = "confirmed" | "preparing" | "shipped" | "delivered" | "refunded"

export type StoreBuyerOrderStageInput = {
  status: string
  supplierPreparingAt?: Date | string | null
  shippedAt?: Date | string | null
  deliveredAt?: Date | string | null
  deliveryConfirmedAt?: Date | string | null
}

/** Furthest stage the order has reached. Refunds win; timestamps and the status string both count. */
export function storeBuyerOrderStage(order: StoreBuyerOrderStageInput): StoreBuyerOrderStage {
  const status = order.status.trim().toLowerCase()
  if (status === "refunded") return "refunded"
  if (order.deliveredAt || order.deliveryConfirmedAt || status === "delivered") return "delivered"
  if (order.shippedAt || status === "shipped") return "shipped"
  if (order.supplierPreparingAt || status === "preparing") return "preparing"
  return "confirmed"
}

/** Position on the 4-step timeline (confirmed → preparing → shipped → delivered); refunds sit outside it. */
export function storeBuyerOrderStageIndex(stage: StoreBuyerOrderStage): number {
  switch (stage) {
    case "confirmed":
      return 0
    case "preparing":
      return 1
    case "shipped":
      return 2
    case "delivered":
      return 3
    case "refunded":
      return -1
  }
}
