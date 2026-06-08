import { isSlotBookable, seatsLeft } from "@/lib/booking/slot-availability"
import { sendBookingWaitlistAvailableEmail } from "@/lib/emails/send-booking-waitlist"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"
import { normalizeE164Phone } from "@/lib/sms/twilio-delivery"
import { sendBookingWaitlistSms } from "@/lib/sms/send-booking-waitlist-sms"

export type JoinBookingWaitlistResult =
  | { ok: true; created: boolean }
  | { ok: false; error: string }

export function normalizeWaitlistEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email.slice(0, 200)
}

export function normalizeWaitlistPhone(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  return normalizeE164Phone(raw.trim())
}

export async function joinBookingWaitlist(args: {
  slotId: string
  productId: string
  email: string
  phone?: string | null
  userId?: string | null
  qty?: number
}): Promise<JoinBookingWaitlistResult> {
  const email = normalizeWaitlistEmail(args.email)
  if (!email) return { ok: false, error: "invalid_email" }

  const phone = normalizeWaitlistPhone(args.phone)
  if (args.phone?.trim() && !phone) return { ok: false, error: "invalid_phone" }

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
      if (phone) {
        await prisma.bookingWaitlist.update({
          where: { id: existing.id },
          data: { phone, qty, userId: args.userId ?? null },
        })
      }
      return { ok: true, created: false }
    }
    await prisma.bookingWaitlist.update({
      where: { id: existing.id },
      data: {
        notifiedAt: null,
        smsNotifiedAt: null,
        qty,
        phone: phone ?? null,
        userId: args.userId ?? null,
      },
    })
    console.log("[booking-waitlist]", {
      slotId: args.slotId,
      result: "rejoined",
      email: email.slice(0, 3) + "***",
      hasPhone: Boolean(phone),
    })
    return { ok: true, created: false }
  }

  await prisma.bookingWaitlist.create({
    data: {
      slotId: args.slotId,
      productId: args.productId,
      email,
      phone,
      userId: args.userId ?? null,
      qty,
    },
  })

  console.log("[booking-waitlist]", {
    slotId: args.slotId,
    result: "joined",
    seatsLeft: seatsLeft(slot),
    qty,
    hasPhone: Boolean(phone),
  })
  return { ok: true, created: true }
}

export type ProcessBookingWaitlistResult = {
  scanned: number
  emailNotified: number
  smsNotified: number
  skipped: number
  errors: string[]
}

export async function processBookingWaitlistNotifications(
  limit = 40
): Promise<ProcessBookingWaitlistResult> {
  const entries = await prisma.bookingWaitlist.findMany({
    where: {
      OR: [{ notifiedAt: null }, { phone: { not: null }, smsNotifiedAt: null }],
    },
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

  let emailNotified = 0
  let smsNotified = 0
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

    const needsEmail = entry.notifiedAt == null
    const needsSms = Boolean(entry.phone?.trim()) && entry.smsNotifiedAt == null

    if (!needsEmail && !needsSms) {
      skipped += 1
      continue
    }

    if (needsEmail) {
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
          errors.push(`${entry.id}:email:${sent.error ?? "send_failed"}`)
        }
        skipped += 1
        continue
      }

      const updated = await prisma.bookingWaitlist.updateMany({
        where: { id: entry.id, notifiedAt: null },
        data: { notifiedAt: new Date() },
      })
      if (updated.count === 1) emailNotified += 1
    }

    if (needsSms && entry.phone) {
      const sms = await sendBookingWaitlistSms({
        waitlistId: entry.id,
        phone: entry.phone,
        productName: entry.product.name,
        listingKind: entry.product.listingKind,
        slotStartsAt: entry.slot.startsAt.toISOString(),
        affiliateProductId: listing.id,
        slotId: entry.slot.id,
      })

      if (sms.ok) {
        const updated = await prisma.bookingWaitlist.updateMany({
          where: { id: entry.id, smsNotifiedAt: null },
          data: { smsNotifiedAt: new Date() },
        })
        if (updated.count === 1) smsNotified += 1
      } else if (sms.error !== "twilio_not_configured") {
        errors.push(`${entry.id}:sms:${sms.error ?? "send_failed"}`)
      }
    }
  }

  const result: ProcessBookingWaitlistResult = {
    scanned: entries.length,
    emailNotified,
    smsNotified,
    skipped,
    errors,
  }

  if (emailNotified > 0 || smsNotified > 0 || errors.length > 0) {
    console.log("[booking-waitlist]", { result: "notify_complete", ...result })
  }
  return result
}
