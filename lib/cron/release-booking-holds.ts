import { releaseBookingSlotHoldInTransaction } from "@/lib/booking/slot-hold"
import { prisma } from "@/lib/prisma"

export type ReleaseBookingHoldsCronResult = {
  scanned: number
  released: number
  cancelled: number
}

/** Expire stale PENDING checkout holds (Stripe abandoned or timeout). */
export async function runReleaseBookingHoldsCron(limit = 80): Promise<ReleaseBookingHoldsCronResult> {
  const now = new Date()
  const stale = await prisma.order.findMany({
    where: {
      status: "PENDING",
      bookingSlotId: { not: null },
      bookingHoldExpiresAt: { lt: now },
      bookingConfirmedAt: null,
    },
    orderBy: { bookingHoldExpiresAt: "asc" },
    take: limit,
    select: { id: true },
  })

  let released = 0
  let cancelled = 0

  for (const row of stale) {
    try {
      await prisma.$transaction(async (tx) => {
        const result = await releaseBookingSlotHoldInTransaction(tx, { orderId: row.id })
        if (result.released) released++
        await tx.order.updateMany({
          where: { id: row.id, status: "PENDING" },
          data: { status: "CANCELLED" },
        })
        cancelled++
      })
    } catch (e) {
      console.error("[booking]", {
        orderId: row.id,
        result: "hold_release_cron_failed",
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  console.log("[booking]", { result: "hold_release_cron", scanned: stale.length, released, cancelled })
  return { scanned: stale.length, released, cancelled }
}
