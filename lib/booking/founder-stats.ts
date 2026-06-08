import { prisma } from "@/lib/prisma"

export type BookingFounderStats = {
  confirmed7d: number
  confirmed30d: number
  experienceShare30dPct: number
  pendingCheckInsToday: number
  checkInRate7dPct: number | null
  hourEmailReminders7d: number
  hourSmsReminders7d: number
  noShowGuests7d: number
  waitlistJoins7d: number
  waitlistNotified7d: number
  waitlistSms7d: number
  waitlistConversions7d: number
  waitlistConversionRate7dPct: number | null
}

const ACTIVE_BOOKING_STATUSES = ["paid", "shipped", "delivered", "completed", "preparing"]

async function countWaitlistConversions7d(d7: Date): Promise<number> {
  const entries = await prisma.bookingWaitlist.findMany({
    where: { notifiedAt: { gte: d7 } },
    select: { email: true, slotId: true, notifiedAt: true },
    take: 500,
    orderBy: { notifiedAt: "desc" },
  })
  if (entries.length === 0) return 0

  let conversions = 0
  for (const entry of entries) {
    if (!entry.notifiedAt) continue
    const order = await prisma.order.findFirst({
      where: {
        bookingSlotId: entry.slotId,
        bookingConfirmedAt: { gte: entry.notifiedAt },
        bookingCancelledAt: null,
        customerEmail: { equals: entry.email, mode: "insensitive" },
        status: { in: ACTIVE_BOOKING_STATUSES },
      },
      select: { id: true },
    })
    if (order) conversions += 1
  }
  return conversions
}

export async function loadBookingFounderStats(now = new Date()): Promise<BookingFounderStats> {
  const d7 = new Date(now.getTime() - 7 * 86_400_000)
  const d30 = new Date(now.getTime() - 30 * 86_400_000)
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  const bookingBase = {
    bookingConfirmedAt: { not: null as null },
    bookingCancelledAt: null,
    status: { in: ACTIVE_BOOKING_STATUSES },
  }

  const [
    confirmed7d,
    confirmed30d,
    experience30d,
    pendingToday,
    hourEmail7d,
    hourSms7d,
    pastSlotOrders7d,
    waitlistJoins7d,
    waitlistNotified7d,
    waitlistSms7d,
    waitlistConversions7d,
  ] = await Promise.all([
    prisma.order.count({ where: { ...bookingBase, bookingConfirmedAt: { gte: d7 } } }),
    prisma.order.count({ where: { ...bookingBase, bookingConfirmedAt: { gte: d30 } } }),
    prisma.order.count({
      where: {
        ...bookingBase,
        bookingConfirmedAt: { gte: d30 },
        listingKindSnapshot: "EXPERIENCE",
      },
    }),
    prisma.order.count({
      where: {
        ...bookingBase,
        bookingCheckedInAt: null,
        bookingSlot: { startsAt: { gte: todayStart, lte: todayEnd } },
      },
    }),
    prisma.order.count({
      where: { bookingReminderHourSentAt: { gte: d7 } },
    }),
    prisma.order.count({
      where: { bookingReminderHourSmsSentAt: { gte: d7 } },
    }),
    prisma.order.findMany({
      where: {
        ...bookingBase,
        bookingConfirmedAt: { gte: d7 },
        bookingSlot: { startsAt: { lt: now } },
      },
      select: {
        quantity: true,
        bookingCheckedInAt: true,
      },
      take: 2000,
    }),
    prisma.bookingWaitlist.count({ where: { createdAt: { gte: d7 } } }),
    prisma.bookingWaitlist.count({ where: { notifiedAt: { gte: d7 } } }),
    prisma.bookingWaitlist.count({ where: { smsNotifiedAt: { gte: d7 } } }),
    countWaitlistConversions7d(d7),
  ])

  let pastGuests = 0
  let pastCheckedIn = 0
  let noShowGuests7d = 0
  for (const row of pastSlotOrders7d) {
    const qty = Math.max(1, row.quantity)
    pastGuests += qty
    if (row.bookingCheckedInAt) pastCheckedIn += qty
    else noShowGuests7d += qty
  }

  const stats: BookingFounderStats = {
    confirmed7d,
    confirmed30d,
    experienceShare30dPct:
      confirmed30d > 0 ? Math.round((experience30d / confirmed30d) * 100) : 0,
    pendingCheckInsToday: pendingToday,
    checkInRate7dPct: pastGuests > 0 ? Math.round((pastCheckedIn / pastGuests) * 100) : null,
    hourEmailReminders7d: hourEmail7d,
    hourSmsReminders7d: hourSms7d,
    noShowGuests7d,
    waitlistJoins7d,
    waitlistNotified7d,
    waitlistConversions7d,
    waitlistSms7d,
    waitlistConversionRate7dPct:
      waitlistNotified7d > 0
        ? Math.round((waitlistConversions7d / waitlistNotified7d) * 100)
        : null,
  }

  console.log("[booking-founder]", { result: "stats_loaded", ...stats })
  return stats
}
