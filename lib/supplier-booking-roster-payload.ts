import { parseBookingSnapshot } from "@/lib/booking/snapshot"
import { prisma } from "@/lib/prisma"
import {
  computeSupplierBookingStats,
  type SupplierBookingStats,
} from "@/lib/supplier-booking-stats"

export type SupplierBookingRosterRow = {
  orderId: string
  customerEmail: string
  quantity: number
  productId: string
  productName: string
  listingKind: string | null
  slotId: string | null
  slotStartsAt: string | null
  slotEndsAt: string | null
  slotLabel: string | null
  venueLabel: string | null
  seatLabels: string[]
  bookingConfirmedAt: string
  bookingCheckedInAt: string | null
  checkedIn: boolean
}

export type SupplierBookingSlotFilter = {
  id: string
  productId: string
  productName: string
  startsAt: string
  endsAt: string
  label: string | null
  bookedCount: number
  capacity: number
  pendingCheckInCount: number
}

export type SupplierBookingRosterPayload = {
  rows: SupplierBookingRosterRow[]
  slots: SupplierBookingSlotFilter[]
  pendingCheckInCount: number
  stats: SupplierBookingStats
}

type RosterQuery = {
  supplierId: string
  slotId?: string
  checkedIn?: "pending" | "checked_in" | "all"
  from?: Date
  to?: Date
}

function defaultRosterWindow(): { from: Date; to: Date } {
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  return { from, to }
}

export async function fetchSupplierBookingRoster(
  query: RosterQuery
): Promise<SupplierBookingRosterPayload> {
  const window = defaultRosterWindow()
  const from = query.from ?? window.from
  const to = query.to ?? window.to
  const checkedIn = query.checkedIn ?? "all"

  const orders = await prisma.order.findMany({
    where: {
      supplierId: query.supplierId,
      bookingConfirmedAt: { not: null },
      bookingCancelledAt: null,
      ...(query.slotId ? { bookingSlotId: query.slotId } : {}),
      bookingSlot: {
        startsAt: { gte: from, lte: to },
      },
    },
    select: {
      id: true,
      customerEmail: true,
      quantity: true,
      listingKindSnapshot: true,
      bookingSnapshot: true,
      bookingConfirmedAt: true,
      bookingCheckedInAt: true,
      bookingSlotId: true,
      bookingSlot: {
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          label: true,
          productId: true,
          product: { select: { name: true } },
        },
      },
      product: { select: { id: true, name: true } },
      bookingSeats: {
        where: { status: "BOOKED" },
        select: { label: true },
        orderBy: [{ rowIndex: "asc" }, { colIndex: "asc" }],
      },
    },
    orderBy: [{ bookingSlot: { startsAt: "asc" } }, { bookingConfirmedAt: "asc" }],
    take: 500,
  })

  const allRows: SupplierBookingRosterRow[] = orders.map((order) => {
    const snapshot = parseBookingSnapshot(order.bookingSnapshot)
    const seatLabelsFromDb = order.bookingSeats.map((s) => s.label)
    const seatLabels =
      seatLabelsFromDb.length > 0
        ? seatLabelsFromDb
        : (snapshot?.seatLabels ?? [])

    return {
      orderId: order.id,
      customerEmail: order.customerEmail,
      quantity: order.quantity,
      productId: order.product.id,
      productName: snapshot?.productName || order.product.name,
      listingKind: order.listingKindSnapshot,
      slotId: order.bookingSlotId,
      slotStartsAt: order.bookingSlot?.startsAt.toISOString() ?? snapshot?.startsAt ?? null,
      slotEndsAt: order.bookingSlot?.endsAt.toISOString() ?? snapshot?.endsAt ?? null,
      slotLabel: order.bookingSlot?.label ?? snapshot?.label ?? null,
      venueLabel: snapshot?.venueLabel ?? null,
      seatLabels,
      bookingConfirmedAt: order.bookingConfirmedAt!.toISOString(),
      bookingCheckedInAt: order.bookingCheckedInAt?.toISOString() ?? null,
      checkedIn: Boolean(order.bookingCheckedInAt),
    }
  })

  const rows =
    checkedIn === "pending"
      ? allRows.filter((row) => !row.checkedIn)
      : checkedIn === "checked_in"
        ? allRows.filter((row) => row.checkedIn)
        : allRows

  const stats = computeSupplierBookingStats(allRows)

  const slotRows = await prisma.bookingSlot.findMany({
    where: {
      product: { supplierId: query.supplierId },
      startsAt: { gte: from, lte: to },
      bookedCount: { gt: 0 },
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      label: true,
      bookedCount: true,
      capacity: true,
      productId: true,
      product: { select: { name: true } },
      orders: {
        where: {
          bookingConfirmedAt: { not: null },
          bookingCancelledAt: null,
          bookingCheckedInAt: null,
        },
        select: { id: true },
      },
    },
    orderBy: { startsAt: "asc" },
    take: 120,
  })

  const slots: SupplierBookingSlotFilter[] = slotRows.map((slot) => ({
    id: slot.id,
    productId: slot.productId,
    productName: slot.product.name,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    label: slot.label,
    bookedCount: slot.bookedCount,
    capacity: slot.capacity,
    pendingCheckInCount: slot.orders.length,
  }))

  const pendingCheckInCount = allRows.filter((r) => !r.checkedIn).length

  console.log("[booking-roster]", {
    supplierId: query.supplierId,
    result: "stats",
    ...stats,
  })

  return { rows, slots, pendingCheckInCount, stats }
}

export async function countSupplierPendingBookingCheckIns(supplierId: string): Promise<number> {
  const { from, to } = defaultRosterWindow()
  return prisma.order.count({
    where: {
      supplierId,
      bookingConfirmedAt: { not: null },
      bookingCancelledAt: null,
      bookingCheckedInAt: null,
      bookingSlot: { startsAt: { gte: from, lte: to } },
    },
  })
}
