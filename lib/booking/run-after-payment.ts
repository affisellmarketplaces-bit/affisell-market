import type { Prisma } from "@prisma/client"

import { confirmBookingPassInTransaction } from "@/lib/booking/confirm-pass"
import { isBookableListingKind } from "@/lib/booking/types"
import { notifySupplierBookingConfirmed } from "@/lib/emails/send-supplier-booking-alert"
import { sendBookingPassEmail } from "@/lib/emails/send-booking-pass"
import { logStripeWebhookError } from "@/lib/stripe-webhook-observability"

type Tx = Prisma.TransactionClient

type ProductBookingFields = {
  id: string
  listingKind: string
  bookingCancellationHours: number
  bookingVenueLabel: string | null
  bookingInstantConfirm: boolean
  name: string
  supplierId: string
}

export async function runBookingPassAfterPayment(
  tx: Tx,
  args: {
    orderId: string
    quantity: number
    buyerUserId: string | null
    buyerLocale?: string | null
    customerEmail: string
    product: ProductBookingFields
    bookingSlotId: string | null
  }
): Promise<void> {
  if (!args.bookingSlotId || !isBookableListingKind(args.product.listingKind)) return
  if (!args.product.bookingInstantConfirm) return

  const slot = await tx.bookingSlot.findFirst({
    where: { id: args.bookingSlotId, productId: args.product.id },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      bookedCount: true,
      heldCount: true,
      label: true,
      status: true,
    },
  })
  if (!slot) {
    logStripeWebhookError({
      metric: "booking_slot_missing_at_fulfill",
      orderId: args.orderId,
      error: args.bookingSlotId,
    })
    return
  }

  const result = await confirmBookingPassInTransaction(tx, {
    orderId: args.orderId,
    quantity: args.quantity,
    buyerUserId: args.buyerUserId,
    product: {
      listingKind: args.product.listingKind,
      bookingDurationMinutes: null,
      bookingCancellationHours: args.product.bookingCancellationHours,
      bookingVenueLabel: args.product.bookingVenueLabel,
      bookingInstantConfirm: args.product.bookingInstantConfirm,
      name: args.product.name,
    },
    slot,
  })

  if (result.confirmed) {
    void sendBookingPassEmail({
      orderId: args.orderId,
      productName: args.product.name,
      customerEmail: args.customerEmail,
      passPath: result.passPath,
      startsAt: result.snapshot.startsAt,
      venueLabel: result.snapshot.venueLabel,
      listingKind: args.product.listingKind,
      locale: args.buyerLocale,
    })
    void notifySupplierBookingConfirmed({
      orderId: args.orderId,
      supplierId: args.product.supplierId,
      productName: args.product.name,
      listingKind: args.product.listingKind,
      startsAt: result.snapshot.startsAt,
      venueLabel: result.snapshot.venueLabel,
      seatLabels: result.snapshot.seatLabels,
      quantity: result.snapshot.quantity,
      customerEmail: args.customerEmail,
      locale: args.buyerLocale,
    })
    const { triggerOrderTransferRelease } = await import("@/lib/trigger-order-transfer-release")
    triggerOrderTransferRelease(args.orderId)
  } else if (result.reason !== "already_confirmed") {
    console.log("[booking]", {
      orderId: args.orderId,
      result: "pass_not_confirmed",
      reason: result.reason,
      slotId: args.bookingSlotId,
    })
  }
}
