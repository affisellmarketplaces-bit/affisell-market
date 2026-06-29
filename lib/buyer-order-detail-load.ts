import "server-only"

import { buyerVisibleMarketplaceOrderWhere } from "@/lib/buyer-order-visibility"
import { carrierTrackingUrl, estimateBuyerDeliveryAt } from "@/lib/buyer-carrier-tracking"
import { formatBuyerSafeReturnAddress } from "@/lib/buyer-return-address"
import {
  euWithdrawalEndsAt,
  isWithinEuWithdrawalWindow,
  withdrawalAnchorAt,
} from "@/lib/buyer-withdrawal-window"
import {
  getActiveReturn,
  hasBlockingReturnHistory,
  normalizeOrderEmail,
} from "@/lib/order-return-policy"
import { isTerminalReturnStatus } from "@/lib/order-return-types"
import { prisma } from "@/lib/prisma"

export type BuyerOrderDetailDto = {
  id: string
  status: string
  createdAt: string
  quantity: number
  totalPaidCents: number
  product: { name: string; imageUrl: string | null }
  statusLabelKey: string
  trackingCarrier: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  estimatedDeliveryAt: string | null
  deliveredAt: string | null
  withdrawalEndsAt: string | null
  returnEligible: boolean
  returnAddress: string | null
  partnerLabel: string
  activeReturn: {
    id: string
    status: string
    reasonCode: string
    createdAt: string
    buyerTrackingCarrier: string | null
    buyerTrackingNumber: string | null
  } | null
  lastReturn: { id: string; status: string; createdAt: string; terminal: boolean } | null
}

export async function loadBuyerOrderDetail(
  orderId: string,
  customerEmail: string
): Promise<BuyerOrderDetailDto | null> {
  const normalized = normalizeOrderEmail(customerEmail)
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      customerEmail: { equals: normalized, mode: "insensitive" },
      ...buyerVisibleMarketplaceOrderWhere,
    },
    include: {
      product: { select: { name: true, images: true } },
      returns: { orderBy: { createdAt: "desc" } },
      supplier: {
        select: {
          store: { select: { returnAddress: true, shipFromAddress: true } },
        },
      },
    },
  })

  if (!order) return null

  const active = getActiveReturn(order.returns)
  const latest = order.returns[0] ?? null
  const returnAddrRaw =
    order.supplier.store?.returnAddress ?? order.supplier.store?.shipFromAddress ?? null
  const returnAddress = formatBuyerSafeReturnAddress(returnAddrRaw)
  const estimated = estimateBuyerDeliveryAt(order)
  const withdrawalEnd = euWithdrawalEndsAt(order)

  const returnEligible =
    withdrawalAnchorAt(order) !== null &&
    isWithinEuWithdrawalWindow(order) &&
    (order.status === "paid" ||
      order.status === "preparing" ||
      order.status === "shipped") &&
    !active &&
    !hasBlockingReturnHistory(order.returns)

  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    quantity: order.quantity,
    totalPaidCents: order.totalCents ?? order.sellingPriceCents,
    product: {
      name: order.product.name,
      imageUrl: order.product.images[0] ?? null,
    },
    statusLabelKey: order.status,
    trackingCarrier: order.trackingCarrier,
    trackingNumber: order.trackingNumber,
    trackingUrl: carrierTrackingUrl(order.trackingCarrier, order.trackingNumber),
    estimatedDeliveryAt: estimated?.toISOString() ?? null,
    deliveredAt: (order.deliveredAt ?? order.deliveryConfirmedAt)?.toISOString() ?? null,
    withdrawalEndsAt: withdrawalEnd?.toISOString() ?? null,
    returnEligible,
    returnAddress,
    partnerLabel: "verifiedPartner",
    activeReturn: active
      ? {
          id: active.id,
          status: active.status,
          reasonCode: active.reasonCode,
          createdAt: active.createdAt.toISOString(),
          buyerTrackingCarrier: active.buyerTrackingCarrier,
          buyerTrackingNumber: active.buyerTrackingNumber,
        }
      : null,
    lastReturn: latest
      ? {
          id: latest.id,
          status: latest.status,
          createdAt: latest.createdAt.toISOString(),
          terminal: isTerminalReturnStatus(latest.status),
        }
      : null,
  }
}
