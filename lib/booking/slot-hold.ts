import type { Prisma } from "@prisma/client"

import { bookingVerticalPreset } from "@/lib/booking/vertical-presets"
import { prisma } from "@/lib/prisma"

type Tx = Prisma.TransactionClient

/** Hold duration by listing kind (minutes). Env overrides per vertical. */
export function bookingHoldMinutes(listingKind?: string | null): number {
  const k = typeof listingKind === "string" ? listingKind.trim().toUpperCase() : ""

  if (k === "SERVICE") {
    const raw = Number(process.env.BOOKING_HOLD_MINUTES_SERVICE)
    if (Number.isFinite(raw) && raw >= 5 && raw <= 120) return Math.round(raw)
    return 45
  }
  if (k === "EXPERIENCE") {
    const raw = Number(process.env.BOOKING_HOLD_MINUTES_EXPERIENCE)
    if (Number.isFinite(raw) && raw >= 5 && raw <= 120) return Math.round(raw)
    return 12
  }
  if (k === "RESTAURANT") {
    const raw = Number(process.env.BOOKING_HOLD_MINUTES_RESTAURANT)
    if (Number.isFinite(raw) && raw >= 5 && raw <= 120) return Math.round(raw)
    return bookingVerticalPreset("RESTAURANT").holdMinutes
  }
  if (k === "MUSEUM") {
    const raw = Number(process.env.BOOKING_HOLD_MINUTES_MUSEUM)
    if (Number.isFinite(raw) && raw >= 5 && raw <= 120) return Math.round(raw)
    return bookingVerticalPreset("MUSEUM").holdMinutes
  }

  const raw = Number(process.env.BOOKING_HOLD_MINUTES)
  if (Number.isFinite(raw) && raw >= 5 && raw <= 120) return Math.round(raw)
  return 30
}

export function bookingSeatsLeft(slot: {
  capacity: number
  bookedCount: number
  heldCount: number
}): number {
  return Math.max(0, slot.capacity - slot.bookedCount - slot.heldCount)
}

export function resolveBookingSlotStatus(args: {
  capacity: number
  bookedCount: number
  heldCount: number
  previousStatus: string
}): string {
  if (args.previousStatus === "CANCELLED") return "CANCELLED"
  return bookingSeatsLeft(args) <= 0 ? "SOLD_OUT" : "OPEN"
}

export async function reserveBookingSlotHoldInTransaction(
  tx: Tx,
  args: {
    orderId: string
    productId: string
    slotId: string
    quantity: number
    listingKind?: string | null
    seatLabels?: string[]
    holdMinutes?: number
  }
): Promise<{ ok: true; expiresAt: Date } | { ok: false; error: string }> {
  const qty = Math.max(1, Math.min(99, Math.round(args.quantity) || 1))
  const seatLabels = Array.isArray(args.seatLabels)
    ? [...new Set(args.seatLabels.map((l) => l.trim()).filter(Boolean))]
    : []

  if (seatLabels.length > 0 && seatLabels.length !== qty) {
    return { ok: false, error: "booking_seats_qty_mismatch" }
  }

  const slot = await tx.bookingSlot.findFirst({
    where: { id: args.slotId, productId: args.productId },
    select: {
      id: true,
      capacity: true,
      bookedCount: true,
      heldCount: true,
      status: true,
      startsAt: true,
    },
  })
  if (!slot || slot.status === "CANCELLED") {
    return { ok: false, error: "booking_slot_not_found" }
  }
  if (slot.startsAt.getTime() <= Date.now()) {
    return { ok: false, error: "booking_slot_unavailable" }
  }
  if (bookingSeatsLeft(slot) < qty) {
    return { ok: false, error: "booking_slot_unavailable" }
  }

  const expiresAt = new Date(
    Date.now() + (args.holdMinutes ?? bookingHoldMinutes(args.listingKind)) * 60 * 1000
  )
  const nextHeld = slot.heldCount + qty

  if (seatLabels.length > 0) {
    const { reserveNamedSeatsInTransaction } = await import("@/lib/booking/named-seats")
    const named = await reserveNamedSeatsInTransaction(tx, {
      orderId: args.orderId,
      slotId: slot.id,
      seatLabels,
      holdExpiresAt: expiresAt,
    })
    if (!named.ok) return named
  }

  await tx.bookingSlot.update({
    where: { id: slot.id },
    data: {
      heldCount: nextHeld,
      status: resolveBookingSlotStatus({
        capacity: slot.capacity,
        bookedCount: slot.bookedCount,
        heldCount: nextHeld,
        previousStatus: slot.status,
      }),
    },
  })

  await tx.order.update({
    where: { id: args.orderId },
    data: { bookingHoldExpiresAt: expiresAt },
  })

  console.log("[booking]", {
    orderId: args.orderId,
    result: "hold_reserved",
    slotId: slot.id,
    quantity: qty,
    expiresAt: expiresAt.toISOString(),
  })

  return { ok: true, expiresAt }
}

