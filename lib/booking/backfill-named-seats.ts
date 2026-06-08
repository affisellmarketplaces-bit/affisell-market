import { provisionNamedSeatsForSlot } from "@/lib/booking/named-seats"
import { usesNamedSeatMap } from "@/lib/booking/seat-layout"
import { prisma } from "@/lib/prisma"

export type BackfillNamedSeatsResult = {
  scanned: number
  provisioned: number
  seatCount: number
}

/** Idempotent: provision BookingSeat rows for EXPERIENCE slots missing a seat map. */
export async function backfillNamedSeatsForExperienceSlots(): Promise<BackfillNamedSeatsResult> {
  const slots = await prisma.bookingSlot.findMany({
    where: {
      capacity: { gt: 1 },
      product: { listingKind: "EXPERIENCE" },
      seats: { none: {} },
    },
    select: {
      id: true,
      capacity: true,
      product: { select: { listingKind: true } },
    },
    orderBy: { startsAt: "asc" },
  })

  let provisioned = 0
  let seatCount = 0

  for (const slot of slots) {
    if (!usesNamedSeatMap(slot.product.listingKind, slot.capacity)) continue

    const count = await prisma.$transaction((tx) =>
      provisionNamedSeatsForSlot(tx, {
        slotId: slot.id,
        capacity: slot.capacity,
        listingKind: slot.product.listingKind,
      })
    )

    if (count > 0) {
      provisioned += 1
      seatCount += count
    }
  }

  console.log("[booking]", {
    result: "named_seats_backfill",
    scanned: slots.length,
    provisioned,
    seatCount,
  })

  return { scanned: slots.length, provisioned, seatCount }
}
