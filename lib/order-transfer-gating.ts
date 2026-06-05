import type { FulfillmentStatus } from "@prisma/client"

import {
  isPayoutBlockedByReturn,
  orderPayoutTiming,
} from "@/lib/order-payout-policy"

export type TransferReleasePhase =
  | "blocked_return"
  | "awaiting_upstream"
  | "awaiting_ship"
  | "awaiting_delivery_confirm"
  | "ready"

export type TransferReleaseEvaluation = {
  eligible: boolean
  phase: TransferReleasePhase
  reason: string
}

export type OrderTransferGateSnapshot = {
  status: string
  usesAffisellAutoBuy: boolean
  shippedAt: Date | null
  trackingNumber: string | null
  deliveredAt: Date | null
  deliveryConfirmedAt: Date | null
  deliveryConfirmedBy: string | null
  payoutEligibleAt: Date | null
  fulfillmentStatus: FulfillmentStatus
  autoBuyLogStatus?: string | null
  supplierJobStatuses?: string[]
  returns?: Array<{ status: string }>
}

const UPSTREAM_AUTO_BUY_OK = new Set(["BOUGHT"])
const UPSTREAM_FULFILLMENT_OK = new Set<FulfillmentStatus>([
  "ORDERED",
  "SHIPPED",
  "DELIVERED",
  "PARTIAL",
])
const UPSTREAM_SUPPLIER_JOB_OK = new Set(["CONFIRMED", "SHIPPED", "DELIVERED"])

function hasShipSignal(order: OrderTransferGateSnapshot): boolean {
  return (
    order.status === "shipped" ||
    order.shippedAt != null ||
    Boolean(order.trackingNumber?.trim())
  )
}

function isUpstreamFunded(order: OrderTransferGateSnapshot): boolean {
  if (!order.usesAffisellAutoBuy) return true
  if (order.autoBuyLogStatus && UPSTREAM_AUTO_BUY_OK.has(order.autoBuyLogStatus)) return true
  if (UPSTREAM_FULFILLMENT_OK.has(order.fulfillmentStatus)) return true
  if (
    order.supplierJobStatuses?.some((status) => UPSTREAM_SUPPLIER_JOB_OK.has(status))
  ) {
    return true
  }
  return false
}

/** Supplier Connect transfer — after upstream funded (auto-buy) + ship signal. */
export function evaluateSupplierTransferRelease(
  order: OrderTransferGateSnapshot,
  now = new Date()
): TransferReleaseEvaluation {
  void now
  const returns = order.returns ?? []
  if (isPayoutBlockedByReturn(returns)) {
    return { eligible: false, phase: "blocked_return", reason: "return_open" }
  }

  if (order.usesAffisellAutoBuy && !isUpstreamFunded(order)) {
    return { eligible: false, phase: "awaiting_upstream", reason: "awaiting_upstream_purchase" }
  }

  if (!hasShipSignal(order)) {
    return { eligible: false, phase: "awaiting_ship", reason: "awaiting_ship_tracking" }
  }

  return { eligible: true, phase: "ready", reason: "supplier_release_ready" }
}

/** Affiliate Connect transfer — after delivery confirm window (7d) or auto-confirm. */
export function evaluateAffiliateTransferRelease(
  order: OrderTransferGateSnapshot,
  now = new Date()
): TransferReleaseEvaluation {
  const returns = order.returns ?? []
  if (isPayoutBlockedByReturn(returns)) {
    return { eligible: false, phase: "blocked_return", reason: "return_open" }
  }

  if (!hasShipSignal(order)) {
    return { eligible: false, phase: "awaiting_ship", reason: "awaiting_ship_tracking" }
  }

  const timing = orderPayoutTiming(order)
  if (!timing) {
    return { eligible: false, phase: "awaiting_ship", reason: "delivery_timing_unavailable" }
  }

  if (timing.deliveryConfirmedAt && timing.payoutEligibleAt && now >= timing.payoutEligibleAt) {
    return { eligible: true, phase: "ready", reason: "affiliate_payout_window_open" }
  }

  if (!timing.deliveryConfirmedAt && now >= timing.autoConfirmAt) {
    return { eligible: true, phase: "ready", reason: "affiliate_auto_confirm_window" }
  }

  return {
    eligible: false,
    phase: "awaiting_delivery_confirm",
    reason: "awaiting_delivery_confirmation",
  }
}

export function evaluateTransferReleaseForRole(
  role: "SUPPLIER" | "AFFILIATE",
  order: OrderTransferGateSnapshot,
  now = new Date()
): TransferReleaseEvaluation {
  return role === "SUPPLIER"
    ? evaluateSupplierTransferRelease(order, now)
    : evaluateAffiliateTransferRelease(order, now)
}
