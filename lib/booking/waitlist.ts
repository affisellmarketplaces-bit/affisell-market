import { isSlotBookable, seatsLeft } from "@/lib/booking/slot-availability"
import { sendBookingWaitlistAvailableEmail } from "@/lib/emails/send-booking-waitlist"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"

export type JoinBookingWaitlistResult =
  | { ok: true; created: boolean }
  | { ok: false; error: string }

export function normalizeWaitlistEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email.slice(0, 200)
}

export async function joinBookingWaitlist(args: {
  slotId: string
  productId: string
  email: string
  userId?: string | null
  qty?: number
}): Promise<JoinBookingWaitlistResult> {
  const email = normalizeWaitlistEmail(args.email)
  if (!email) return { ok: false, error: "invalid_email" }

  const qty = Math.max(1, Math.min(10, Math.round(args.qty ?? 1)))

  const slot = await prisma.bookingSlot.findFirst({
    where: { id: args.slotId, productId: args.productId, status: "OPEN" },
    select: {
      id: true,
      productId: true,
      startsAt: true,
      capacity: true,
      bookedCount: true,
      heldCount: true,
      status: true,
      label: true,
      product: { select: { name: true, active: true, isDraft: true, listingKind: true } },
    },
  })

  if (!slot || !slot.product.active || slot.product.isDraft) {
    return { ok: false, error: "slot_not_found" }
  }

  const now = new Date()
  if (slot.startsAt.getTime() <= now.getTime()) {
    return { ok: false, error: "slot_past" }
  }

  if (isSlotBookable(slot, now, qty)) {
    return { ok: false, error: "slot_available" }
  }

  const existing = await prisma.bookingWaitlist.findUnique({
    where: { slotId_email: { slotId: args.slotId, email } },
    select: { id: true, notifiedAt: true },
  })

  if (existing) {
    if (!existing.notifiedAt) {
      return { ok: true, created: false }
    }
    await prisma.bookingWaitlist.update({
      where: { id: existing.id },
      data: { notifiedAt: null, qty, userId: args.userId ?? null },
    })
    console.log("[booking-waitlist]", {
      slotId: args.slotId,
      result: "rejoined",
      email: email.slice(0, 3) + "***",
    })
    return { ok: true, created: false }
  }

  await prisma.bookingWaitlist.create({
    data: {
      slotId: args.slotId,
      productId: args.productId,
      email,
      userId: args.userId ?? null,
      qty,
    },
  })

  console.log("[booking-waitlist]", {
    slotId: args.slotId,
    result: "joined",
    seatsLeft: seatsLeft(slot),
    qty,
  })
  return { ok: true, created: true }
}

export type ProcessBookingWaitlistResult = {
  scanned: number
  notified: number
  skipped: number
  errors: string[]
}

export async function processBookingWaitlistNotifications(
  limit = 40
): Promise<ProcessBookingWaitlistResult> {
  const entries = await prisma.bookingWaitlist.findMany({
    where: { notifiedAt: null },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      slot: {
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
      },
      product: { select: { name: true, listingKind: true } },
    },
  })

  let notified = 0
  let skipped = 0
  const errors: string[] = []

  for (const entry of entries) {
    if (!isSlotBookable(entry.slot, new Date(), entry.qty)) {
      skipped += 1
      continue
    }

    const listing = await prisma.affiliateProduct.findFirst({
      where: { productId: entry.productId, ...buyerListedAffiliateProductWhere },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })
    if (!listing) {
      skipped += 1
      continue
    }

    const sent = await sendBookingWaitlistAvailableEmail({
      waitlistId: entry.id,
      email: entry.email,
      productName: entry.product.name,
      listingKind: entry.product.listingKind,
      slotStartsAt: entry.slot.startsAt.toISOString(),
      slotLabel: entry.slot.label,
      affiliateProductId: listing.id,
      slotId: entry.slot.id,
    })

    if (!sent.ok) {
      if (sent.error !== "RESEND_API_KEY not configured") {
        errors.push(`${entry.id}:${sent.error ?? "send_failed"}`)
      }
      skipped += 1
      continue
    }

    const updated = await prisma.bookingWaitlist.updateMany({
      where: { id: entry.id, notifiedAt: null },
      data: { notifiedAt: new Date() },
    })
    if (updated.count === 1) notified += 1
    else skipped += 1
  }

  const result: ProcessBookingWaitlistResult = {
    scanned: entries.length,
    notified,
    skipped,
    errors,
  }

  if (notified > 0 || errors.length > 0) {
    console.log("[booking-waitlist]", { result: "notify_complete", ...result })
  }
  return result
}
