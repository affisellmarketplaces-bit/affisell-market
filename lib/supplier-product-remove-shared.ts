/** Client-safe remove / recall error codes for supplier products. */
export const SUPPLIER_PRODUCT_REMOVE_CODE = {
  HAS_ORDERS: "has_orders",
  REQUIRES_RECALL: "requires_recall",
  NOT_FOUND: "not_found",
  NOT_LIVE: "not_live",
  ALREADY_RECALLED: "already_recalled",
} as const

export type SupplierProductRemoveAction = "delete" | "recall" | "blocked_orders" | "none"

export type SupplierProductRemoveImpact = {
  productId: string
  productName: string
  isDraft: boolean
  isLive: boolean
  orderCount: number
  listedAffiliateCount: number
  totalAffiliateListingCount: number
  action: SupplierProductRemoveAction
}

/** Pure resolver — drives supplier delete vs recall UX. */
export function resolveSupplierProductRemoveAction(input: {
  isDraft: boolean
  active: boolean
  orderCount: number
  listedAffiliateCount: number
}): SupplierProductRemoveAction {
  if (input.orderCount > 0) return "blocked_orders"
  if (input.listedAffiliateCount > 0) return "recall"
  if (input.isDraft || input.active) return "delete"
  return "none"
}
