import type Stripe from "stripe"

import { initiateMarketplaceOrderRefund } from "@/lib/stripe-refund-marketplace-order"

export const MARKETPLACE_REFUND_SOURCES = [
  "supplier_mark_refunded",
  "ship_sla_auto_cancel",
  "booking_buyer_cancel",
  "auto_buy_failure",
  "admin_refund",
] as const

export type MarketplaceRefundSource = (typeof MARKETPLACE_REFUND_SOURCES)[number]

export type MarketplaceRefundPipelineResult = {
  ok: boolean
  stripeRefundId?: string
  error?: string
  skipped?: string
  source: MarketplaceRefundSource
  orderId: string
}

/**
 * Unified entry: Stripe refund → webhook charge.refunded → reversal → clawback.
 * All business paths must call this (never clawback directly).
 */
export async function initiateMarketplaceRefundPipeline(args: {
  orderId: string
  source: MarketplaceRefundSource
  amountCents?: number
  reason?: Stripe.RefundCreateParams.Reason
  metadata?: Record<string, string>
}): Promise<MarketplaceRefundPipelineResult> {
  console.log("[marketplace-refund-pipeline]", {
    orderId: args.orderId,
    source: args.source,
    amountCents: args.amountCents ?? null,
    metric: "refund_initiated",
  })

  const result = await initiateMarketplaceOrderRefund(args.orderId, {
    reason: args.reason ?? "requested_by_customer",
    amountCents: args.amountCents,
    metadata: {
      source: args.source,
      ...args.metadata,
    },
  })

  console.log("[marketplace-refund-pipeline]", {
    orderId: args.orderId,
    source: args.source,
    stripeRefundId: result.stripeRefundId ?? null,
    skipped: result.skipped ?? null,
    error: result.error ?? null,
    result: result.ok ? "stripe_refund_created" : "stripe_refund_failed",
  })

  return { ...result, source: args.source, orderId: args.orderId }
}