export async function releaseBookingSlotHoldInTransaction(
  tx: Tx,
  args: { orderId: string }
): Promise<{ released: boolean; quantity: number; slotId: string | null }> {
  const order = await tx.order.findUnique({
    where: { id: args.orderId },
    select: {
      id: true,
      quantity: true,
      bookingSlotId: true,
      bookingHoldExpiresAt: true,
      bookingConfirmedAt: true,
    },
  })
  if (!order?.bookingSlotId || order.bookingConfirmedAt) {
    return { released: false, quantity: 0, slotId: order?.bookingSlotId ?? null }
  }
  if (!order.bookingHoldExpiresAt) {
    return { released: false, quantity: 0, slotId: order.bookingSlotId }
  }

  const qty = Math.max(1, order.quantity)
  const slot = await tx.bookingSlot.findUnique({
    where: { id: order.bookingSlotId },
    select: { id: true, capacity: true, bookedCount: true, heldCount: true, status: true },
  })
  if (!slot) {
    await tx.order.update({
      where: { id: order.id },
      data: { bookingHoldExpiresAt: null },
    })
    return { released: false, quantity: qty, slotId: order.bookingSlotId }
  }

  const nextHeld = Math.max(0, slot.heldCount - qty)
  const { releaseNamedSeatsHoldInTransaction } = await import("@/lib/booking/named-seats")
  await releaseNamedSeatsHoldInTransaction(tx, { orderId: order.id })

  await tx.bookingSlot.update({
    where: { id: slot.id },
    data: {
      heldCount: nextHeld,
      status: resolveBookingSlotStatus({
        capacity: slot.capacity,
        bookedCount: slot.bookedCount,
        heldCount: nextHeld,
        previousStatus: slot.status,
      }),
    },
  })
  await tx.order.update({
    where: { id: order.id },
    data: { bookingHoldExpiresAt: null },
  })

  console.log("[booking]", {
    orderId: order.id,
    result: "hold_released",
    slotId: slot.id,
    quantity: qty,
  })

  return { released: true, quantity: qty, slotId: slot.id }
}

/** Confirmed booking cancellation — returns seats to inventory (not hold). */
export async function releaseConfirmedBookingSeatsInTransaction(
  tx: Tx,
  args: { orderId: string; slotId: string; quantity: number }
): Promise<void> {
  const qty = Math.max(1, args.quantity)
  const slot = await tx.bookingSlot.findUnique({
    where: { id: args.slotId },
    select: { id: true, capacity: true, bookedCount: true, heldCount: true, status: true },
  })
  if (!slot) return

  const nextBooked = Math.max(0, slot.bookedCount - qty)
  const { releaseNamedSeatsBookedInTransaction } = await import("@/lib/booking/named-seats")
  await releaseNamedSeatsBookedInTransaction(tx, {
    orderId: args.orderId,
    slotId: args.slotId,
  })

  await tx.bookingSlot.update({
    where: { id: slot.id },
    data: {
      bookedCount: nextBooked,
      status: resolveBookingSlotStatus({
        capacity: slot.capacity,
        bookedCount: nextBooked,
        heldCount: slot.heldCount,
        previousStatus: slot.status,
      }),
    },
  })

  console.log("[booking]", {
    orderId: args.orderId,
    result: "seats_released",
    slotId: slot.id,
    quantity: qty,
  })
}

export async function releaseBookingSlotHoldForOrder(orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await releaseBookingSlotHoldInTransaction(tx, { orderId })
  })
}
