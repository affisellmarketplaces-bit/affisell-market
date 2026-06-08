import type { Prisma } from "@prisma/client"

import { buildSeatLayout, usesNamedSeatMap } from "@/lib/booking/seat-layout"
import { prisma } from "@/lib/prisma"

type Tx = Prisma.TransactionClient

export type PublicSeatCell = {
  label: string
  rowIndex: number
  colIndex: number
  status: "OPEN" | "HELD" | "BOOKED"
}

export async function provisionNamedSeatsForSlot(
  tx: Tx,
  args: { slotId: string; capacity: number; listingKind: string }
): Promise<number> {
  if (!usesNamedSeatMap(args.listingKind, args.capacity)) return 0

  const existing = await tx.bookingSeat.count({ where: { slotId: args.slotId } })
  if (existing > 0) return existing

  const layout = buildSeatLayout(args.capacity)
  await tx.bookingSeat.createMany({
    data: layout.map((cell) => ({
      slotId: args.slotId,
      label: cell.label,
      rowIndex: cell.rowIndex,
      colIndex: cell.colIndex,
      status: "OPEN",
    })),
    skipDuplicates: true,
  })

  console.log("[booking]", {
    result: "named_seats_provisioned",
    slotId: args.slotId,
    count: layout.length,
  })
  return layout.length
}

export async function slotHasNamedSeats(slotId: string): Promise<boolean> {
  const n = await prisma.bookingSeat.count({ where: { slotId } })
  return n > 0
}

export async function listPublicSeatMap(slotId: string): Promise<PublicSeatCell[]> {
  const now = new Date()
  const rows = await prisma.bookingSeat.findMany({
    where: { slotId },
    orderBy: [{ rowIndex: "asc" }, { colIndex: "asc" }],
    select: {
      label: true,
      rowIndex: true,
      colIndex: true,
      status: true,
      holdExpiresAt: true,
    },
  })

  return rows.map((row) => {
    let status = row.status as PublicSeatCell["status"]
    if (status === "HELD" && row.holdExpiresAt && row.holdExpiresAt.getTime() < now.getTime()) {
      status = "OPEN"
    }
    return {
      label: row.label,
      rowIndex: row.rowIndex,
      colIndex: row.colIndex,
      status,
    }
  })
}

export async function reserveNamedSeatsInTransaction(
  tx: Tx,
  args: {
    orderId: string
    slotId: string
    seatLabels: string[]
    holdExpiresAt: Date
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const labels = [...new Set(args.seatLabels.map((l) => l.trim()).filter(Boolean))]
  if (labels.length === 0) return { ok: false, error: "booking_seats_required" }

  const seats = await tx.bookingSeat.findMany({
    where: { slotId: args.slotId, label: { in: labels } },
    select: { id: true, label: true, status: true, holdExpiresAt: true },
  })
  if (seats.length !== labels.length) {
    return { ok: false, error: "booking_seat_not_found" }
  }

  const now = new Date()
  for (const seat of seats) {
    const expiredHold =
      seat.status === "HELD" && seat.holdExpiresAt && seat.holdExpiresAt.getTime() < now.getTime()
    if (seat.status === "BOOKED" || (seat.status === "HELD" && !expiredHold)) {
      return { ok: false, error: "booking_seat_unavailable" }
    }
  }

  await tx.bookingSeat.updateMany({
    where: { slotId: args.slotId, label: { in: labels } },
    data: {
      status: "HELD",
      orderId: args.orderId,
      holdExpiresAt: args.holdExpiresAt,
    },
  })

  console.log("[booking]", {
    orderId: args.orderId,
    result: "named_seats_held",
    slotId: args.slotId,
    labels,
  })
  return { ok: true }
}

export async function releaseNamedSeatsHoldInTransaction(
  tx: Tx,
  args: { orderId: string }
): Promise<number> {
  const result = await tx.bookingSeat.updateMany({
    where: { orderId: args.orderId, status: "HELD" },
    data: {
      status: "OPEN",
      orderId: null,
      holdExpiresAt: null,
    },
  })
  if (result.count > 0) {
    console.log("[booking]", {
      orderId: args.orderId,
      result: "named_seats_hold_released",
      count: result.count,
    })
  }
  return result.count
}

export async function confirmNamedSeatsInTransaction(
  tx: Tx,
  args: { orderId: string; slotId: string }
): Promise<void> {
  await tx.bookingSeat.updateMany({
    where: { orderId: args.orderId, slotId: args.slotId, status: "HELD" },
    data: {
      status: "BOOKED",
      holdExpiresAt: null,
    },
  })
}

export async function releaseNamedSeatsBookedInTransaction(
  tx: Tx,
  args: { orderId: string; slotId: string }
): Promise<number> {
  const result = await tx.bookingSeat.updateMany({
    where: { orderId: args.orderId, slotId: args.slotId, status: "BOOKED" },
    data: {
      status: "OPEN",
      orderId: null,
      holdExpiresAt: null,
    },
  })
  if (result.count > 0) {
    console.log("[booking]", {
      orderId: args.orderId,
      result: "named_seats_booking_released",
      count: result.count,
    })
  }
  return result.count
}

/** Expire stale HELD seats (cron safety net for named seats). */
export async function releaseExpiredNamedSeatHolds(limit = 200): Promise<number> {
  const { bookingHoldStaleBefore } = await import("@/lib/booking/hold-grace")
  const staleBefore = bookingHoldStaleBefore()
  const stale = await prisma.bookingSeat.findMany({
    where: { status: "HELD", holdExpiresAt: { lt: staleBefore } },
    take: limit,
    select: { id: true, orderId: true },
  })
  if (stale.length === 0) return 0

  await prisma.bookingSeat.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { status: "OPEN", orderId: null, holdExpiresAt: null },
  })

  console.log("[booking]", { result: "named_seat_holds_expired", count: stale.length })
  return stale.length
}
