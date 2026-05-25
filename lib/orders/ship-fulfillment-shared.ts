import type { OrderFulfillmentMessage, OrderShipExtension } from "@prisma/client"

import { resolveShipDeadlineAt } from "@/lib/supplier-ship-sla-shared"

export type FulfillmentThreadPublic = {
  messages: Array<{
    id: string
    authorRole: "BUYER" | "SUPPLIER"
    body: string
    createdAt: string
  }>
  extension: {
    id: string
    status: string
    reason: string
    extraDays: number
    buyerExpiresAt: string
    newDeadlineAt: string | null
    buyerNote: string | null
    buyerRespondedAt: string | null
    canSupplierRequest: boolean
    canBuyerRespond: boolean
  } | null
  shipDeadlineAt: string
  hasTracking: boolean
  pastInitialDeadline: boolean
}

export function mapFulfillmentThread(
  order: {
    status: string
    shipDeadlineAt: Date | null
    paidAt: Date | null
    createdAt: Date
    trackingNumber: string | null
  },
  messages: OrderFulfillmentMessage[],
  extensions: OrderShipExtension[],
  opts: { now?: Date; isSupplier: boolean; isBuyer: boolean }
): FulfillmentThreadPublic {
  const now = opts.now ?? new Date()
  const deadline = resolveShipDeadlineAt({
    shipDeadlineAt: order.shipDeadlineAt,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
  })
  const pastInitial = now.getTime() >= deadline.getTime()
  const sortedExt = [...extensions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  const openPending = sortedExt.find((e) => e.status === "PENDING")
  const latest = sortedExt[0] ?? null

  const awaitingShip = order.status === "paid" || order.status === "preparing"
  const canSupplierRequest =
    opts.isSupplier &&
    awaitingShip &&
    !order.trackingNumber?.trim() &&
    !openPending

  const canBuyerRespond = opts.isBuyer && openPending != null && openPending.buyerExpiresAt > now

  const extensionPayload = openPending ?? latest

  return {
    messages: messages.map((m) => ({
      id: m.id,
      authorRole: m.authorRole as "BUYER" | "SUPPLIER",
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
    extension:
      extensionPayload || canSupplierRequest
        ? {
            id: extensionPayload?.id ?? "",
            status: extensionPayload?.status ?? "NONE",
            reason: extensionPayload?.reason ?? "",
            extraDays: extensionPayload?.extraDays ?? 0,
            buyerExpiresAt: extensionPayload?.buyerExpiresAt.toISOString() ?? "",
            newDeadlineAt: extensionPayload?.newDeadlineAt?.toISOString() ?? null,
            buyerNote: extensionPayload?.buyerNote ?? null,
            buyerRespondedAt: extensionPayload?.buyerRespondedAt?.toISOString() ?? null,
            canSupplierRequest,
            canBuyerRespond,
          }
        : null,
    shipDeadlineAt: deadline.toISOString(),
    hasTracking: Boolean(order.trackingNumber?.trim()),
    pastInitialDeadline: pastInitial,
  }
}
