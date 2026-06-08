import { randomBytes } from "node:crypto"
import type { Prisma } from "@prisma/client"

import { resolveDigitalAccessUrl } from "@/lib/digital-delivery/resolve-access-url"
import type { DigitalDeliveryProductFields } from "@/lib/digital-delivery/types"
import { isDigitalListingKind } from "@/lib/digital-delivery/types"
import { payoutEligibleAfterBuyerConfirm } from "@/lib/order-payout-policy"

export const DIGITAL_TRACKING_CARRIER = "AFFISELL_DIGITAL"
export const DIGITAL_DELIVERY_CONFIRMED_BY = "digital_instant"

type Tx = Prisma.TransactionClient

export function generateDigitalAccessToken(): string {
  return randomBytes(24).toString("hex")
}

export function digitalPassPath(token: string): string {
  return `/digital/pass/${encodeURIComponent(token)}`
}

export type InstantDigitalFulfillResult =
  | { delivered: false; reason: "not_digital" | "manual_mode" | "missing_url" | "already_delivered" }
  | {
      delivered: true
      token: string
      accessUrl: string
      instructions: string | null
      passPath: string
    }

/**
 * Idempotent instant digital delivery inside checkout transaction.
 */
export async function applyInstantDigitalDeliveryInTransaction(
  tx: Tx,
  args: {
    orderId: string
    customerEmail: string
    buyerUserId: string | null
    product: DigitalDeliveryProductFields
  }
): Promise<InstantDigitalFulfillResult> {
  const { product } = args
  if (!isDigitalListingKind(product.listingKind)) {
    return { delivered: false, reason: "not_digital" }
  }
  if (!product.digitalInstantDelivery) {
    return { delivered: false, reason: "manual_mode" }
  }
  const template = product.digitalAccessUrl?.trim()
  if (!template) {
    return { delivered: false, reason: "missing_url" }
  }

  const existing = await tx.order.findUnique({
    where: { id: args.orderId },
    select: { digitalDeliveredAt: true, digitalAccessToken: true },
  })
  if (existing?.digitalDeliveredAt) {
    return { delivered: false, reason: "already_delivered" }
  }

  const token = existing?.digitalAccessToken ?? generateDigitalAccessToken()
  const accessUrl = resolveDigitalAccessUrl(template, {
    orderId: args.orderId,
    token,
    email: args.customerEmail.trim().toLowerCase(),
  })
  const instructions = product.digitalAccessInstructions?.trim() || null
  const now = new Date()
  const payoutEligibleAt = payoutEligibleAfterBuyerConfirm(now)

  await tx.order.update({
    where: { id: args.orderId },
    data: {
      listingKindSnapshot: product.listingKind.trim().toUpperCase(),
      digitalAccessUrl: accessUrl,
      digitalAccessInstructions: instructions,
      digitalAccessToken: token,
      digitalDeliveredAt: now,
      status: "shipped",
      shippedAt: now,
      deliveredAt: now,
      deliveryConfirmedAt: now,
      deliveryConfirmedBy: DIGITAL_DELIVERY_CONFIRMED_BY,
      payoutEligibleAt,
      shipDeadlineAt: null,
      trackingCarrier: DIGITAL_TRACKING_CARRIER,
      trackingNumber: `DIGITAL-${token.slice(0, 12).toUpperCase()}`,
      fulfillmentStatus: "DELIVERED",
      fulfilledAt: now,
    },
  })

  if (args.buyerUserId) {
    await tx.notification.create({
      data: {
        userId: args.buyerUserId,
        type: "ORDER_SHIPPED",
        message: `Your digital access is ready · ${product.name}. Open your pass portal to start immediately.`,
        orderId: args.orderId,
      },
    })
  }

  console.log("[digital-delivery]", {
    orderId: args.orderId,
    result: "instant_delivered",
    listingKind: product.listingKind,
  })

  return {
    delivered: true,
    token,
    accessUrl,
    instructions,
    passPath: digitalPassPath(token),
  }
}
