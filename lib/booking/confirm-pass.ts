import type { Prisma } from "@prisma/client"

import {
  BOOKING_DELIVERY_CONFIRMED_BY,
  BOOKING_TRACKING_CARRIER,
  bookingPassPath,
  generateBookingPassToken,
} from "@/lib/booking/pass-token"
import { buildBookingSnapshot } from "@/lib/booking/snapshot"
import { bookingSeatsLeft, resolveBookingSlotStatus } from "@/lib/booking/slot-hold"
import { isBookableListingKind, type BookingProductFields } from "@/lib/booking/types"
import { payoutEligibleAfterBuyerConfirm } from "@/lib/order-payout-policy"

type Tx = Prisma.TransactionClient

type SlotRow = {
  id: string
  startsAt: Date
  endsAt: Date
  capacity: number
  bookedCount: number
  heldCount: number
  label: string | null
  status: string
}

export type ConfirmBookingPassResult =
  | { confirmed: false; reason: "not_bookable" | "no_slot" | "slot_full" | "already_confirmed" }
  | { confirmed: true; token: string; passPath: string; snapshot: ReturnType<typeof buildBookingSnapshot> }

/** Idempotent booking confirmation: converts checkout hold → booked seats + QR pass. */
export async function confirmBookingPassInTransaction(
  tx: Tx,
  args: {
    orderId: string
    quantity: number
    buyerUserId: string | null
    product: BookingProductFields
    slot: SlotRow
  }
): Promise<ConfirmBookingPassResult> {
  if (!isBookableListingKind(args.product.listingKind)) {
    return { confirmed: false, reason: "not_bookable" }
  }
  if (args.slot.status === "CANCELLED") {
    return { confirmed: false, reason: "no_slot" }
  }

  const existing = await tx.order.findUnique({
    where: { id: args.orderId },
    select: {
      bookingConfirmedAt: true,
      bookingToken: true,
      quantity: true,
      bookingHoldExpiresAt: true,
    },
  })
  if (existing?.bookingConfirmedAt) {
    return { confirmed: false, reason: "already_confirmed" }
  }

  const slotFresh = await tx.bookingSlot.findUnique({
    where: { id: args.slot.id },
    select: {
      id: true,
      capacity: true,
      bookedCount: true,
      heldCount: true,
      status: true,
    },
  })
  if (!slotFresh) {
    return { confirmed: false, reason: "no_slot" }
  }

  const qty = Math.max(1, args.quantity)
  const hadHold = Boolean(existing?.bookingHoldExpiresAt)
  let nextHeld = slotFresh.heldCount
  if (hadHold) {
    nextHeld = Math.max(0, slotFresh.heldCount - qty)
  } else if (bookingSeatsLeft(slotFresh) < qty) {
    return { confirmed: false, reason: "slot_full" }
  }

  const nextBooked = slotFresh.bookedCount + qty
  if (nextBooked > slotFresh.capacity) {
    return { confirmed: false, reason: "slot_full" }
  }

  const token = existing?.bookingToken ?? generateBookingPassToken()
  const snapshot = buildBookingSnapshot({
    slotId: args.slot.id,
    startsAt: args.slot.startsAt,
    endsAt: args.slot.endsAt,
    label: args.slot.label,
    venueLabel: args.product.bookingVenueLabel,
    quantity: qty,
    cancellationPolicyHours: args.product.bookingCancellationHours,
    listingKind: args.product.listingKind,
    productName: args.product.name,
  })
  const now = new Date()
  const payoutEligibleAt = payoutEligibleAfterBuyerConfirm(now)

  await tx.bookingSlot.update({
    where: { id: args.slot.id },
    data: {
      bookedCount: nextBooked,
      heldCount: nextHeld,
      status: resolveBookingSlotStatus({
        capacity: slotFresh.capacity,
        bookedCount: nextBooked,
        heldCount: nextHeld,
        previousStatus: slotFresh.status,
      }),
    },
  })

  await tx.order.update({
    where: { id: args.orderId },
    data: {
      listingKindSnapshot: args.product.listingKind.trim().toUpperCase(),
      bookingSlotId: args.slot.id,
      bookingSnapshot: snapshot,
      bookingToken: token,
      bookingConfirmedAt: now,
      bookingHoldExpiresAt: null,
      status: "shipped",
      shippedAt: now,
      deliveredAt: now,
      deliveryConfirmedAt: now,
      deliveryConfirmedBy: BOOKING_DELIVERY_CONFIRMED_BY,
      payoutEligibleAt,
      shipDeadlineAt: null,
      trackingCarrier: BOOKING_TRACKING_CARRIER,
      trackingNumber: `BOOKING-${token.slice(0, 12).toUpperCase()}`,
      fulfillmentStatus: "DELIVERED",
      fulfilledAt: now,
    },
  })

  if (args.buyerUserId) {
    await tx.notification.create({
      data: {
        userId: args.buyerUserId,
        type: "ORDER_SHIPPED",
        message: `Your booking is confirmed · ${args.product.name}. Open your Affisell pass to check in.`,
        orderId: args.orderId,
      },
    })
  }

  console.log("[booking]", {
    orderId: args.orderId,
    result: "pass_confirmed",
    slotId: args.slot.id,
    listingKind: args.product.listingKind,
  })

  return { confirmed: true, token, passPath: bookingPassPath(token), snapshot }
}
