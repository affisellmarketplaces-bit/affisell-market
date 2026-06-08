import { parseBookingSnapshot } from "@/lib/booking/snapshot"
import { parseBookingPassTokenInput } from "@/lib/booking/parse-pass-token"
import { prisma } from "@/lib/prisma"

export type BookingCheckInError =
  | "invalid_token"
  | "not_found"
  | "forbidden"
  | "not_confirmed"
  | "cancelled"

export type BookingCheckInSuccess = {
  ok: true
  orderId: string
  customerEmail: string
  productName: string
  quantity: number
  seatLabels: string[]
  slotStartsAt: string | null
  slotLabel: string | null
  checkedInAt: string
  alreadyCheckedIn: boolean
}

export type BookingCheckInResult =
  | BookingCheckInSuccess
  | { ok: false; error: BookingCheckInError }

export async function checkInBookingPassForSupplier(args: {
  supplierId: string
  tokenInput?: string
  orderId?: string
}): Promise<BookingCheckInResult> {
  let order:
    | {
        id: string
        supplierId: string
        customerEmail: string
        quantity: number
        bookingSnapshot: unknown
        bookingConfirmedAt: Date | null
        bookingCancelledAt: Date | null
        bookingCheckedInAt: Date | null
        bookingSlot: { startsAt: Date; label: string | null } | null
        product: { name: string }
      }
    | null = null

  if (args.orderId) {
    order = await prisma.order.findFirst({
      where: { id: args.orderId, supplierId: args.supplierId },
      select: {
        id: true,
        supplierId: true,
        customerEmail: true,
        quantity: true,
        bookingSnapshot: true,
        bookingConfirmedAt: true,
        bookingCancelledAt: true,
        bookingCheckedInAt: true,
        bookingSlot: { select: { startsAt: true, label: true } },
        product: { select: { name: true } },
      },
    })
  } else if (args.tokenInput) {
    const token = parseBookingPassTokenInput(args.tokenInput)
    if (!token) {
      return { ok: false, error: "invalid_token" }
    }
    order = await prisma.order.findFirst({
      where: { bookingToken: token },
      select: {
        id: true,
        supplierId: true,
        customerEmail: true,
        quantity: true,
        bookingSnapshot: true,
        bookingConfirmedAt: true,
        bookingCancelledAt: true,
        bookingCheckedInAt: true,
        bookingSlot: { select: { startsAt: true, label: true } },
        product: { select: { name: true } },
      },
    })
  } else {
    return { ok: false, error: "invalid_token" }
  }

  if (!order) {
    return { ok: false, error: "not_found" }
  }
  if (order.supplierId !== args.supplierId) {
    return { ok: false, error: "forbidden" }
  }
  if (!order.bookingConfirmedAt) {
    return { ok: false, error: "not_confirmed" }
  }
  if (order.bookingCancelledAt) {
    return { ok: false, error: "cancelled" }
  }

  const snapshot = parseBookingSnapshot(order.bookingSnapshot)
  const seatLabels = snapshot?.seatLabels ?? []
  const productName = snapshot?.productName || order.product.name

  if (order.bookingCheckedInAt) {
    console.log("[booking-checkin]", {
      orderId: order.id,
      result: "already_checked_in",
    })
    return {
      ok: true,
      orderId: order.id,
      customerEmail: order.customerEmail,
      productName,
      quantity: order.quantity,
      seatLabels,
      slotStartsAt: order.bookingSlot?.startsAt.toISOString() ?? snapshot?.startsAt ?? null,
      slotLabel: order.bookingSlot?.label ?? snapshot?.label ?? null,
      checkedInAt: order.bookingCheckedInAt.toISOString(),
      alreadyCheckedIn: true,
    }
  }

  const now = new Date()
  const updated = await prisma.order.updateMany({
    where: {
      id: order.id,
      supplierId: args.supplierId,
      bookingConfirmedAt: { not: null },
      bookingCancelledAt: null,
      bookingCheckedInAt: null,
    },
    data: { bookingCheckedInAt: now },
  })

  const checkedInAt =
    updated.count === 1
      ? now
      : (
          await prisma.order.findUnique({
            where: { id: order.id },
            select: { bookingCheckedInAt: true },
          })
        )?.bookingCheckedInAt ?? now

  console.log("[booking-checkin]", {
    orderId: order.id,
    result: updated.count === 1 ? "checked_in" : "race_already_checked_in",
  })

  return {
    ok: true,
    orderId: order.id,
    customerEmail: order.customerEmail,
    productName,
    quantity: order.quantity,
    seatLabels,
    slotStartsAt: order.bookingSlot?.startsAt.toISOString() ?? snapshot?.startsAt ?? null,
    slotLabel: order.bookingSlot?.label ?? snapshot?.label ?? null,
    checkedInAt: checkedInAt.toISOString(),
    alreadyCheckedIn: false,
  }
}
