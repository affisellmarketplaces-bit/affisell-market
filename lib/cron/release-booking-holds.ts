import { bookingHoldStaleBefore } from "@/lib/booking/hold-grace"
import { releaseBookingSlotHoldInTransaction } from "@/lib/booking/slot-hold"
import { prisma } from "@/lib/prisma"

export type ReleaseBookingHoldsCronResult = {
  scanned: number
  released: number
  cancelled: number
}

/** Expire stale PENDING checkout holds (Stripe abandoned or timeout). */
export async function runReleaseBookingHoldsCron(limit = 80): Promise<ReleaseBookingHoldsCronResult> {
  const { releaseExpiredNamedSeatHolds } = await import("@/lib/booking/named-seats")
  await releaseExpiredNamedSeatHolds(limit)

  const now = new Date()
  const staleBefore = bookingHoldStaleBefore(now)
  const stale = await prisma.order.findMany({
    where: {
      status: "PENDING",
      bookingSlotId: { not: null },
      bookingHoldExpiresAt: { lt: staleBefore },
      bookingConfirmedAt: null,
    },
    orderBy: { bookingHoldExpiresAt: "asc" },
    take: limit,
    select: { id: true },
  })

  let released = 0
  const cancelled = 0

  for (const row of stale) {
    try {
      await prisma.$transaction(async (tx) => {
        const result = await releaseBookingSlotHoldInTransaction(tx, { orderId: row.id })
        if (result.released) released++
        // Keep PENDING until checkout.session.expired — paid webhook may still confirm within grace.
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

  if (released > 0) {
    const { processBookingWaitlistNotifications } = await import("@/lib/booking/waitlist")
    void processBookingWaitlistNotifications(30)
  }

  return { scanned: stale.length, released, cancelled }
}
