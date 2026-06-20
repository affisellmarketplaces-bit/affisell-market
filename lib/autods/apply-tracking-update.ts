import { notifyMarketplaceOrderShipped } from "@/lib/emails/notify-order-shipped"
import { logAutoDsFulfillmentEvent, type AutoDsLogSource } from "@/lib/autods/fulfillment-log"
import { prisma } from "@/lib/prisma"

export type AutoDsTrackingPayload = {
  autodsOrderId: string
  status: string
  trackingNumber?: string | null
  trackingUrl?: string | null
  carrier?: string | null
}

export type ApplyAutoDsTrackingResult = {
  ok: boolean
  orderId?: string
  skipped?: string
  updated?: boolean
  emailSent?: boolean
}

function normalizeStatus(status: string): string {
  return status.trim().toUpperCase() || "PROCESSING"
}

export async function applyAutoDsTrackingUpdate(args: {
  payload: AutoDsTrackingPayload
  source: AutoDsLogSource
  response?: unknown
  event: string
}): Promise<ApplyAutoDsTrackingResult> {
  const autodsOrderId = args.payload.autodsOrderId.trim()
  if (!autodsOrderId) {
    return { ok: false, skipped: "missing_autods_order_id" }
  }

  const order = await prisma.order.findUnique({
    where: { autodsOrderId },
    select: {
      id: true,
      autodsStatus: true,
      autodsTracking: true,
      autodsTrackingUrl: true,
      autodsCarrier: true,
      autodsShippedEmailSentAt: true,
      trackingNumber: true,
      shippedAt: true,
    },
  })

  if (!order) {
    console.log("[autods]", {
      autodsOrderId,
      result: "order_not_found",
      source: args.source,
      event: args.event,
    })
    return { ok: true, skipped: "order_not_found" }
  }

  const nextStatus = normalizeStatus(args.payload.status)
  const nextTracking = args.payload.trackingNumber?.trim() || null
  const nextTrackingUrl = args.payload.trackingUrl?.trim() || null
  const nextCarrier = args.payload.carrier?.trim() || null

  const trackingAlreadyPresent = Boolean(order.autodsTracking)
  const trackingUnchanged =
    trackingAlreadyPresent &&
    Boolean(nextTracking) &&
    order.autodsTracking === nextTracking &&
    order.autodsStatus === nextStatus &&
    order.autodsTrackingUrl === nextTrackingUrl &&
    order.autodsCarrier === nextCarrier

  if (trackingUnchanged) {
    await logAutoDsFulfillmentEvent({
      orderId: order.id,
      event: `${args.event}:noop`,
      response: args.response ?? { skipped: "unchanged" },
      source: args.source,
    })
    return { ok: true, orderId: order.id, skipped: "unchanged", updated: false }
  }

  const shippedNow =
    nextStatus === "SHIPPED" &&
    Boolean(nextTracking) &&
    !order.autodsShippedEmailSentAt &&
    !order.shippedAt

  await prisma.order.update({
    where: { id: order.id },
    data: {
      autodsStatus: nextStatus,
      ...(nextTracking ? { autodsTracking: nextTracking } : {}),
      ...(nextTrackingUrl ? { autodsTrackingUrl: nextTrackingUrl } : {}),
      ...(nextCarrier ? { autodsCarrier: nextCarrier } : {}),
      ...(nextStatus === "SHIPPED" || nextStatus === "DELIVERED"
        ? {
            status: "shipped",
            shippedAt: order.shippedAt ?? new Date(),
            fulfillmentStatus:
              nextStatus === "DELIVERED"
                ? "DELIVERED"
                : nextStatus === "SHIPPED"
                  ? "SHIPPED"
                  : "ORDERED",
            fulfilledAt: new Date(),
          }
        : nextStatus === "FAILED"
          ? { fulfillmentStatus: "MANUAL_REQUIRED" }
          : {}),
      ...(nextTracking
        ? {
            trackingNumber: order.trackingNumber ?? nextTracking,
            trackingCarrier: nextCarrier ?? undefined,
          }
        : {}),
      ...(shippedNow ? { autodsShippedEmailSentAt: new Date() } : {}),
    },
  })

  await logAutoDsFulfillmentEvent({
    orderId: order.id,
    event: args.event,
    response: args.response ?? args.payload,
    source: args.source,
  })

  console.log("[autods]", {
    orderId: order.id,
    autodsOrderId,
    autodsStatus: nextStatus,
    tracking: nextTracking,
    result: "updated",
    source: args.source,
  })

  if (shippedNow && nextTracking) {
    void notifyMarketplaceOrderShipped(order.id, {
      trackingNumber: nextTracking,
      trackingUrl: nextTrackingUrl,
      carrier: nextCarrier,
    })
  }

  return {
    ok: true,
    orderId: order.id,
    updated: true,
    emailSent: shippedNow,
  }
}
