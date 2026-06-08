import {
  buildSeatLayout,
  resolveSeatLayoutConfig,
  usesNamedSeatMap,
} from "@/lib/booking/seat-layout"
import { prisma } from "@/lib/prisma"

export type SyncProductSeatLayoutResult = {
  scanned: number
  reprovisioned: number
  seatCount: number
  skippedInUse: number
}

/**
 * Re-provision named seats on future empty slots when supplier updates cinema layout.
 * Idempotent — skips slots with BOOKED/HELD seats.
 */
export async function syncProductSeatLayoutForFutureSlots(
  productId: string
): Promise<SyncProductSeatLayoutResult> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { listingKind: true, bookingSeatLayout: true },
  })
  if (!product || !usesNamedSeatMap(product.listingKind, 2)) {
    return { scanned: 0, reprovisioned: 0, seatCount: 0, skippedInUse: 0 }
  }

  const layout = resolveSeatLayoutConfig(product.bookingSeatLayout, product.listingKind)
  const now = new Date()
  const slots = await prisma.bookingSlot.findMany({
    where: {
      productId,
      status: "OPEN",
      startsAt: { gt: now },
      bookedCount: 0,
      heldCount: 0,
      capacity: { gt: 1 },
    },
    select: { id: true, capacity: true },
    orderBy: { startsAt: "asc" },
  })

  let reprovisioned = 0
  let seatCount = 0
  let skippedInUse = 0

  for (const slot of slots) {
    const result = await prisma.$transaction(async (tx) => {
      const inUse = await tx.bookingSeat.count({
        where: { slotId: slot.id, status: { in: ["BOOKED", "HELD"] } },
      })
      if (inUse > 0) {
        return { reprovisioned: false, count: 0, inUse: true }
      }

      const existing = await tx.bookingSeat.count({ where: { slotId: slot.id } })
      if (existing === 0) {
        return { reprovisioned: false, count: 0, inUse: false }
      }

      await tx.bookingSeat.deleteMany({ where: { slotId: slot.id } })
      const cells = buildSeatLayout(slot.capacity, layout)
      await tx.bookingSeat.createMany({
        data: cells.map((cell) => ({
          slotId: slot.id,
          label: cell.label,
          rowIndex: cell.rowIndex,
          colIndex: cell.colIndex,
          status: cell.blocked ? "BLOCKED" : "OPEN",
        })),
        skipDuplicates: true,
      })

      console.log("[booking]", {
        result: "seat_layout_reprovisioned",
        productId,
        slotId: slot.id,
        count: cells.length,
      })
      return { reprovisioned: true, count: cells.length, inUse: false }
    })

    if (result.inUse) skippedInUse += 1
    else if (result.reprovisioned) {
      reprovisioned += 1
      seatCount += result.count
    }
  }

  if (reprovisioned > 0 || skippedInUse > 0) {
    console.log("[booking]", {
      result: "seat_layout_sync",
      productId,
      scanned: slots.length,
      reprovisioned,
      seatCount,
      skippedInUse,
    })
  }

  return { scanned: slots.length, reprovisioned, seatCount, skippedInUse }
}
