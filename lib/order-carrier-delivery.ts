import type { Prisma } from "@prisma/client"

import { registerAfterShipTracking } from "@/lib/aftership-tracking"
import { recordOrderTrackingEvent } from "@/lib/order-tracking-event"
import { prisma } from "@/lib/prisma"

/** Sources allowed to write Order.deliveredAt (conformité UE — preuve transporteur). */
export const ORDER_DELIVERED_AT_SOURCES = [
  "aftership_webhook",
  "digital_instant",
  "booking_confirmed",
] as const

export type OrderDeliveredAtSource = (typeof ORDER_DELIVERED_AT_SOURCES)[number]

export type ApplyCarrierDeliveredAtResult = {
  applied: boolean
  orderId: string
  skipped?: "already_delivered" | "order_not_found"
}

/**
 * Single write gate for carrier-attested delivery timestamps on marketplace orders.
 */
export async function applyCarrierDeliveredAt(
  args: {
    orderId: string
    source: OrderDeliveredAtSource
    occurredAt?: Date
    trackingNumber?: string | null
    trackingCarrier?: string | null
    payload?: unknown
  },
  tx?: Prisma.TransactionClient
): Promise<ApplyCarrierDeliveredAtResult> {
  const client = tx ?? prisma
  const at = args.occurredAt ?? new Date()

  const existing = await client.order.findUnique({
    where: { id: args.orderId },
    select: { deliveredAt: true, fulfillmentStatus: true },
  })
  if (!existing) {
    console.log("[carrier-delivery]", { orderId: args.orderId, source: args.source, result: "not_found" })
    return { applied: false, orderId: args.orderId, skipped: "order_not_found" }
  }
  if (existing.deliveredAt) {
    console.log("[carrier-delivery]", { orderId: args.orderId, source: args.source, result: "already_delivered" })
    return { applied: false, orderId: args.orderId, skipped: "already_delivered" }
  }

  await client.order.update({
    where: { id: args.orderId },
    data: {
      fulfillmentStatus: "DELIVERED",
      deliveredAt: at,
      deliveredAtSource: args.source,
    },
  })

  if (args.source === "aftership_webhook") {
    await recordOrderTrackingEvent(
      {
        orderId: args.orderId,
        eventType: "DELIVERED",
        source: "aftership_webhook",
        trackingNumber: args.trackingNumber,
        trackingCarrier: args.trackingCarrier,
        fulfillmentStatus: "DELIVERED",
        verificationMethod: "aftership",
        dedupe: "delivered",
        payload: args.payload,
      },
      tx
    )
  }

  console.log("[carrier-delivery]", {
    orderId: args.orderId,
    source: args.source,
    result: "applied",
    deliveredAt: at.toISOString(),
  })

  return { applied: true, orderId: args.orderId }
}

/** Register partner tracking so AfterShip can attest delivery later (idempotent). */
export async function registerPartnerTrackingForCarrierDelivery(args: {
  orderId: string
  trackingNumber: string
  carrier?: string | null
  customerEmail?: string | null
}): Promise<void> {
  const normalized = args.trackingNumber.trim()
  if (normalized.length < 4) return

  void registerAfterShipTracking({
    trackingNumber: normalized,
    carrier: args.carrier,
    orderId: args.orderId,
    customerEmail: args.customerEmail,
  })

  console.log("[carrier-delivery]", {
    orderId: args.orderId,
    trackingNumber: normalized,
    result: "aftership_register_scheduled",
  })
}
