import { parseBookingSnapshot } from "@/lib/booking/snapshot"
import { loadSupplierEmail } from "@/lib/emails/send-supplier-booking-alert"
import {
  sendSupplierBookingDigestEmail,
  type SupplierDigestOrderRow,
} from "@/lib/emails/send-supplier-booking-digest"
import { prisma } from "@/lib/prisma"

export type RunBookingSupplierDigestResult = {
  suppliersProcessed: number
  emailsSent: number
  ordersMarked: number
  skipped: number
  errors: string[]
}

const ACTIVE_STATUSES = ["paid", "shipped", "delivered", "completed", "preparing"]

function dayBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

/** J-0 morning digest — one email per supplier with today's confirmed bookings. */
export async function runBookingSupplierDigestCron(
  now = new Date(),
  limit = 200
): Promise<RunBookingSupplierDigestResult> {
  const { start, end } = dayBounds(now)

  const orders = await prisma.order.findMany({
    where: {
      bookingConfirmedAt: { not: null },
      bookingCancelledAt: null,
      bookingSupplierDigestSentAt: null,
      status: { in: ACTIVE_STATUSES },
      bookingSlot: { startsAt: { gte: start, lte: end } },
    },
    take: limit,
    orderBy: [{ supplierId: "asc" }, { bookingSlot: { startsAt: "asc" } }],
    select: {
      id: true,
      supplierId: true,
      customerEmail: true,
      quantity: true,
      bookingSnapshot: true,
      product: { select: { name: true } },
      bookingSlot: { select: { startsAt: true } },
    },
  })

  const bySupplier = new Map<string, typeof orders>()
  for (const row of orders) {
    const list = bySupplier.get(row.supplierId) ?? []
    list.push(row)
    bySupplier.set(row.supplierId, list)
  }

  let emailsSent = 0
  let ordersMarked = 0
  let skipped = 0
  const errors: string[] = []

  for (const [supplierId, rows] of bySupplier) {
    const supplierEmail = await loadSupplierEmail(supplierId)
    if (!supplierEmail) {
      skipped += rows.length
      continue
    }

    const digestRows: SupplierDigestOrderRow[] = rows.map((row) => {
      const snapshot = parseBookingSnapshot(row.bookingSnapshot)
      return {
        orderId: row.id,
        productName: snapshot?.productName || row.product.name,
        startsAt: snapshot?.startsAt ?? row.bookingSlot?.startsAt.toISOString() ?? start.toISOString(),
        seatLabels: snapshot?.seatLabels ?? [],
        quantity: snapshot?.quantity ?? row.quantity,
        customerEmail: row.customerEmail,
        listingKind: snapshot?.listingKind ?? null,
      }
    })

    const sent = await sendSupplierBookingDigestEmail({
      supplierId,
      supplierEmail,
      day: start,
      rows: digestRows,
    })

    if (!sent.ok) {
      if (sent.error !== "RESEND_API_KEY not configured") {
        errors.push(`${supplierId}:digest:${sent.error ?? "send_failed"}`)
      }
      skipped += rows.length
      continue
    }

    emailsSent += 1
    const ids = rows.map((r) => r.id)
    const updated = await prisma.order.updateMany({
      where: { id: { in: ids }, bookingSupplierDigestSentAt: null },
      data: { bookingSupplierDigestSentAt: now },
    })
    ordersMarked += updated.count
  }

  const result: RunBookingSupplierDigestResult = {
    suppliersProcessed: bySupplier.size,
    emailsSent,
    ordersMarked,
    skipped,
    errors,
  }

  console.log("[booking-supplier-digest]", { result: "cron_complete", ...result })
  return result
}
