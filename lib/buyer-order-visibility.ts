import type { Prisma } from "@prisma/client"

import {
  excludeInternalTestProductsWhere,
  isInternalTestProductId,
  isInternalTestProductName,
} from "@/lib/marketplace-buyer-product-filter"

/** Checkout abandonments and ops cancellations — hidden from buyer account. */
export const BUYER_HIDDEN_ORDER_STATUSES = ["PENDING", "CANCELLED", "cancelled"] as const

export function isBuyerVisibleOrderStatus(status: string): boolean {
  return !BUYER_HIDDEN_ORDER_STATUSES.includes(
    status as (typeof BUYER_HIDDEN_ORDER_STATUSES)[number]
  )
}

export function isBuyerVisibleOrder(args: {
  status: string
  productId?: string | null
  productName?: string | null
}): boolean {
  if (!isBuyerVisibleOrderStatus(args.status)) return false
  if (args.productId && isInternalTestProductId(args.productId)) return false
  if (args.productName && isInternalTestProductName(args.productName)) return false
  return true
}

/** Marketplace orders shown in buyer account / emails. */
export const buyerVisibleMarketplaceOrderWhere: Prisma.OrderWhereInput = {
  status: { notIn: [...BUYER_HIDDEN_ORDER_STATUSES] },
  product: excludeInternalTestProductsWhere,
}
