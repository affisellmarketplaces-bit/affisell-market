import {
  dayReminderSlotRange,
  hourReminderSlotRange,
} from "@/lib/booking/reminder-windows"
import { sendBookingReminderEmail } from "@/lib/emails/send-booking-reminder"
import { sendBookingReminderSms } from "@/lib/sms/send-booking-reminder-sms"
import { prisma } from "@/lib/prisma"

export type RunBookingRemindersCronResult = {
  dayProcessed: number
  daySent: number
  hourProcessed: number
  hourSent: number
  hourSmsProcessed: number
  hourSmsSent: number
  skipped: number
  errors: string[]
}

const ACTIVE_STATUSES = ["paid", "shipped", "delivered", "completed", "preparing"]

async function processReminderBatch(args: {
  kind: "day" | "hour"
  limit: number
  now: Date
}): Promise<{ processed: number; sent: number; skipped: number; errors: string[] }> {
  const range =
    args.kind === "day" ? dayReminderSlotRange(args.now) : hourReminderSlotRange(args.now)
  const sentField =
    args.kind === "day" ? "bookingReminderDaySentAt" : ("bookingReminderHourSentAt" as const)

  const orders = await prisma.order.findMany({
    where: {
      bookingConfirmedAt: { not: null },
      bookingCancelledAt: null,
      bookingToken: { not: null },
      [sentField]: null,
      status: { in: [...ACTIVE_STATUSES] },
      customerEmail: { not: "" },
      bookingSlot: {
        startsAt: { gte: range.gte, lte: range.lte },
      },
    },
    take: args.limit,
    orderBy: { bookingSlot: { startsAt: "asc" } },
    select: {
      id: true,
      customerEmail: true,
      bookingToken: true,
      bookingSnapshot: true,
      listingKindSnapshot: true,
      buyerLocale: true,
      product: { select: { name: true } },
    },
  })

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of orders) {
    if (!row.bookingToken) {
      skipped += 1
      continue
    }

    const result = await sendBookingReminderEmail({
      orderId: row.id,
      customerEmail: row.customerEmail,
      productName: row.product.name,
      bookingToken: row.bookingToken,
      bookingSnapshot: row.bookingSnapshot,
      listingKind: row.listingKindSnapshot,
      locale: row.buyerLocale,
      kind: args.kind,
    })

    if (!result.ok) {
      errors.push(`${row.id}:${args.kind}:${result.error ?? "send_failed"}`)
      skipped += 1
      continue
    }

    const updated = await prisma.order.updateMany({
      where: { id: row.id, [sentField]: null },
      data: { [sentField]: new Date() },
    })

    if (updated.count === 1) sent += 1
    else skipped += 1
  }

  return { processed: orders.length, sent, skipped, errors }
}

async function processHourSmsBatch(args: {
  limit: number
  now: Date
}): Promise<{ processed: number; sent: number; skipped: number; errors: string[] }> {
  const range = hourReminderSlotRange(args.now)

  const orders = await prisma.order.findMany({
    where: {
      bookingConfirmedAt: { not: null },
      bookingCancelledAt: null,
      bookingToken: { not: null },
      bookingReminderHourSmsSentAt: null,
      customerPhone: { not: null },
      status: { in: [...ACTIVE_STATUSES] },
      bookingSlot: {
        startsAt: { gte: range.gte, lte: range.lte },
      },
    },
    take: args.limit,
    orderBy: { bookingSlot: { startsAt: "asc" } },
    select: {
      id: true,
      customerPhone: true,
      bookingToken: true,
      bookingSnapshot: true,
      listingKindSnapshot: true,
      buyerLocale: true,
      product: { select: { name: true } },
    },
  })

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of orders) {
    if (!row.bookingToken || !row.customerPhone?.trim()) {
      skipped += 1
      continue
    }

    const result = await sendBookingReminderSms({
      orderId: row.id,
      customerPhone: row.customerPhone,
      productName: row.product.name,
      bookingToken: row.bookingToken,
      bookingSnapshot: row.bookingSnapshot,
      listingKind: row.listingKindSnapshot,
      locale: row.buyerLocale,
    })

    if (!result.ok) {
      if (result.error !== "twilio_not_configured") {
        errors.push(`${row.id}:sms:${result.error ?? "send_failed"}`)
      }
      skipped += 1
      continue
    }

    const updated = await prisma.order.updateMany({
      where: { id: row.id, bookingReminderHourSmsSentAt: null },
      data: { bookingReminderHourSmsSentAt: new Date() },
    })

    if (updated.count === 1) sent += 1
    else skipped += 1
  }

  return { processed: orders.length, sent, skipped, errors }
}

/** J-1 (~24h) and H-2 (~2h) booking reminder emails — idempotent per order. */
export async function runBookingRemindersCron(limit = 40): Promise<RunBookingRemindersCronResult> {
  const now = new Date()
  const perKindLimit = Math.max(10, Math.ceil(limit / 2))

  const day = await processReminderBatch({ kind: "day", limit: perKindLimit, now })
  const hour = await processReminderBatch({ kind: "hour", limit: perKindLimit, now })
  const hourSms = await processHourSmsBatch({ limit: perKindLimit, now })

  const result: RunBookingRemindersCronResult = {
    dayProcessed: day.processed,
    daySent: day.sent,
    hourProcessed: hour.processed,
    hourSent: hour.sent,
    hourSmsProcessed: hourSms.processed,
    hourSmsSent: hourSms.sent,
    skipped: day.skipped + hour.skipped + hourSms.skipped,
    errors: [...day.errors, ...hour.errors, ...hourSms.errors],
  }

  console.log("[booking-reminder]", { result: "cron_complete", ...result })
  return result
}
