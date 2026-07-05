import type { Prisma } from "@prisma/client"
import { Prisma as PrismaRuntime } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export const ORDER_TRACKING_EVENT_TYPES = [
  "TRACKING_REGISTERED",
  "IN_TRANSIT",
  "DELIVERED",
  "TRACKING_UPDATED",
] as const

export type OrderTrackingEventType = (typeof ORDER_TRACKING_EVENT_TYPES)[number]

export const ORDER_TRACKING_EVENT_SOURCES = [
  "supplier_mark_shipped",
  "aftership_webhook",
  "supplier_fulfillment_webhook",
  "supplier_sync",
  "autods",
] as const

export type OrderTrackingEventSource = (typeof ORDER_TRACKING_EVENT_SOURCES)[number]

export type OrderTrackingVerificationMethod = "format" | "aftership" | "partner"

export function buildOrderTrackingIdempotencyKey(args: {
  orderId: string
  eventType: OrderTrackingEventType
  source: OrderTrackingEventSource
  dedupe?: string | null
}): string {
  const dedupe = args.dedupe?.trim().toLowerCase() || "default"
  return `${args.orderId}:${args.eventType}:${args.source}:${dedupe}`
}

function toJsonPayload(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export type RecordOrderTrackingEventInput = {
  orderId: string
  eventType: OrderTrackingEventType
  source: OrderTrackingEventSource
  trackingCarrier?: string | null
  trackingNumber?: string | null
  fulfillmentStatus?: string | null
  verificationMethod?: OrderTrackingVerificationMethod | null
  payload?: unknown
  dedupe?: string | null
}

export type RecordOrderTrackingEventResult = {
  created: boolean
  eventId: string | null
}

/**
 * Append-only tracking audit row — idempotent via unique idempotencyKey.
 */
export async function recordOrderTrackingEvent(
  args: RecordOrderTrackingEventInput,
  tx?: Prisma.TransactionClient
): Promise<RecordOrderTrackingEventResult> {
  const client = tx ?? prisma
  const idempotencyKey = buildOrderTrackingIdempotencyKey({
    orderId: args.orderId,
    eventType: args.eventType,
    source: args.source,
    dedupe: args.dedupe ?? args.trackingNumber,
  })

  try {
    const row = await client.orderTrackingEvent.create({
      data: {
        orderId: args.orderId,
        eventType: args.eventType,
        source: args.source,
        trackingCarrier: args.trackingCarrier?.trim() || null,
        trackingNumber: args.trackingNumber?.trim() || null,
        fulfillmentStatus: args.fulfillmentStatus?.trim() || null,
        verificationMethod: args.verificationMethod ?? null,
        idempotencyKey,
        payload: toJsonPayload(args.payload),
      },
    })
    console.log("[order-tracking-event]", {
      orderId: args.orderId,
      eventType: args.eventType,
      source: args.source,
      result: "created",
      eventId: row.id,
    })
    return { created: true, eventId: row.id }
  } catch (error) {
    if (
      error instanceof PrismaRuntime.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      console.log("[order-tracking-event]", {
        orderId: args.orderId,
        eventType: args.eventType,
        source: args.source,
        result: "duplicate",
      })
      return { created: false, eventId: null }
    }
    const message = error instanceof Error ? error.message : String(error)
    console.log("[order-tracking-event]", {
      orderId: args.orderId,
      eventType: args.eventType,
      source: args.source,
      result: "error",
      error: message,
    })
    throw error
  }
}

export type OrderTrackingTimelineItem = {
  id: string
  eventType: OrderTrackingEventType
  source: OrderTrackingEventSource
  trackingCarrier: string | null
  trackingNumber: string | null
  fulfillmentStatus: string | null
  verificationMethod: OrderTrackingVerificationMethod | null
  createdAt: string
}

export async function loadOrderTrackingTimeline(
  orderId: string,
  tx?: Prisma.TransactionClient
): Promise<OrderTrackingTimelineItem[]> {
  const client = tx ?? prisma
  const rows = await client.orderTrackingEvent.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      eventType: true,
      source: true,
      trackingCarrier: true,
      trackingNumber: true,
      fulfillmentStatus: true,
      verificationMethod: true,
      createdAt: true,
    },
  })

  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType as OrderTrackingEventType,
    source: row.source as OrderTrackingEventSource,
    trackingCarrier: row.trackingCarrier,
    trackingNumber: row.trackingNumber,
    fulfillmentStatus: row.fulfillmentStatus,
    verificationMethod: row.verificationMethod as OrderTrackingVerificationMethod | null,
    createdAt: row.createdAt.toISOString(),
  }))
}
