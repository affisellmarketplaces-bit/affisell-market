import { prisma } from "@/lib/prisma"

export type PublicBookingSlotRow = {
  id: string
  startsAt: string
  endsAt: string
  label: string | null
  capacity: number
  seatsLeft: number
  occupiedSeats: number
}

export type BookingSlotRow = {
  id: string
  startsAt: Date
  endsAt: Date
  capacity: number
  bookedCount: number
  heldCount: number
  label: string | null
  status: string
}

export function seatsLeft(slot: { capacity: number; bookedCount: number; heldCount: number }): number {
  return Math.max(0, slot.capacity - slot.bookedCount - slot.heldCount)
}

export function isSlotBookable(
  slot: { status: string; startsAt: Date; capacity: number; bookedCount: number; heldCount: number },
  now = new Date(),
  qty = 1
): boolean {
  if (slot.status !== "OPEN") return false
  if (slot.startsAt.getTime() <= now.getTime()) return false
  return seatsLeft(slot) >= qty
}

function mapSlotRow(row: {
  id: string
  startsAt: Date
  endsAt: Date
  label: string | null
  capacity: number
  bookedCount: number
  heldCount: number
}): PublicBookingSlotRow {
  const left = seatsLeft(row)
  return {
    id: row.id,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    label: row.label,
    capacity: row.capacity,
    seatsLeft: left,
    occupiedSeats: row.capacity - left,
  }
}

export async function listSoldOutBookingSlots(
  productId: string,
  limit = 12
): Promise<PublicBookingSlotRow[]> {
  const now = new Date()
  const rows = await prisma.bookingSlot.findMany({
    where: {
      productId,
      status: "OPEN",
      startsAt: { gt: now },
    },
    orderBy: { startsAt: "asc" },
    take: limit * 3,
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      label: true,
      capacity: true,
      bookedCount: true,
      heldCount: true,
      status: true,
    },
  })

  return rows
    .filter((row) => row.status === "OPEN" && row.startsAt > now && seatsLeft(row) <= 0)
    .slice(0, limit)
    .map(mapSlotRow)
}

export async function listPublicBookingSlots(productId: string, limit = 40): Promise<PublicBookingSlotRow[]> {
  const now = new Date()
  const rows = await prisma.bookingSlot.findMany({
    where: {
      productId,
      status: "OPEN",
      startsAt: { gt: now },
    },
    orderBy: { startsAt: "asc" },
    take: limit,
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      label: true,
      capacity: true,
      bookedCount: true,
      heldCount: true,
      status: true,
    },
  })

  return rows.filter((row) => isSlotBookable(row, now)).map(mapSlotRow)
}

export async function countAvailableBookingSlots(productId: string): Promise<number> {
  const slots = await listPublicBookingSlots(productId, 200)
  return slots.length
}

export async function loadBookingSlotForCheckout(args: {
  productId: string
  slotId: string
  quantity: number
}): Promise<{ ok: true; slot: BookingSlotRow } | { ok: false; error: string }> {
  const slot = await prisma.bookingSlot.findFirst({
    where: { id: args.slotId, productId: args.productId },
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
  if (!slot) return { ok: false, error: "booking_slot_not_found" }
  if (!isSlotBookable(slot, new Date(), args.quantity)) {
    return { ok: false, error: "booking_slot_unavailable" }
  }
  return { ok: true, slot }
}
